import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DeleteEventButton } from "@/app/events/delete-event-button";
import { LogoutButton } from "@/app/logout-button";
import {
  ACTIVE_DELETE_ERROR,
  ARCHIVED_DELETE_ERROR,
  ARCHIVED_ACTIVATION_ERROR,
  ARCHIVED_READ_ONLY_MESSAGE,
  DELETE_EVENT_WARNING_MESSAGE,
  closeChallenge,
  deleteChallengeCascade,
  setActiveChallenge,
  setChallengeArchivedStatus,
} from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireSessionUser } from "@/lib/auth";
import { getUserAccessibleChallenges, requireAccessBeforeClosure, requireChallengeAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

const databaseUrl = process.env.DATABASE_URL;
const hasDatabaseUrl = (() => {
  if (!databaseUrl) return false;
  try {
    new URL(databaseUrl);
    return true;
  } catch {
    return false;
  }
})();

async function activateEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await requireChallengeAccess(user, id);

  try {
    await setActiveChallenge(id);
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_ACTIVATION_ERROR) {
      redirect("/events?message=archived");
    }
    throw error;
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/swimmers");
  revalidatePath("/sheets/new");
}

async function toggleArchiveEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const id = String(formData.get("id") || "").trim();
  const currentValue = String(formData.get("isArchived") || "").trim();
  if (!id) return;

  await requireChallengeAccess(user, id);

  try {
    await setChallengeArchivedStatus(id, currentValue !== "true");
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_READ_ONLY_MESSAGE) {
      redirect("/events?message=readonly");
    }
    throw error;
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/swimmers");
  revalidatePath("/sheets/new");
}


async function closeEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await requireChallengeAccess(user, id);

  try {
    await closeChallenge(id);
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_READ_ONLY_MESSAGE) {
      redirect("/events?message=readonly");
    }
    throw error;
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/swimmers");
  revalidatePath("/sheets");
  revalidatePath("/sheets/new");
  revalidatePath("/public");
}

async function deleteEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await requireChallengeAccess(user, id);

  try {
    await deleteChallengeCascade(id);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === ARCHIVED_DELETE_ERROR) {
        redirect("/events?message=delete-archived");
      }
      if (error.message === ACTIVE_DELETE_ERROR) {
        redirect("/events?message=delete-active");
      }
    }
    throw error;
  }

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/swimmers");
  revalidatePath("/sheets");
  revalidatePath("/sheets/new");
  revalidatePath("/public");
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: { message?: string };
}) {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Événements</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la gestion des événements.
        </div>
      </div>
    );
  }

  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);

  const [events, distanceByChallenge] = await Promise.all([
    getUserAccessibleChallenges(user),
    prisma.sheetEntry.groupBy({
      by: ["sheetId"],
      _sum: { distanceM: true },
    }),
  ]);

  const allowedIds = new Set(events.map((event) => event.id));
  const sheetMap = new Map(distanceByChallenge.map((entry) => [entry.sheetId, entry._sum.distanceM ?? 0]));
  const sheets = await prisma.sheet.findMany({ select: { id: true, challengeId: true } });
  const totals = new Map<string, number>();

  for (const sheet of sheets) {
    if (!allowedIds.has(sheet.challengeId)) continue;
    totals.set(sheet.challengeId, (totals.get(sheet.challengeId) ?? 0) + (sheetMap.get(sheet.id) ?? 0));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackToMainMenuLink />
        <LogoutButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Événements</h1>
          <p className="text-slate-600">Liste, activation et archivage des événements.</p>
        </div>
        {user.isSuperUser ? (
          <Link href="/events/new" className="rounded bg-blue-600 px-4 py-2 text-white">
            Nouvel événement
          </Link>
        ) : null}
      </div>

      {searchParams?.message === "archived" ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {ARCHIVED_ACTIVATION_ERROR}
        </div>
      ) : null}

      {searchParams?.message === "readonly" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {ARCHIVED_READ_ONLY_MESSAGE}
        </div>
      ) : null}

      {searchParams?.message === "delete-archived" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{ARCHIVED_DELETE_ERROR}</div>
      ) : null}

      {searchParams?.message === "delete-active" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{ACTIVE_DELETE_ERROR}</div>
      ) : null}

      {searchParams?.message === "closed" ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Événement clôturé. Il est maintenant en consultation.
        </div>
      ) : null}

      {searchParams?.message === "forbidden" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Accès refusé à cet événement.</div>
      ) : null}

      {searchParams?.message === "forbidden-create" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Accès refusé : seuls les super utilisateurs peuvent créer un événement.
        </div>
      ) : null}

      {searchParams?.message === "saved" ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Événement enregistré. Retour sur la liste.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Date</th>
              <th className="p-3">Début</th>
              <th className="p-3">Durée</th>
              <th className="p-3">Tournées</th>
              <th className="p-3">Lignes 25 m</th>
              <th className="p-3">Lignes 50 m</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Distance totale</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              return (
                <tr key={event.id} className="border-t align-top">
                  <td className="p-3 font-medium">{event.name}</td>
                  <td className="p-3">{event.eventDate.toLocaleDateString("fr-FR")}</td>
                  <td className="p-3">{event.startTime}</td>
                  <td className="p-3">{event.durationMinutes} min</td>
                  <td className="p-3">{event.roundsCount}</td>
                  <td className="p-3">{event.lanes25Count}</td>
                  <td className="p-3">{event.lanes50Count}</td>
                  <td className="p-3">
                    {event.isArchived ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Archivé</span>
                    ) : event.closedAt ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">Clôturé</span>
                    ) : event.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Actif</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">Inactif</span>
                    )}
                  </td>
                  <td className="p-3">{(totals.get(event.id) ?? 0).toLocaleString("fr-FR")} m</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/events/${event.id}`} className="rounded border px-3 py-1 hover:bg-slate-100">
                        Ouvrir
                      </Link>
                      {event.isActive ? (
                        <span className="rounded bg-emerald-100 px-3 py-1 text-emerald-800">Actif</span>
                      ) : !event.isArchived ? (
                        <form action={activateEvent}>
                          <input type="hidden" name="id" value={event.id} />
                          <button
                            type="submit"
                            className="rounded bg-emerald-600 px-3 py-1 text-white"
                          >
                            Activer
                          </button>
                        </form>
                      ) : null}
                      {!event.isArchived && !event.closedAt ? (
                        <form action={closeEvent}>
                          <input type="hidden" name="id" value={event.id} />
                          <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">
                            Clôturer l&apos;événement
                          </button>
                        </form>
                      ) : null}
                      <form action={toggleArchiveEvent}>
                        <input type="hidden" name="id" value={event.id} />
                        <input type="hidden" name="isArchived" value={String(event.isArchived)} />
                        <button type="submit" className="rounded bg-slate-700 px-3 py-1 text-white">
                          {event.isArchived ? "Désarchiver" : "Archiver"}
                        </button>
                      </form>
                      {!event.isArchived ? (
                        <form action={deleteEvent}>
                          <input type="hidden" name="id" value={event.id} />
                          <DeleteEventButton warningMessage={DELETE_EVENT_WARNING_MESSAGE} disabled={event.isActive} />
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
