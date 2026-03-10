export type ComparableLine = {
  swimmerNumber: number;
  squares: number;
  ticks: number;
};

export type VerificationComparison = {
  identicalCount: number;
  differentValues: Array<{ swimmerNumber: number; original: { squares: number; ticks: number }; verification: { squares: number; ticks: number } }>;
  missingSwimmers: number[];
  addedSwimmers: number[];
};

export type DashboardVerificationStatus =
  | "Non vérifiée"
  | "Partiellement vérifiée"
  | "Vérifiée sans écart"
  | "Vérifiée avec écarts";

export type DashboardSwimmerStatus = "OK" | "Différence" | "Absent en vérification" | "Ajouté en vérification";

export function compareSheetAndVerification(
  originalLines: ComparableLine[],
  verificationLines: ComparableLine[],
): VerificationComparison {
  const originalBySwimmer = new Map<number, { squares: number; ticks: number }>();
  const verificationBySwimmer = new Map<number, { squares: number; ticks: number }>();

  for (const line of originalLines) {
    originalBySwimmer.set(line.swimmerNumber, { squares: line.squares, ticks: line.ticks });
  }

  for (const line of verificationLines) {
    verificationBySwimmer.set(line.swimmerNumber, { squares: line.squares, ticks: line.ticks });
  }

  const missingSwimmers: number[] = [];
  const addedSwimmers: number[] = [];
  const differentValues: VerificationComparison["differentValues"] = [];
  let identicalCount = 0;

  for (const [swimmerNumber, original] of originalBySwimmer) {
    const verification = verificationBySwimmer.get(swimmerNumber);

    if (!verification) {
      missingSwimmers.push(swimmerNumber);
      continue;
    }

    if (original.squares === verification.squares && original.ticks === verification.ticks) {
      identicalCount += 1;
      continue;
    }

    differentValues.push({ swimmerNumber, original, verification });
  }

  for (const swimmerNumber of verificationBySwimmer.keys()) {
    if (!originalBySwimmer.has(swimmerNumber)) {
      addedSwimmers.push(swimmerNumber);
    }
  }

  return {
    identicalCount,
    differentValues,
    missingSwimmers: missingSwimmers.sort((a, b) => a - b),
    addedSwimmers: addedSwimmers.sort((a, b) => a - b),
  };
}

export function getDashboardVerificationStatus(params: {
  sheetsCount: number;
  verifiedSheetsCount: number;
  differencesCount: number;
}): DashboardVerificationStatus {
  const { sheetsCount, verifiedSheetsCount, differencesCount } = params;

  if (sheetsCount === 0 || verifiedSheetsCount === 0) {
    return "Non vérifiée";
  }

  if (verifiedSheetsCount < sheetsCount) {
    return "Partiellement vérifiée";
  }

  if (differencesCount > 0) {
    return "Vérifiée avec écarts";
  }

  return "Vérifiée sans écart";
}

export function countComparisonDifferences(comparison: VerificationComparison): number {
  return comparison.differentValues.length + comparison.missingSwimmers.length + comparison.addedSwimmers.length;
}
