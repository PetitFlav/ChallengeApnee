import { SheetStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  ARCHIVED_READ_ONLY_MESSAGE,
  CLOSED_READ_ONLY_MESSAGE,
} from "@/lib/events";
import { requireSessionUser } from "@/lib/auth";
import { requireChallengeForModule, requireLengthsEntryAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildRoundAvailability } from "@/lib/rounds";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { NewSheetForm } from "./new-sheet-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Saisie des distances",
};

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

type CreateSheetState = {
  error: string | null;
  success: string | null;
  loadedSheetId: string | null;
  nextRoundId: string | null;
};

type CreateSheetEntryInput = {
  swimmerNumber: number;
  squares: number;
  ticks: number;
};

type RoundProgressOption = {
  id: string;
  label: string;
  status: "pending" | "active" | "closed";
  isSelectable: boolean;
  isSelectableBySuperUser: boolean;
  opensAtLabel: string;
  closesAtLabel: string;
};

function toDisplayTimeLabel(value: Date, timezone: string | null) {
  return value.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone ?? "Europe/Paris",
  });
}

function parseEntries(entriesJson: string): CreateSheetEntryInput[] | null {
  try {
    const parsed = JSON.parse(entriesJson) as unknown;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const validEntries = parsed.filter((entry): entry is CreateSheetEntryInput => {
      if (!entry || typeof entry !== "object") return false;

      const candidate = entry as Record<string, unknown>;
      const swimmerNumber = candidate.swimmerNumber;
      const squares = candidate.squares;
      const ticks = candidate.ticks;

      return (
        Number.isInteger(swimmerNumber) &&
        Number.isInteger(squares) &&
        Number.isInteger(ticks) &&
        Number(swimmerNumber) > 0 &&
        Number(squares) >= 0 &&
        Number(ticks) >= 0
      );
    });

    if (validEntries.length === 0) return null;

    return validEntries;
  } catch {
    return null;
  }
}

