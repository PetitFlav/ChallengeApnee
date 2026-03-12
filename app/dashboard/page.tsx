import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth";
import { requireChallengeForModule, requireModuleAccess } from "@/lib/access";
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
  const user = await requireSessionUser();
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
    await requireModuleAccess(user, "dashboard");
    const challenge = await requireChallengeForModule(user);

    async function saveFinalResult(formData: FormData) {
      "use server";

      const user = await requireSessionUser();
      await requireModuleAccess(user, "dashboard");
      const challenge = await requireChallengeForModule(user);

      const sheetId = String(formData.get("sheetId") ?? "");
      const roundId = String(formData.get("roundId") ?? "");
      const laneId = String(formData.get("laneId") ?? "");
      const swimmerId = String(formData.get("swimmerId") ?? "");
      const source = String(formData.get("source") ?? "");
      const sourceVerificationId = formData.get("sourceVerificationId") ? String(formData.get("sourceVerificationId")) : null;
      const sourceVerificationLineId = formData.get("sourceVerificationLineId") ? String(formData.get("sourceVerificationLineId")) : null;
      const sourceSheetEntryId = formData.get("sourceSheetEntryId") ? String(formData.get("sourceSheetEntryId")) : null;
      const squares = Number(formData.get("squares") ?? 0);
      const ticks = Number(formData.get("ticks") ?? 0);
      const totalLengths = Number(formData.get("totalLengths") ?? 0);
      const distanceM = Number(formData.get("distanceM") ?? 0);

      if (!sheetId || !roundId || !laneId || !swimmerId) return;
      if (source !== "original" && source !== "verification" && source !== "manual") return;

      const swimmer = await prisma.swimmer.findFirst({
        where: { id: swimmerId, challengeId: challenge.id },
        select: { clubId: true, sectionId: true },
      });

      if (!swimmer) return;

      await prisma.finalResult.upsert({
        where: {
          challengeId_roundId_laneId_swimmerId: {
            challengeId: challenge.id,
            roundId,
            laneId,
            swimmerId,
          },
        },
        update: {
          sheetId,
          clubId: swimmer.clubId,
          sectionId: swimmer.sectionId,
          source,
          sourceVerificationId,
          sourceVerificationLineId,
          sourceSheetEntryId,
          squares,
          ticks,
          totalLengths,
          distanceM,
          validatedByUserId: user.id,
          validatedAt: new Date(),
        },
        create: {
          challengeId: challenge.id,
          roundId,
          laneId,
          sheetId,
          swimmerId,
          clubId: swimmer.clubId,
          sectionId: swimmer.sectionId,
          source,
          sourceVerificationId,
          sourceVerificationLineId,
          sourceSheetEntryId,
          squares,
          ticks,
          totalLengths,
          distanceM,
          validatedByUserId: user.id,
        },
      });

      revalidatePath("/dashboard");
    }

    async function transferConformingLines() {
      "use server";

      const user = await requireSessionUser();
      await requireModuleAccess(user, "dashboard");
      const challenge = await requireChallengeForModule(user);

      const sheets = await prisma.sheet.findMany({
        where: { challengeId: challenge.id },
        select: {
          id: true,
          roundId: true,
          laneId: true,
          entries: {
            select: {
              id: true,
              swimmerId: true,
              squares: true,
              ticks: true,
              totalLengths: true,
              distanceM: true,
              swimmer: { select: { clubId: true, sectionId: true } },
            },
          },
          verifications: {
            select: {
              lines: {
                select: {
                  id: true,
                  verificationId: true,
                  swimmerId: true,
                  squares: true,
                  ticks: true,
                  totalLengths: true,
                  distanceM: true,
                },
              },
            },
          },
        },
      });

      const upserts: Array<ReturnType<typeof prisma.finalResult.upsert>> = [];

      for (const sheet of sheets) {
        const verificationLinesBySwimmer = new Map<string, Array<(typeof sheet.verifications)[number]["lines"][number]>>();

        for (const verification of sheet.verifications) {
          for (const line of verification.lines) {
            const existing = verificationLinesBySwimmer.get(line.swimmerId) ?? [];
            existing.push(line);
            verificationLinesBySwimmer.set(line.swimmerId, existing);
          }
        }

        for (const entry of sheet.entries) {
          const verificationLines = verificationLinesBySwimmer.get(entry.swimmerId) ?? [];

          if (verificationLines.length === 0) {
            continue;
          }

          const allConforming = verificationLines.every(
            (line) => line.squares === entry.squares && line.ticks === entry.ticks,
          );

          if (!allConforming) {
            continue;
          }

          const firstVerificationLine = verificationLines[0] ?? null;

          upserts.push(
            prisma.finalResult.upsert({
              where: {
                challengeId_roundId_laneId_swimmerId: {
                  challengeId: challenge.id,
                  roundId: sheet.roundId,
                  laneId: sheet.laneId,
                  swimmerId: entry.swimmerId,
                },
              },
              update: {
                sheetId: sheet.id,
                clubId: entry.swimmer.clubId,
                sectionId: entry.swimmer.sectionId,
                source: "original",
                sourceVerificationId: firstVerificationLine?.verificationId ?? null,
                sourceVerificationLineId: firstVerificationLine?.id ?? null,
                sourceSheetEntryId: entry.id,
                squares: entry.squares,
                ticks: entry.ticks,
                totalLengths: entry.totalLengths,
                distanceM: entry.distanceM,
                validatedByUserId: user.id,
                validatedAt: new Date(),
              },
              create: {
                challengeId: challenge.id,
                roundId: sheet.roundId,
                laneId: sheet.laneId,
                sheetId: sheet.id,
                swimmerId: entry.swimmerId,
                clubId: entry.swimmer.clubId,
                sectionId: entry.swimmer.sectionId,
                source: "original",
                sourceVerificationId: firstVerificationLine?.verificationId ?? null,
                sourceVerificationLineId: firstVerificationLine?.id ?? null,
                sourceSheetEntryId: entry.id,
                squares: entry.squares,
                ticks: entry.ticks,
                totalLengths: entry.totalLengths,
                distanceM: entry.distanceM,
                validatedByUserId: user.id,
              },
            }),
          );
        }
      }

      if (upserts.length > 0) {
        await prisma.$transaction(upserts);
      }

      revalidatePath("/dashboard");
    }

    const [sheetEntries, validatedSheetsCount, rounds, finalResults] = await Promise.all([
      prisma.sheetEntry.findMany({
        where: { sheet: { challengeId: challenge.id } },
        select: {
          swimmerId: true,
          distanceM: true,
          sheet: { select: { roundId: true, laneId: true } },
        },
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
                  id: true,
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
                  totalLengths: true,
                  distanceM: true,
                },
              },
              verifications: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  userId: true,
                  createdAt: true,
                  user: { select: { firstName: true, lastName: true } },
                  lines: {
                    select: {
                      id: true,
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
                      totalLengths: true,
                      distanceM: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.finalResult.findMany({
        where: { challengeId: challenge.id },
        select: {
          roundId: true,
          laneId: true,
          swimmerId: true,
          source: true,
          sourceVerificationId: true,
          sourceVerificationLineId: true,
          sourceSheetEntryId: true,
          squares: true,
          ticks: true,
          totalLengths: true,
          distanceM: true,
          validatedAt: true,
          validatedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const initialDistanceByKey = new Map(
      sheetEntries.map((entry) => [`${entry.sheet.roundId}-${entry.sheet.laneId}-${entry.swimmerId}`, entry.distanceM]),
    );
    const finalDistanceByKey = new Map(finalResults.map((result) => [`${result.roundId}-${result.laneId}-${result.swimmerId}`, result.distanceM]));

    const allLineKeys = new Set([...initialDistanceByKey.keys(), ...finalDistanceByKey.keys()]);

    let distanceM = 0;
    for (const key of allLineKeys) {
      distanceM += finalDistanceByKey.get(key) ?? initialDistanceByKey.get(key) ?? 0;
    }

    const finalResultByKey = new Map(
      finalResults.map((result) => [
        `${result.roundId}-${result.laneId}-${result.swimmerId}`,
        {
          ...result,
          validatedAtLabel: result.validatedAt.toLocaleString("fr-FR"),
          validatedByName: `${result.validatedBy.firstName} ${result.validatedBy.lastName}`,
        },
      ]),
    );

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

        const entryBySwimmer = new Map(sheet.entries.map((entry) => [entry.swimmer.id, entry]));
        const allVerificationLinesBySwimmer = new Map<string, Array<(typeof sheet.verifications)[number]["lines"][number] & {
          verificationId: string;
          verifierName: string;
          createdAtLabel: string;
        }>>();

        for (const verification of sheet.verifications) {
          for (const line of verification.lines) {
            const existing = allVerificationLinesBySwimmer.get(line.swimmer.id) ?? [];
            existing.push({
              ...line,
              verificationId: verification.id,
              verifierName: `${verification.user.firstName} ${verification.user.lastName}`,
              createdAtLabel: verification.createdAt.toLocaleString("fr-FR"),
            });
            allVerificationLinesBySwimmer.set(line.swimmer.id, existing);
          }
        }

        const latestVerificationLineBySwimmer = new Map((latestVerification?.lines ?? []).map((line) => [line.swimmer.id, line]));

        const swimmerIds = new Set<string>([...entryBySwimmer.keys(), ...latestVerificationLineBySwimmer.keys()]);

        const swimmers = Array.from(swimmerIds)
          .map((swimmerId) => {
            const entry = entryBySwimmer.get(swimmerId);
            const verificationLine = latestVerificationLineBySwimmer.get(swimmerId);
            const swimmer = entry?.swimmer ?? verificationLine?.swimmer;

            if (!swimmer) {
              return null;
            }

            let status: DashboardSwimmerStatus = "OK";
            if (!verificationLine) status = "Absent en vérification";
            else if (!entry) status = "Ajouté en vérification";
            else if (entry.squares !== verificationLine.squares || entry.ticks !== verificationLine.ticks) status = "Différence";

            const hasDifferences = status !== "OK";
            const finalSelection = finalResultByKey.get(`${round.id}-${sheet.lane.id}-${swimmer.id}`) ?? null;

            return {
              swimmerKey: `${sheet.id}-${swimmer.id}`,
              swimmerId: swimmer.id,
              sheetId: sheet.id,
              roundId: round.id,
              laneId: sheet.lane.id,
              swimmerNumber: swimmer.number,
              lastName: swimmer.lastName,
              firstName: swimmer.firstName,
              club: swimmer.club?.name ?? "-",
              section: swimmer.section?.name ?? "-",
              status,
              hasDifferences,
              originalEntry: entry
                ? {
                    sheetEntryId: entry.id,
                    squares: entry.squares,
                    ticks: entry.ticks,
                    totalLengths: entry.totalLengths,
                    distanceM: entry.distanceM,
                  }
                : null,
              verificationDetails: (allVerificationLinesBySwimmer.get(swimmer.id) ?? []).map((line) => ({
                verificationId: line.verificationId,
                verificationLineId: line.id,
                verifierName: line.verifierName,
                squares: line.squares,
                ticks: line.ticks,
                totalLengths: line.totalLengths,
                distanceM: line.distanceM,
                createdAtLabel: line.createdAtLabel,
              })),
              finalSelection,
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

    const distanceKm = distanceM / 1000;

    const totalLines = sheetEntries.length;
    const verifiedLines = rounds.reduce(
      (sum, round) =>
        sum +
        round.sheets.reduce((sheetSum, sheet) => {
          const latestVerification = sheet.verifications[0] ?? null;
          if (!latestVerification) return sheetSum;

          const originalSwimmerIds = new Set(sheet.entries.map((entry) => entry.swimmer.id));
          const verifiedCount = latestVerification.lines.filter((line) => originalSwimmerIds.has(line.swimmer.id)).length;
          return sheetSum + verifiedCount;
        }, 0),
      0,
    );
    const linesToVerify = Math.max(totalLines - verifiedLines, 0);
    const finalValidatedLines = finalResults.length;
    const remainingDifferences = verificationRounds.reduce(
      (sum, round) =>
        sum +
        round.lanes.reduce(
          (laneSum, lane) => laneSum + lane.swimmers.filter((swimmer) => swimmer.hasDifferences && !swimmer.finalSelection).length,
          0,
        ),
      0,
    );

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

        <VerificationDashboard
          rounds={verificationRounds}
          summary={{
            totalLines,
            verifiedLines,
            linesToVerify,
            finalValidatedLines,
            remainingDifferences,
          }}
          saveFinalResultAction={saveFinalResult}
          transferConformingLinesAction={transferConformingLines}
        />
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
