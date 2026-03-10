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

export type VerificationStatus = "OK" | "DIFFÉRENCES" | "NON VÉRIFIÉ";

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

export function getVerificationStatus(
  originalLines: ComparableLine[],
  verificationLines: ComparableLine[] | null,
): VerificationStatus {
  if (!verificationLines) {
    return "NON VÉRIFIÉ";
  }

  const comparison = compareSheetAndVerification(originalLines, verificationLines);
  const hasDifferences =
    comparison.differentValues.length > 0 || comparison.missingSwimmers.length > 0 || comparison.addedSwimmers.length > 0;

  return hasDifferences ? "DIFFÉRENCES" : "OK";
}