async function saveSheet(_prevState: CreateSheetState, formData: FormData): Promise<CreateSheetState> {
  "use server";

  const user = await requireSessionUser();
  await requireLengthsEntryAccess(user);

  if (!hasDatabaseUrl) {
    return {
      error: "Base de données indisponible.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }
  const challenge = await requireChallengeForModule(user);
  const roundId = String(formData.get("roundId") || "").trim();
  const laneId = String(formData.get("laneId") || "").trim();
  const entriesJson = String(formData.get("entriesJson") || "[]");

  if (!roundId || !laneId) {
    return {
      error: "Sélectionnez une tournée et une ligne.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  const entries = parseEntries(entriesJson);

  if (!entries) {
    return {
      error: "Ajoutez au moins une saisie nageur valide.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  const duplicateNumbers = entries
    .map((entry) => entry.swimmerNumber)
    .filter((number, index, numbers) => numbers.indexOf(number) !== index);

  if (duplicateNumbers.length > 0) {
    return {
      error: "Un numéro de nageur ne peut apparaître qu'une fois sur une même feuille.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  const [round, lane, swimmers, rounds] = await Promise.all([
    prisma.round.findFirst({ where: { id: roundId, challengeId: challenge.id } }),
    prisma.lane.findFirst({ where: { id: laneId, challengeId: challenge.id } }),
    prisma.swimmer.findMany({
      where: {
        challengeId: challenge.id,
        number: { in: entries.map((entry) => entry.swimmerNumber) },
      },
    }),
    prisma.round.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ displayOrder: "asc" }, { roundNumber: "asc" }],
      select: { id: true, label: true, scheduledTime: true },
    }),
  ]);

  if (!round || !lane) {
    return {
      error: "Tournée ou ligne introuvable.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  const roundsWithProgress = buildRoundAvailability(rounds, {
    eventDate: challenge.eventDate,
    startTime: challenge.startTime,
    timezone: challenge.timezone,
    durationMinutes: challenge.durationMinutes,
    closedAt: challenge.closedAt,
  }).map((roundAvailability) => ({
    ...roundAvailability,
    opensAtLabel: toDisplayTimeLabel(roundAvailability.opensAt, challenge.timezone),
    closesAtLabel: roundAvailability.closesAt ? toDisplayTimeLabel(roundAvailability.closesAt, challenge.timezone) : "-",
  }));
  const submittedRound = roundsWithProgress.find((candidateRound) => candidateRound.id === roundId) ?? null;

  if (!submittedRound) {
    return {
      error: "La tournée sélectionnée n'existe pas pour cet événement.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  if (!user.isSuperUser && !submittedRound.isSelectable) {
    return {
      error:
        submittedRound.status === "pending"
          ? "La tournée sélectionnée n'est pas encore ouverte à la saisie."
          : "La tournée sélectionnée n'est plus ouverte à la saisie.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  const swimmerIdByNumber = new Map<number, string>();
  for (const swimmer of swimmers) {
    swimmerIdByNumber.set(swimmer.number, swimmer.id);
  }

  const missingSwimmerNumbers = entries
    .map((entry) => entry.swimmerNumber)
    .filter((swimmerNumber) => !swimmerIdByNumber.has(swimmerNumber));

  if (missingSwimmerNumbers.length > 0) {
    return {
      error: `Nageur introuvable pour les numéros: ${missingSwimmerNumbers.join(", ")}.`,
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }

  try {
    const latestChallenge = await prisma.challenge.findUnique({
      where: { id: challenge.id },
      select: { id: true, isArchived: true, closedAt: true },
    });

    if (!latestChallenge) {
      return {
        error: "Événement introuvable.",
        success: null,
        loadedSheetId: null,
        nextRoundId: null,
      };
    }

    if (latestChallenge.isArchived) {
      return {
        error: ARCHIVED_READ_ONLY_MESSAGE,
        success: null,
        loadedSheetId: null,
        nextRoundId: null,
      };
    }

    const lastRoundId = roundsWithProgress[roundsWithProgress.length - 1]?.id ?? null;
    const canSaveAfterClosure = user.isSuperUser || Boolean(latestChallenge.closedAt && roundId === lastRoundId);

    if (latestChallenge.closedAt && !canSaveAfterClosure) {
      return {
        error: CLOSED_READ_ONLY_MESSAGE,
        success: null,
        loadedSheetId: null,
        nextRoundId: null,
      };
    }

    const sheet = await prisma.$transaction(async (tx) => {
      const existingSheet = await tx.sheet.findFirst({
        where: {
          challengeId: challenge.id,
          roundId,
          laneId,
        },
        select: { id: true },
      });

      if (!existingSheet) {
        return tx.sheet.create({
          data: {
            challengeId: challenge.id,
            roundId,
            laneId,
            status: SheetStatus.VALIDATED,
            validatedAt: new Date(),
            entries: {
              create: entries.map((entry) => {
                const totalLengths = entry.squares * 4 + entry.ticks;
                return {
                  swimmerId: swimmerIdByNumber.get(entry.swimmerNumber) as string,
                  squares: entry.squares,
                  ticks: entry.ticks,
                  totalLengths,
                  distanceM: totalLengths * lane.distanceM,
                };
              }),
            },
          },
          select: { id: true },
        });
      }

      await tx.sheetEntry.deleteMany({ where: { sheetId: existingSheet.id } });

      await tx.sheet.update({
        where: { id: existingSheet.id },
        data: {
          status: SheetStatus.VALIDATED,
          validatedAt: new Date(),
          entries: {
            create: entries.map((entry) => {
              const totalLengths = entry.squares * 4 + entry.ticks;
              return {
                swimmerId: swimmerIdByNumber.get(entry.swimmerNumber) as string,
                squares: entry.squares,
                ticks: entry.ticks,
                totalLengths,
                distanceM: totalLengths * lane.distanceM,
              };
            }),
          },
        },
      });

      return existingSheet;
    });

    revalidatePath("/sheets");
    revalidatePath("/sheets/new");
    revalidatePath("/dashboard");

    const activeRound = roundsWithProgress.find((candidateRound) => candidateRound.status === "active") ?? null;
    const shouldSwitchToActiveRound = Boolean(!user.isSuperUser && activeRound && activeRound.id !== roundId);

    return {
      error: null,
      success: latestChallenge.closedAt && !user.isSuperUser
        ? "Les données de la dernière tournée ont bien été enregistrées. L’événement est maintenant clôturé."
        : shouldSwitchToActiveRound
          ? "Les données de la tournée précédente ont bien été enregistrées. La saisie bascule maintenant sur la nouvelle tournée."
          : user.isSuperUser && latestChallenge.closedAt
            ? "Feuille enregistrée avec succès en mode dérogatoire super utilisateur."
            : "Feuille enregistrée avec succès.",
      loadedSheetId: sheet.id,
      nextRoundId: shouldSwitchToActiveRound ? activeRound?.id ?? null : null,
    };
  } catch (error) {
    if (error instanceof Error && (error.message === ARCHIVED_READ_ONLY_MESSAGE || error.message === CLOSED_READ_ONLY_MESSAGE)) {
      return {
        error: error.message,
        success: null,
        loadedSheetId: null,
        nextRoundId: null,
      };
    }

    return {
      error: "Impossible d'enregistrer la feuille. Vérifiez les données et réessayez.",
      success: null,
      loadedSheetId: null,
      nextRoundId: null,
    };
  }
}

export default async function NewSheetPage() {
  const user = await requireSessionUser();
  await requireLengthsEntryAccess(user);

  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Saisie des distances</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la saisie des feuilles.
        </div>
      </div>
    );
  }

  try {
    const challenge = await requireChallengeForModule(user);
    const isArchived = challenge.isArchived;
    const isClosed = Boolean(challenge.closedAt);

    const [rounds, lanes, swimmers, existingSheets] = await Promise.all([
      prisma.round.findMany({
        where: { challengeId: challenge.id },
        orderBy: [{ displayOrder: "asc" }, { roundNumber: "asc" }],
        select: {
          id: true,
          label: true,
          scheduledTime: true,
        },
      }),
      prisma.lane.findMany({
        where: { challengeId: challenge.id, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          distanceM: true,
        },
      }),
      prisma.swimmer.findMany({
        where: { challengeId: challenge.id },
        orderBy: [{ number: "asc" }],
        select: {
          id: true,
          number: true,
          firstName: true,
          lastName: true,
          club: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      prisma.sheet.findMany({
        where: { challengeId: challenge.id },
        select: {
          id: true,
          roundId: true,
          laneId: true,
          entries: {
            orderBy: { createdAt: "asc" },
            select: {
              swimmer: { select: { number: true } },
              squares: true,
              ticks: true,
            },
          },
        },
      }),
    ]);

    const roundsWithProgress = buildRoundAvailability(rounds, {
      eventDate: challenge.eventDate,
      startTime: challenge.startTime,
      timezone: challenge.timezone,
      durationMinutes: challenge.durationMinutes,
      closedAt: challenge.closedAt,
    }).map((roundAvailability) => ({
      ...roundAvailability,
      opensAtLabel: toDisplayTimeLabel(roundAvailability.opensAt, challenge.timezone),
      closesAtLabel: roundAvailability.closesAt ? toDisplayTimeLabel(roundAvailability.closesAt, challenge.timezone) : "-",
    }));

    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Saisie des distances</h1>
        <p className="text-slate-600">Choisissez d&apos;abord la tournée et la ligne, puis saisissez les nageurs.</p>
        {isArchived ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {ARCHIVED_READ_ONLY_MESSAGE}
          </div>
        ) : isClosed && !user.isSuperUser ? (
          <div className="rounded border border-indigo-300 bg-indigo-50 p-3 text-sm text-indigo-800">
            {CLOSED_READ_ONLY_MESSAGE}
          </div>
        ) : isClosed && user.isSuperUser ? (
          <div className="rounded border border-violet-300 bg-violet-50 p-3 text-sm text-violet-800">
            Événement clôturé : la saisie reste autorisée uniquement en dérogation pour le super utilisateur.
          </div>
        ) : null}
        <NewSheetForm
          rounds={roundsWithProgress}
          lanes={lanes}
          swimmers={swimmers.map((swimmer) => ({
            id: swimmer.id,
            number: swimmer.number,
            firstName: swimmer.firstName,
            lastName: swimmer.lastName,
            clubName: swimmer.club?.name ?? "-",
            sectionName: swimmer.section?.name ?? "-",
          }))}
          existingSheets={existingSheets.map((sheet) => ({
            id: sheet.id,
            roundId: sheet.roundId,
            laneId: sheet.laneId,
            rows: sheet.entries.map((entry) => ({
              swimmerNumber: String(entry.swimmer.number),
              squares: String(entry.squares),
              ticks: String(entry.ticks),
            })),
          }))}
          action={saveSheet}
          disabled={isArchived}
          isSuperUser={user.isSuperUser}
        />
      </div>
    );
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Saisie des distances</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Impossible de se connecter à la base de données. Vérifiez DATABASE_URL.
        </div>
      </div>
    );
  }
}
