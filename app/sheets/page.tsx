import { revalidatePath } from "next/cache";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { LogoutButton } from "@/app/logout-button";
import { requireSessionUser } from "@/lib/auth";
import { requireActiveChallengeForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { VerificationForm } from "./verification-form";

export const dynamic = "force-dynamic";

type SaveState = {
  error: string | null;
  success: string | null;
};

type VerificationLineInput = {
  swimmerNumber: number;
  squares: number;
  ticks: number;
};

function parseLines(linesJson: string): VerificationLineInput[] | null {
  try {
    const parsed = JSON.parse(linesJson) as unknown;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const validLines = parsed.filter((entry): entry is VerificationLineInput => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Record<string, unknown>;

      return (
        Number.isInteger(candidate.swimmerNumber) &&
        Number.isInteger(candidate.squares) &&
        Number.isInteger(candidate.ticks) &&
        Number(candidate.swimmerNumber) > 0 &&
        Number(candidate.squares) >= 0 &&
        Number(candidate.ticks) >= 0
      );
    });

    return validLines.length > 0 ? validLines : null;
  } catch {
    return null;
  }
}

async function saveVerification(_prevState: SaveState, formData: FormData): Promise<SaveState> {
  "use server";

  const user = await requireSessionUser();
  const challenge = await requireActiveChallengeForUser(user);

  const sheetId = String(formData.get("sheetId") ?? "").trim();
  const linesJson = String(formData.get("linesJson") ?? "[]");
  const lines = parseLines(linesJson);

  if (!sheetId) {
    return { error: "Feuille introuvable.", success: null };
  }

  if (!lines) {
    return { error: "Ajoutez au moins une ligne de vérification valide.", success: null };
  }

  const duplicateNumbers = lines
    .map((line) => line.swimmerNumber)
    .filter((number, index, numbers) => numbers.indexOf(number) !== index);

  if (duplicateNumbers.length > 0) {
    return { error: "Un nageur ne peut apparaître qu'une fois dans une vérification.", success: null };
  }

  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, challengeId: challenge.id },
    select: { id: true, lane: { select: { distanceM: true } } },
  });

  if (!sheet) {
    return { error: "Feuille introuvable pour cette tournée et cette ligne.", success: null };
  }

  const swimmers = await prisma.swimmer.findMany({
    where: {
      challengeId: challenge.id,
      number: { in: lines.map((line) => line.swimmerNumber) },
    },
    select: { id: true, number: true },
  });

  const swimmerIdByNumber = new Map<number, string>();
  for (const swimmer of swimmers) {
    swimmerIdByNumber.set(swimmer.number, swimmer.id);
  }

  const missingSwimmerNumbers = lines
    .map((line) => line.swimmerNumber)
    .filter((number) => !swimmerIdByNumber.has(number));

  if (missingSwimmerNumbers.length > 0) {
    return { error: `Nageur introuvable pour les numéros: ${missingSwimmerNumbers.join(", ")}.`, success: null };
  }

  await prisma.verification.create({
    data: {
      sheetId: sheet.id,
      userId: user.id,
      lines: {
        create: lines.map((line) => {
          const totalLengths = line.squares * 4 + line.ticks;
          return {
            swimmerId: swimmerIdByNumber.get(line.swimmerNumber) as string,
            squares: line.squares,
            ticks: line.ticks,
            totalLengths,
            distanceM: totalLengths * sheet.lane.distanceM,
          };
        }),
      },
    },
  });

  revalidatePath("/sheets");

  return { error: null, success: "Vérification enregistrée." };
}

export default async function SheetsPage() {
  const user = await requireSessionUser();
  const challenge = await requireActiveChallengeForUser(user);

  const [rounds, lanes, swimmers, sheets] = await Promise.all([
    prisma.round.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ displayOrder: "asc" }, { roundNumber: "asc" }],
      select: { id: true, label: true },
    }),
    prisma.lane.findMany({
      where: { challengeId: challenge.id, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, distanceM: true },
    }),
    prisma.swimmer.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ number: "asc" }],
      select: { id: true, number: true, firstName: true, lastName: true },
    }),
    prisma.sheet.findMany({
      where: { challengeId: challenge.id },
      select: {
        id: true,
        roundId: true,
        laneId: true,
        entries: {
          orderBy: { swimmer: { number: "asc" } },
          select: { swimmer: { select: { number: true } }, squares: true, ticks: true },
        },
        verifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            lines: {
              orderBy: { swimmer: { number: "asc" } },
              select: { swimmer: { select: { number: true } }, squares: true, ticks: true },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackToMainMenuLink />
        <LogoutButton />
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Vérifications saisies</h1>
        <p className="text-slate-600">Sélectionnez une tournée et une ligne pour contrôler la feuille.</p>
      </div>

      <VerificationForm
        rounds={rounds}
        lanes={lanes}
        swimmers={swimmers}
        sheets={sheets.map((sheet) => ({
          id: sheet.id,
          roundId: sheet.roundId,
          laneId: sheet.laneId,
          originalLines: sheet.entries.map((entry) => ({
            swimmerNumber: entry.swimmer.number,
            squares: entry.squares,
            ticks: entry.ticks,
          })),
          latestVerificationLines:
            sheet.verifications[0]?.lines.map((line) => ({ swimmerNumber: line.swimmer.number, squares: line.squares, ticks: line.ticks })) ??
            null,
        }))}
        action={saveVerification}
      />
    </div>
  );
}
