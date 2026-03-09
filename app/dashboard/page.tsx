import { requireSessionUser } from "@/lib/auth";
import { requireActiveChallengeForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
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

export default async function DashboardPage() {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer le dashboard.
        </div>
      </div>
    );
  }

  try {
    const user = await requireSessionUser();
    const challenge = await requireActiveChallengeForUser(user);

    const [total, validatedSheetsCount] = await Promise.all([
      prisma.sheetEntry.aggregate({
        where: { sheet: { challengeId: challenge.id } },
        _sum: { distanceM: true },
      }),
      prisma.sheet.count({
        where: { challengeId: challenge.id, status: "VALIDATED" },
      }),
    ]);

    const distanceM = total._sum.distanceM ?? 0;
    const distanceKm = distanceM / 1000;

    return (
      <div className="space-y-6">
        <BackToMainMenuLink />
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-slate-600">Vue événement et cumul des distances.</p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded border bg-white p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Événement</h2>
            <p className="mt-2 text-xl font-semibold text-slate-900">{challenge.name}</p>
            <p className="text-slate-600">
              {challenge.eventDate.toLocaleDateString("fr-FR")} · début {challenge.startTime} · durée {challenge.durationMinutes} min
            </p>
            <p className="text-slate-600">
              {challenge.roundsCount} tournées · {challenge.lanes25Count} lignes 25m · {challenge.lanes50Count} lignes 50m
            </p>
          </article>

          <article className="rounded border bg-white p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Total événement</h2>
            <p className="mt-2 text-3xl font-bold text-blue-700">{distanceM.toLocaleString("fr-FR")} m</p>
            <p className="text-slate-700">{distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km</p>
            <p className="mt-2 text-sm text-slate-600">Feuilles validées : {validatedSheetsCount}</p>
          </article>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Impossible de se connecter à la base de données. Vérifiez DATABASE_URL.
        </div>
      </div>
    );
  }
}
