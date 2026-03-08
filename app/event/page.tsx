import { revalidatePath } from "next/cache";
import { buildLaneDefinitions, buildRoundDefinitions, regenerateEventStructure, sanitizeStartTime } from "@/lib/challenge";
import { DEFAULT_CHALLENGE_ID } from "@/lib/constants";
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

async function ensureDefaultChallenge() {
  return prisma.challenge.upsert({
    where: { id: DEFAULT_CHALLENGE_ID },
    update: {},
    create: {
      id: DEFAULT_CHALLENGE_ID,
      name: "Challenge Apnée V1",
      eventDate: new Date(),
      startTime: "09:30",
      durationMinutes: 120,
      roundsCount: 4,
      lanes25Count: 4,
      lanes50Count: 6,
    },
  });
}

async function saveEventConfiguration(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const challenge = await ensureDefaultChallenge();
  const name = String(formData.get("name") || "").trim() || "Challenge Apnée V1";
  const eventDateRaw = String(formData.get("eventDate") || "").trim();
  const startTime = sanitizeStartTime(String(formData.get("startTime") || "09:30").trim());
  const durationMinutes = Math.max(30, Number.parseInt(String(formData.get("durationMinutes") || "120"), 10) || 120);
  const roundsCount = Math.max(1, Number.parseInt(String(formData.get("roundsCount") || "4"), 10) || 4);
  const lanes25Count = Math.max(0, Number.parseInt(String(formData.get("lanes25Count") || "4"), 10) || 4);
  const lanes50Count = Math.max(0, Number.parseInt(String(formData.get("lanes50Count") || "6"), 10) || 6);

  const eventDate = eventDateRaw ? new Date(`${eventDateRaw}T00:00:00`) : new Date();

  await regenerateEventStructure(prisma, challenge.id, {
    name,
    eventDate,
    startTime,
    durationMinutes,
    roundsCount,
    lanes25Count,
    lanes50Count,
  });

  revalidatePath("/event");
  revalidatePath("/sheets/new");
  revalidatePath("/dashboard");
}

export default async function EventPage() {
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

  const challenge = await ensureDefaultChallenge();
  const eventDate = challenge.eventDate.toISOString().slice(0, 10);
  const generatedLanes = buildLaneDefinitions(challenge.lanes25Count, challenge.lanes50Count);
  const generatedRounds = buildRoundDefinitions(challenge.startTime, challenge.durationMinutes, challenge.roundsCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Configuration événement</h1>
        <p className="text-slate-600">Configurez l’événement puis générez automatiquement lignes et tournées.</p>
      </div>

      <form action={saveEventConfiguration} className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nom</span>
          <input name="name" defaultValue={challenge.name} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Date</span>
          <input type="date" name="eventDate" defaultValue={eventDate} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Heure de début</span>
          <input type="time" name="startTime" defaultValue={challenge.startTime} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Durée (minutes)</span>
          <input
            type="number"
            name="durationMinutes"
            min={30}
            defaultValue={challenge.durationMinutes}
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de tournées</span>
          <input type="number" name="roundsCount" min={1} defaultValue={challenge.roundsCount} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 25m</span>
          <input type="number" name="lanes25Count" min={0} defaultValue={challenge.lanes25Count} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 50m</span>
          <input type="number" name="lanes50Count" min={0} defaultValue={challenge.lanes50Count} required className="w-full rounded border p-2" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
            Enregistrer et régénérer
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h2 className="mb-2 text-lg font-medium">Lignes générées</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {generatedLanes.map((lane) => (
              <li key={lane.code}>
                {lane.code} — {lane.distanceM} m
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="mb-2 text-lg font-medium">Tournées générées</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {generatedRounds.map((round) => (
              <li key={round.roundNumber}>
                {round.label} — {round.scheduledTime}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
