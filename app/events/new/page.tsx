import { redirect } from "next/navigation";
import { buildRoundDefinitions, regenerateEventStructure, sanitizeStartTime } from "@/lib/challenge";
import { createDefaultEvent, setActiveChallenge } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EVENT_TIMEZONE } from "@/lib/constants";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";

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

async function createEvent(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const name = String(formData.get("name") || "").trim() || "Challenge Apnée";
  const eventDateRaw = String(formData.get("eventDate") || "").trim();
  const startTime = sanitizeStartTime(String(formData.get("startTime") || "09:30").trim());
  const timezone = String(formData.get("timezone") || DEFAULT_EVENT_TIMEZONE).trim() || DEFAULT_EVENT_TIMEZONE;
  const parsedDurationMinutes = Number.parseInt(String(formData.get("durationMinutes") || "120"), 10);
  const durationMinutes = Number.isNaN(parsedDurationMinutes) ? 120 : parsedDurationMinutes;
  const parsedRoundsCount = Number.parseInt(String(formData.get("roundsCount") || "4"), 10);
  const roundsCount = Number.isNaN(parsedRoundsCount) ? 4 : parsedRoundsCount;
  const lanes25Count = Math.max(0, Number.parseInt(String(formData.get("lanes25Count") || "0"), 10) || 0);
  const lanes50Count = Math.max(0, Number.parseInt(String(formData.get("lanes50Count") || "0"), 10) || 0);
  const shouldActivate = Boolean(formData.get("isActive"));

  if (durationMinutes <= 1) {
    redirect("/events/new?error=duration");
  }

  if (roundsCount < 1) {
    redirect("/events/new?error=rounds");
  }

  if (lanes25Count === 0 && lanes50Count === 0) {
    redirect("/events/new?error=no-lanes");
  }

  const eventDate = eventDateRaw ? new Date(`${eventDateRaw}T00:00:00`) : new Date();

  const challenge = await createDefaultEvent({ active: false });

  await regenerateEventStructure(prisma, challenge.id, {
    name,
    eventDate,
    startTime,
    timezone,
    durationMinutes,
    roundsCount,
    lanes25Count,
    lanes50Count,
  });

  if (shouldActivate) {
    await setActiveChallenge(challenge.id);
  }

  redirect(`/events/${challenge.id}`);
}

export default function NewEventPage({ searchParams }: { searchParams?: { error?: string } }) {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Nouvel événement</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la gestion des événements.
        </div>
      </div>
    );
  }

  const roundPreview = buildRoundDefinitions("09:30", 120, 4);
  const noLanesError = searchParams?.error === "no-lanes";
  const durationError = searchParams?.error === "duration";
  const roundsError = searchParams?.error === "rounds";

  return (
    <div className="space-y-6">
      <BackToMainMenuLink />
      <div>
        <h1 className="text-3xl font-semibold">Nouvel événement</h1>
        <p className="text-slate-600">Créez un événement avec sa configuration initiale.</p>
      </div>

      <form action={createEvent} className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nom</span>
          <input name="name" required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Date</span>
          <input type="date" name="eventDate" required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Heure de début</span>
          <input type="time" name="startTime" defaultValue="09:30" required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Fuseau horaire (IANA)</span>
          <input name="timezone" defaultValue={DEFAULT_EVENT_TIMEZONE} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Durée (minutes)</span>
          <input type="number" name="durationMinutes" min={2} defaultValue={120} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de tournées</span>
          <input type="number" name="roundsCount" min={1} defaultValue={4} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 25m</span>
          <input type="number" name="lanes25Count" min={0} defaultValue={0} required className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Nombre de lignes 50m</span>
          <input type="number" name="lanes50Count" min={0} defaultValue={0} required className="w-full rounded border p-2" />
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked />
          <span className="text-sm text-slate-700">Activer cet événement après création</span>
        </label>

        {noLanesError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            Aucun bassin configuré. Renseignez au moins une ligne 25m ou 50m.
          </div>
        ) : null}

        {durationError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            La durée doit être supérieure à 1 minute.
          </div>
        ) : null}

        {roundsError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            Le nombre de tournées doit être supérieur ou égal à 1.
          </div>
        ) : null}

        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-2">
          <p className="font-medium text-slate-700">Tournées prévues (exemple)</p>
          <ul className="space-y-1 text-slate-600">
            {roundPreview.map((round) => (
              <li key={round.roundNumber}>
                {round.label} — {round.scheduledTime}
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}
