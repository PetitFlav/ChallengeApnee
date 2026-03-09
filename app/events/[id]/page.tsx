import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buildRoundDefinitions, regenerateEventStructure, sanitizeStartTime } from "@/lib/challenge";
import { ARCHIVED_READ_ONLY_MESSAGE, assertChallengeWritable, setActiveChallenge } from "@/lib/events";
import { prisma } from "@/lib/prisma";

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

async function saveEventConfiguration(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const challengeId = String(formData.get("id") || "").trim();
  if (!challengeId) return;

  const name = String(formData.get("name") || "").trim() || "Challenge Apnée";
  const eventDateRaw = String(formData.get("eventDate") || "").trim();
  const startTime = sanitizeStartTime(String(formData.get("startTime") || "09:30").trim());
  const durationMinutes = Math.max(30, Number.parseInt(String(formData.get("durationMinutes") || "120"), 10) || 120);
  const roundsCount = Math.max(1, Number.parseInt(String(formData.get("roundsCount") || "4"), 10) || 4);
  const lanes25Count = Math.max(0, Number.parseInt(String(formData.get("lanes25Count") || "0"), 10) || 0);
  const lanes50Count = Math.max(0, Number.parseInt(String(formData.get("lanes50Count") || "0"), 10) || 0);
  const shouldActivate = Boolean(formData.get("isActive"));

  if (lanes25Count === 0 && lanes50Count === 0) {
    redirect(`/events/${challengeId}?error=no-lanes`);
  }

  const eventDate = eventDateRaw ? new Date(`${eventDateRaw}T00:00:00`) : new Date();

  try {
    await assertChallengeWritable(challengeId);

    await regenerateEventStructure(prisma, challengeId, {
      name,
      eventDate,
      startTime,
      durationMinutes,
      roundsCount,
      lanes25Count,
      lanes50Count,
    });

    if (shouldActivate) {
      await setActiveChallenge(challengeId);
    }

    revalidatePath(`/events/${challengeId}`);
    revalidatePath("/events");
    revalidatePath("/swimmers");
    revalidatePath("/sheets/new");
    revalidatePath("/dashboard");

    redirect("/events?message=saved");
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_READ_ONLY_MESSAGE) {
      redirect(`/events/${challengeId}?error=archived`);
    }
    throw error;
  }
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Configuration événement</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la configuration.
        </div>
      </div>
    );
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  if (!challenge) notFound();

  const eventDate = challenge.eventDate.toISOString().slice(0, 10);
  const noLanesError = searchParams?.error === "no-lanes";
  const archivedError = searchParams?.error === "archived";
  const roundPreview =
    challenge.rounds.length > 0
      ? challenge.rounds.map((round) => ({ label: round.label, scheduledTime: round.scheduledTime }))
      : buildRoundDefinitions(challenge.startTime, challenge.durationMinutes, challenge.roundsCount).map((round) => ({
          label: round.label,
          scheduledTime: round.scheduledTime,
        }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Configurer un événement</h1>
        <p className="text-slate-600">Modifiez puis régénérez lignes et tournées.</p>
      </div>

      {challenge.isArchived ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {ARCHIVED_READ_ONLY_MESSAGE}
        </div>
      ) : null}

      {archivedError ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{ARCHIVED_READ_ONLY_MESSAGE}</div>
      ) : null}

      <form action={saveEventConfiguration} className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <input type="hidden" name="id" value={challenge.id} />
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nom</span>
          <input name="name" defaultValue={challenge.name} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Date</span>
          <input type="date" name="eventDate" defaultValue={eventDate} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Heure de début</span>
          <input type="time" name="startTime" defaultValue={challenge.startTime} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Durée (minutes)</span>
          <input type="number" name="durationMinutes" min={30} defaultValue={challenge.durationMinutes} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de tournées</span>
          <input type="number" name="roundsCount" min={1} defaultValue={challenge.roundsCount} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 25m</span>
          <input type="number" name="lanes25Count" min={0} defaultValue={challenge.lanes25Count} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 50m</span>
          <input type="number" name="lanes50Count" min={0} defaultValue={challenge.lanes50Count} required disabled={challenge.isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked={challenge.isActive} disabled={challenge.isArchived} />
          <span className="text-sm text-slate-700">Définir comme événement actif</span>
        </label>

        {noLanesError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            Aucun bassin configuré. Renseignez au moins une ligne 25m ou 50m.
          </div>
        ) : null}

        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-2">
          <p className="font-medium text-slate-700">Tournées configurées</p>
          <ul className="space-y-1 text-slate-600">
            {roundPreview.map((round) => (
              <li key={round.label}>
                {round.label} — {round.scheduledTime}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="submit" disabled={challenge.isArchived} className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            Enregistrer
          </button>
          <Link href="/events" className="rounded border px-4 py-2 text-slate-700 hover:bg-slate-100">
            Retour à la liste des événements
          </Link>
        </div>
      </form>
    </div>
  );
}
