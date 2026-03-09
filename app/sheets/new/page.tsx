import { SheetStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ARCHIVED_READ_ONLY_MESSAGE, assertChallengeWritable, ensureActiveChallenge } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { NewSheetForm } from "./new-sheet-form";

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

type CreateSheetState = {
  error: string | null;
  success: string | null;
  loadedSheetId: string | null;
};

type CreateSheetEntryInput = {
  swimmerNumber: number;
  squares: number;
  ticks: number;
};

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

  if (!hasDatabaseUrl) {
    return {
      error: "Base de données indisponible.",
      success: null,
      loadedSheetId: null,
    };
  }

  const challenge = await ensureActiveChallenge();
  const roundId = String(formData.get("roundId") || "").trim();
  const laneId = String(formData.get("laneId") || "").trim();
  const entriesJson = String(formData.get("entriesJson") || "[]");

  if (!roundId || !laneId) {
    return {
      error: "Sélectionnez une tournée et une ligne.",
      success: null,
      loadedSheetId: null,
    };
  }

  const entries = parseEntries(entriesJson);

  if (!entries) {
    return {
      error: "Ajoutez au moins une saisie nageur valide.",
      success: null,
      loadedSheetId: null,
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
    };
  }

  const [round, lane, swimmers] = await Promise.all([
    prisma.round.findFirst({ where: { id: roundId, challengeId: challenge.id } }),
    prisma.lane.findFirst({ where: { id: laneId, challengeId: challenge.id } }),
    prisma.swimmer.findMany({
      where: {
        challengeId: challenge.id,
        number: { in: entries.map((entry) => entry.swimmerNumber) },
      },
    }),
  ]);

  if (!round || !lane) {
    return {
      error: "Tournée ou ligne introuvable.",
      success: null,
      loadedSheetId: null,
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
    };
  }

  try {
    await assertChallengeWritable(challenge.id);

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

    return {
      error: null,
      success: "Feuille enregistrée avec succès.",
      loadedSheetId: sheet.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message === ARCHIVED_READ_ONLY_MESSAGE) {
      return {
        error: ARCHIVED_READ_ONLY_MESSAGE,
        success: null,
        loadedSheetId: null,
      };
    }

    return {
      error: "Impossible d'enregistrer la feuille. Vérifiez les données et réessayez.",
      success: null,
      loadedSheetId: null,
    };
  }
}

export default async function NewSheetPage() {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Nouvelle feuille</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la saisie des feuilles.
        </div>
      </div>
    );
  }

  try {
    const challenge = await ensureActiveChallenge();
    const isArchived = challenge.isArchived;

    const [rounds, lanes, swimmers, existingSheets] = await Promise.all([
      prisma.round.findMany({
        where: { challengeId: challenge.id },
        orderBy: [{ displayOrder: "asc" }, { roundNumber: "asc" }],
        select: {
          id: true,
          label: true,
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

    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Nouvelle feuille</h1>
        <p className="text-slate-600">Sélectionnez tournée + ligne, puis saisissez les nageurs.</p>
        {isArchived ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {ARCHIVED_READ_ONLY_MESSAGE}
          </div>
        ) : null}
        <NewSheetForm
          rounds={rounds}
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
        />
      </div>
    );
  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Nouvelle feuille</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Impossible de se connecter à la base de données. Vérifiez DATABASE_URL.
        </div>
      </div>
    );
  }
}
