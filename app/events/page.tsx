import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ensureActiveChallenge, setActiveChallenge } from "@/lib/events";
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

async function activateEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  await setActiveChallenge(id);

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/swimmers");
  revalidatePath("/sheets/new");
}

export default async function EventsPage() {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Événements</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la gestion des événements.
        </div>
      </div>
    );
  }

  await ensureActiveChallenge();

  const [events, distanceByChallenge] = await Promise.all([
    prisma.challenge.findMany({
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        eventDate: true,
        startTime: true,
        durationMinutes: true,
        roundsCount: true,
        lanes25Count: true,
        lanes50Count: true,
        isActive: true,
      },
    }),
    prisma.sheetEntry.groupBy({
      by: ["sheetId"],
      _sum: { distanceM: true },
    }),
  ]);

  const sheetMap = new Map(distanceByChallenge.map((entry) => [entry.sheetId, entry._sum.distanceM ?? 0]));
  const sheets = await prisma.sheet.findMany({ select: { id: true, challengeId: true } });
  const totals = new Map<string, number>();

  for (const sheet of sheets) {
    totals.set(sheet.challengeId, (totals.get(sheet.challengeId) ?? 0) + (sheetMap.get(sheet.id) ?? 0));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Événements</h1>
          <p className="text-slate-600">Liste et activation des événements.</p>
        </div>
        <Link href="/events/new" className="rounded bg-blue-600 px-4 py-2 text-white">
          Nouvel événement
        </Link>
      </div>

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
            {events.map((event) => (
              <tr key={event.id} className="border-t align-top">
                <td className="p-3 font-medium">{event.name}</td>
                <td className="p-3">{event.eventDate.toLocaleDateString("fr-FR")}</td>
                <td className="p-3">{event.startTime}</td>
                <td className="p-3">{event.durationMinutes} min</td>
                <td className="p-3">{event.roundsCount}</td>
                <td className="p-3">{event.lanes25Count}</td>
                <td className="p-3">{event.lanes50Count}</td>
                <td className="p-3">{event.isActive ? "Actif" : "Inactif"}</td>
                <td className="p-3">{(totals.get(event.id) ?? 0).toLocaleString("fr-FR")} m</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Link href={`/events/${event.id}`} className="rounded border px-3 py-1 hover:bg-slate-100">
                      Ouvrir
                    </Link>
                    {!event.isActive ? (
                      <form action={activateEvent}>
                        <input type="hidden" name="id" value={event.id} />
                        <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-white">
                          Activer
                        </button>
                      </form>
                    ) : (
                      <span className="rounded bg-emerald-100 px-3 py-1 text-emerald-800">Actif</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
