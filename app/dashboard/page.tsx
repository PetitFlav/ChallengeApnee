import { requireSessionUser } from "@/lib/auth";
import { requireActiveChallengeForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import {
  compareSheetAndVerification,
  countComparisonDifferences,
  getDashboardVerificationStatus,
  type DashboardSwimmerStatus,
} from "@/lib/verification";
import { VerificationDashboard } from "./verification-dashboard";

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

    const [total, validatedSheetsCount, rounds] = await Promise.all([
      prisma.sheetEntry.aggregate({
        where: { sheet: { challengeId: challenge.id } },
        _sum: { distanceM: true },
      }),
      prisma.sheet.count({
        where: { challengeId: challenge.id, status: "VALIDATED" },
      }),
      prisma.round.findMany({
        where: { challengeId: challenge.id },
        orderBy: [{ displayOrder: "asc" }, { roundNumber: "asc" }],
        select: {
          id: true,
          label: true,
          sheets: {
            select: {
              id: true,
              lane: { select: { id: true, code: true, distanceM: true } },
              entries: {
                select: {
                  swimmer: {
                    select: {
                      id: true,
                      number: true,
                      firstName: true,
                      lastName: true,
                      club: { select: { name: true } },
                      section: { select: { name: true } },
                    },
                  },
                  squares: true,
                  ticks: true,
                  distanceM: true,
                },
              },
              verifications: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  userId: true,
                  lines: {
                    select: {
                      swimmer: {
                        select: {
                          id: true,
                          number: true,
                          firstName: true,
                          lastName: true,
                          club: { select: { name: true } },
                          section: { select: { name: true } },
                        },
                      },
                      squares: true,
                      ticks: true,
                      distanceM: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const verificationRounds = rounds.map((round) => {
      const lanes = round.sheets.map((sheet) => {
        const latestVerification = sheet.verifications[0] ?? null;

        const originalLines = sheet.entries.map((entry) => ({
          swimmerNumber: entry.swimmer.number,
          squares: entry.squares,
          ticks: entry.ticks,
        }));

        const verificationLines = latestVerification
          ? latestVerification.lines.map((line) => ({ swimmerNumber: line.swimmer.number, squares: line.squares, ticks: line.ticks }))
          : null;

        const differencesCount = verificationLines ? countComparisonDifferences(compareSheetAndVerification(originalLines, verificationLines)) : 0;

        const entryBySwimmer = new Map(
          sheet.entries.map((entry) => [entry.swimmer.id, entry]),
        );

        const verificationLineBySwimmer = new Map(
          (latestVerification?.lines ?? []).map((line) => [line.swimmer.id, line]),
        );

        const swimmerIds = new Set<string>([...entryBySwimmer.keys(), ...verificationLineBySwimmer.keys()]);

        const swimmers = Array.from(swimmerIds)
          .map((swimmerId) => {
            const entry = entryBySwimmer.get(swimmerId);
            const verificationLine = verificationLineBySwimmer.get(swimmerId);
            const swimmer = entry?.swimmer ?? verificationLine?.swimmer;

            if (!swimmer) {
              return null;
            }

            let status: DashboardSwimmerStatus = "OK";
            if (!verificationLine) status = "Absent en vérification";
            else if (!entry) status = "Ajouté en vérification";
            else if (entry.squares !== verificationLine.squares || entry.ticks !== verificationLine.ticks) status = "Différence";

            const enteredDistanceM = entry?.distanceM ?? 0;
            const verifiedDistanceM = verificationLine?.distanceM ?? 0;

            return {
              swimmerKey: `${sheet.id}-${swimmer.id}`,
              swimmerNumber: swimmer.number,
              lastName: swimmer.lastName,
              firstName: swimmer.firstName,
              club: swimmer.club?.name ?? "-",
              section: swimmer.section?.name ?? "-",
              enteredDistanceM,
              verifiedDistanceM,
              differenceM: verifiedDistanceM - enteredDistanceM,
              status,
            };
          })
          .filter((swimmer): swimmer is NonNullable<typeof swimmer> => swimmer !== null)
          .sort((a, b) => a.swimmerNumber - b.swimmerNumber);

        return {
          laneId: sheet.lane.id,
          laneCode: sheet.lane.code,
          distanceM: sheet.lane.distanceM,
          swimmersCount: sheet.entries.length,
          verificationsCount: sheet.verifications.length,
          differencesCount,
          status: getDashboardVerificationStatus({
            sheetsCount: 1,
            verifiedSheetsCount: latestVerification ? 1 : 0,
            differencesCount,
          }),
          swimmers,
        };
      });

      const verificationsCount = round.sheets.reduce((sum, sheet) => sum + sheet.verifications.length, 0);
      const verifiersCount = new Set(round.sheets.flatMap((sheet) => sheet.verifications.map((verification) => verification.userId))).size;
      const differencesCount = lanes.reduce((sum, lane) => sum + lane.differencesCount, 0);
      const verifiedSheetsCount = round.sheets.filter((sheet) => sheet.verifications.length > 0).length;

      return {
        roundId: round.id,
        roundLabel: round.label,
        lanesCount: round.sheets.length,
        verificationsCount,
        verifiersCount,
        differencesCount,
        status: getDashboardVerificationStatus({
          sheetsCount: round.sheets.length,
          verifiedSheetsCount,
          differencesCount,
        }),
        lanes,
      };
    });

    const distanceM = total._sum.distanceM ?? 0;
    const distanceKm = distanceM / 1000;

    return (
      <div className="space-y-6">
        <BackToMainMenuLink />
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-slate-600">Vue événement, cumul des distances et contrôle des vérifications.</p>
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

        <VerificationDashboard rounds={verificationRounds} />
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
