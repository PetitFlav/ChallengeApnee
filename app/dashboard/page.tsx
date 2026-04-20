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

export default async function DashboardPage() {
  const user = await requireSessionUser();

  try {
    await requireModuleAccess(user, "dashboard");
    const challenge = await requireChallengeForModule(user);

    // ─── Action : retenir un résultat + marquer la ligne validée ──────────────
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
      const sourceVerificationId = formData.get("sourceVerificationId")
        ? String(formData.get("sourceVerificationId"))
        : null;
      const sourceVerificationLineId = formData.get("sourceVerificationLineId")
        ? String(formData.get("sourceVerificationLineId"))
        : null;
      const sourceSheetEntryId = formData.get("sourceSheetEntryId")
        ? String(formData.get("sourceSheetEntryId"))
        : null;
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

      // 1. Upsert du FinalResult
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

      // 2. Marquer la ligne retenue comme validée
      if (sourceVerificationLineId) {
        await prisma.verificationLine.update({
          where: { id: sourceVerificationLineId },
          data: { isValidated: true },
        });
      }

      // 3. Toutes les lignes du nageur sur cette feuille → isNew = false
      if (sourceVerificationId && swimmerId) {
        await prisma.verificationLine.updateMany({
          where: {
            swimmerId,
            verification: { sheetId },
          },
          data: { isNew: false },
        });
      }

      revalidatePath("/dashboard");
    }

    // ─── Action : transfert en masse des lignes conformes ────────────────────
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
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              lines: {
                select: {
                  id: true,
                  verificationId: true,
                  swimmerId: true,
                  squares: true,
                  ticks: true,
                  totalLengths: true,
                  distanceM: true,
                  isNew: true,
                  isValidated: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      const upserts: Array<ReturnType<typeof prisma.finalResult.upsert>> = [];
      const lineIdsToValidate: string[] = [];
      const swimmerSheetPairsToMarkNotNew: Array<{ swimmerId: string; sheetId: string }> = [];

      for (const sheet of sheets) {
        // Ligne de vérification la plus récente par nageur
        const latestLineBySwimmer = new Map<
          string,
          {
            id: string;
            verificationId: string;
            squares: number;
            ticks: number;
            totalLengths: number;
            distanceM: number;
            isNew: boolean;
            isValidated: boolean;
          }
        >();

        for (const verification of sheet.verifications) {
          for (const line of verification.lines) {
            if (!latestLineBySwimmer.has(line.swimmerId)) {
              latestLineBySwimmer.set(line.swimmerId, {
                id: line.id,
                verificationId: line.verificationId,
                squares: line.squares,
                ticks: line.ticks,
                totalLengths: line.totalLengths,
                distanceM: line.distanceM,
                isNew: line.isNew,
                isValidated: line.isValidated,
              });
            }
          }
        }

        for (const entry of sheet.entries) {
          const latestLine = latestLineBySwimmer.get(entry.swimmerId);

          // Pas de vérification → on ne touche pas au FinalResult existant
          if (!latestLine) continue;

          const isConforming =
            latestLine.squares === entry.squares && latestLine.ticks === entry.ticks;

          // Règles de finalisation :
          // 1. Original = vérif            → source "original",      valeurs communes,        on valide la ligne
          // 2. Original ≠ vérif, validée   → source "verification",  valeurs de la vérif
          // 3. Original ≠ vérif, non val.  → source "original",      valeurs originales       (en attente)
          let source: "original" | "verification";
          let squares: number;
          let ticks: number;
          let totalLengths: number;
          let distanceM: number;

          if (isConforming) {
            source = "original";
            squares = entry.squares;
            ticks = entry.ticks;
            totalLengths = entry.totalLengths;
            distanceM = entry.distanceM;
            lineIdsToValidate.push(latestLine.id);
            swimmerSheetPairsToMarkNotNew.push({ swimmerId: entry.swimmerId, sheetId: sheet.id });
          } else if (latestLine.isValidated) {
            source = "verification";
            squares = latestLine.squares;
            ticks = latestLine.ticks;
            totalLengths = latestLine.totalLengths;
            distanceM = latestLine.distanceM;
          } else {
            // Différence non encore validée : on garde l'original en attendant
            source = "original";
            squares = entry.squares;
            ticks = entry.ticks;
            totalLengths = entry.totalLengths;
            distanceM = entry.distanceM;
          }

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
                source,
                sourceVerificationId: latestLine.verificationId,
                sourceVerificationLineId: latestLine.id,
                sourceSheetEntryId: entry.id,
                squares,
                ticks,
                totalLengths,
                distanceM,
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
                source,
                sourceVerificationId: latestLine.verificationId,
                sourceVerificationLineId: latestLine.id,
                sourceSheetEntryId: entry.id,
                squares,
                ticks,
                totalLengths,
                distanceM,
                validatedByUserId: user.id,
              },
            }),
          );
        }
      }

      if (upserts.length > 0) {
        await prisma.$transaction(upserts);
      }

      // Lignes conformes → isValidated = true
      if (lineIdsToValidate.length > 0) {
        await prisma.verificationLine.updateMany({
          where: { id: { in: lineIdsToValidate } },
          data: { isValidated: true },
        });
      }

      // Nageurs/feuilles conformes → toutes leurs lignes isNew = false
      for (const pair of swimmerSheetPairsToMarkNotNew) {
        await prisma.verificationLine.updateMany({
          where: {
            swimmerId: pair.swimmerId,
            verification: { sheetId: pair.sheetId },
          },
          data: { isNew: false },
        });
      }

      revalidatePath("/dashboard");
    }

    // ─── Chargement des données ───────────────────────────────────────────────
    const [sheetEntries, rounds, finalResults] = await Promise.all([
      prisma.sheetEntry.findMany({
        where: { sheet: { challengeId: challenge.id } },
        select: {
          swimmerId: true,
          distanceM: true,
          sheet: { select: { roundId: true, laneId: true } },
        },
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
                      isNew: true,
                      isValidated: true,
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
          swimmer: {
            select: {
              number: true,
              firstName: true,
              lastName: true,
              club: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          lane: { select: { distanceM: true } },
          validatedAt: true,
          validatedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

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
          ? latestVerification.lines.map((line) => ({
              swimmerNumber: line.swimmer.number,
              squares: line.squares,
              ticks: line.ticks,
            }))
          : null;

        const differencesCount = verificationLines
          ? countComparisonDifferences(compareSheetAndVerification(originalLines, verificationLines))
          : 0;

        const entryBySwimmer = new Map(sheet.entries.map((entry) => [entry.swimmer.id, entry]));

        const allVerificationLinesBySwimmer = new Map<
          string,
          Array<
            (typeof sheet.verifications)[number]["lines"][number] & {
              verificationId: string;
              verifierName: string;
              createdAtLabel: string;
            }
          >
        >();

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

        const latestVerificationLineBySwimmer = new Map(
          (latestVerification?.lines ?? []).map((line) => [line.swimmer.id, line]),
        );

        const swimmerIds = new Set<string>([
          ...entryBySwimmer.keys(),
          ...latestVerificationLineBySwimmer.keys(),
        ]);

        const swimmers = Array.from(swimmerIds)
          .map((swimmerId) => {
            const entry = entryBySwimmer.get(swimmerId);
            const verificationLine = latestVerificationLineBySwimmer.get(swimmerId);
            const swimmer = entry?.swimmer ?? verificationLine?.swimmer;

            if (!swimmer) return null;

            let status: DashboardSwimmerStatus = "OK";
            if (!verificationLine) status = "Absent en vérification";
            else if (!entry) status = "Ajouté en vérification";
            else if (
              entry.squares !== verificationLine.squares ||
              entry.ticks !== verificationLine.ticks
            )
              status = "Différence";

            const hasDifferences = status !== "OK";
            const finalSelection =
              finalResultByKey.get(`${round.id}-${sheet.lane.id}-${swimmer.id}`) ?? null;

            const allLines = allVerificationLinesBySwimmer.get(swimmer.id) ?? [];
            // Signal jaune : au moins une ligne isNew = true non encore validée
            const hasNewVerification = allLines.some((line) => line.isNew && !line.isValidated);

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
              hasNewVerification,
              originalEntry: entry
                ? {
                    sheetEntryId: entry.id,
                    squares: entry.squares,
                    ticks: entry.ticks,
                    totalLengths: entry.totalLengths,
                    distanceM: entry.distanceM,
                  }
                : null,
              verificationDetails: allLines.map((line) => ({
                verificationId: line.verificationId,
                verificationLineId: line.id,
                verifierName: line.verifierName,
                squares: line.squares,
                ticks: line.ticks,
                totalLengths: line.totalLengths,
                distanceM: line.distanceM,
                createdAtLabel: line.createdAtLabel,
                isNew: line.isNew,
                isValidated: line.isValidated,
              })),
              finalSelection,
            };
          })
          .filter((swimmer): swimmer is NonNullable<typeof swimmer> => swimmer !== null)
          .sort((a, b) => a.swimmerNumber - b.swimmerNumber);

        const unresolvedDifferencesCount = swimmers.filter(
          (swimmer) => swimmer.hasDifferences && !swimmer.finalSelection,
        ).length;

        const hasNewVerification = swimmers.some((swimmer) => swimmer.hasNewVerification);

        return {
          laneId: sheet.lane.id,
          laneCode: sheet.lane.code,
          distanceM: sheet.lane.distanceM,
          swimmersCount: sheet.entries.length,
          verificationsCount: sheet.verifications.length,
          differencesCount,
          unresolvedDifferencesCount,
          hasNewVerification,
          status: getDashboardVerificationStatus({
            sheetsCount: 1,
            verifiedSheetsCount: latestVerification ? 1 : 0,
            differencesCount,
            unresolvedDifferencesCount,
          }),
          swimmers,
        };
      });

      const verificationsCount = round.sheets.reduce((sum, sheet) => sum + sheet.verifications.length, 0);
      const verifiersCount = new Set(
        round.sheets.flatMap((sheet) => sheet.verifications.map((v) => v.userId)),
      ).size;
      const differencesCount = lanes.reduce((sum, lane) => sum + lane.differencesCount, 0);
      const unresolvedDifferencesCount = lanes.reduce(
        (sum, lane) => sum + lane.unresolvedDifferencesCount,
        0,
      );
      const verifiedSheetsCount = round.sheets.filter((sheet) => sheet.verifications.length > 0).length;
      const hasNewVerification = lanes.some((lane) => lane.hasNewVerification);

      return {
        roundId: round.id,
        roundLabel: round.label,
        lanesCount: round.sheets.length,
        verificationsCount,
        verifiersCount,
        differencesCount,
        unresolvedDifferencesCount,
        hasNewVerification,
        status: getDashboardVerificationStatus({
          sheetsCount: round.sheets.length,
          verifiedSheetsCount,
          differencesCount,
          unresolvedDifferencesCount,
        }),
        lanes,
      };
    });

    const totalLines = sheetEntries.length;
    const verifiedLines = rounds.reduce(
      (sum, round) =>
        sum +
        round.sheets.reduce((sheetSum, sheet) => {
          const latestVerification = sheet.verifications[0] ?? null;
          if (!latestVerification) return sheetSum;
          const originalSwimmerIds = new Set(sheet.entries.map((entry) => entry.swimmer.id));
          const verifiedCount = latestVerification.lines.filter((line) =>
            originalSwimmerIds.has(line.swimmer.id),
          ).length;
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
          (laneSum, lane) =>
            laneSum +
            lane.swimmers.filter((swimmer) => swimmer.hasDifferences && !swimmer.finalSelection).length,
          0,
        ),
      0,
    );

    const challenge2 = await prisma.challenge.findFirst({
      where: { id: challenge.id },
      select: {
        name: true,
        eventDate: true,
        startTime: true,
        durationMinutes: true,
        roundsCount: true,
        lanes25Count: true,
        lanes50Count: true,
      },
    });

    return (
      <div className="space-y-6">
        <BackToMainMenuLink />
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-slate-600">
            Vue de contrôle dédiée aux vérifications, écarts, validations et statuts.
          </p>
        </div>

        {challenge2 ? (
          <section className="rounded border bg-white p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Événement</h2>
            <p className="mt-2 text-xl font-semibold text-slate-900">{challenge2.name}</p>
            <p className="text-slate-600">
              {challenge2.eventDate.toLocaleDateString("fr-FR")} · début {challenge2.startTime} · durée{" "}
              {challenge2.durationMinutes} min
            </p>
            <p className="text-slate-600">
              {challenge2.roundsCount} tournées · {challenge2.lanes25Count} lignes 25m ·{" "}
              {challenge2.lanes50Count} lignes 50m
            </p>
          </section>
        ) : null}

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
  } catch (error) {
    console.error("[dashboard] load failed", error);

    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Erreur de chargement du dashboard
        </div>
        {error instanceof Error && error.message ? (
          <div className="rounded border border-slate-300 bg-slate-50 p-4 text-slate-700">
            {error.message}
          </div>
        ) : null}
      </div>
    );
  }
}
