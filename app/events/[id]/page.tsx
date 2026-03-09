import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { regenerateEventStructure, sanitizeStartTime } from "@/lib/challenge";
import { setActiveChallenge } from "@/lib/events";
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
  const lanes25Count = Math.max(0, Number.parseInt(String(formData.get("lanes25Count") || "4"), 10) || 4);
  const lanes50Count = Math.max(0, Number.parseInt(String(formData.get("lanes50Count") || "6"), 10) || 6);
  const shouldActivate = Boolean(formData.get("isActive"));

  const eventDate = eventDateRaw ? new Date(`${eventDateRaw}T00:00:00`) : new Date();

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
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
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

  const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!challenge) notFound();

  const eventDate = challenge.eventDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Configurer un événement</h1>
        <p className="text-slate-600">Modifiez puis régénérez lignes et tournées.</p>
      </div>

      <form action={saveEventConfiguration} className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <input type="hidden" name="id" value={challenge.id} />
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
          <input type="number" name="durationMinutes" min={30} defaultValue={challenge.durationMinutes} required className="w-full rounded border p-2" />
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
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked={challenge.isActive} />
          <span className="text-sm text-slate-700">Définir comme événement actif</span>
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
