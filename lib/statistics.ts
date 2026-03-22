import { prisma } from "@/lib/prisma";

export const COMPARISON_SOURCE_OPTIONS = {
  event: "event",
  excel: "excel",
} as const;

export type ComparisonSource = (typeof COMPARISON_SOURCE_OPTIONS)[keyof typeof COMPARISON_SOURCE_OPTIONS];

export type StatisticsFilters = {
  lastName: string;
  firstName: string;
  club: string;
  section: string;
};

export type SwimmerStatisticsRow = {
  swimmerId: string;
  swimmerNumber: number;
  lastName: string;
  firstName: string;
  club: string;
  section: string;
  distance25M: number;
  distance50M: number;
  totalDistanceM: number;
};

export type StatisticsTotals = {
  distance25M: number;
  distance50M: number;
  totalDistanceM: number;
};

export type ComparisonExcelImportSpec = {
  source: "excel";
  status: "todo";
  expectedColumns: ["Nom", "Prénom", "Distance 25m", "Distance 50m", "Distance totale"];
  matchingKeys: ["Nom", "Prénom"];
};

export const comparisonExcelImportSpec: ComparisonExcelImportSpec = {
  source: "excel",
  status: "todo",
  expectedColumns: ["Nom", "Prénom", "Distance 25m", "Distance 50m", "Distance totale"],
  matchingKeys: ["Nom", "Prénom"],
};

type ChallengeStatisticsData = {
  challenge: {
    id: string;
    name: string;
    eventDate: Date;
    clubOrganisateurLogo: string | null;
  };
  rows: SwimmerStatisticsRow[];
  clubs: string[];
  sections: string[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

export function getComparisonKey(lastName: string, firstName: string) {
  return `${normalizeText(lastName)}::${normalizeText(firstName)}`;
}

function sumTotals(rows: SwimmerStatisticsRow[]): StatisticsTotals {
  return rows.reduce(
    (totals, row) => ({
      distance25M: totals.distance25M + row.distance25M,
      distance50M: totals.distance50M + row.distance50M,
      totalDistanceM: totals.totalDistanceM + row.totalDistanceM,
    }),
    {
      distance25M: 0,
      distance50M: 0,
      totalDistanceM: 0,
    },
  );
}

export function filterStatisticsRows(rows: SwimmerStatisticsRow[], filters: StatisticsFilters) {
  const normalizedLastName = normalizeText(filters.lastName);
  const normalizedFirstName = normalizeText(filters.firstName);
  const normalizedClub = normalizeText(filters.club);
  const normalizedSection = normalizeText(filters.section);

  return rows.filter((row) => {
    const rowLastName = normalizeText(row.lastName);
    const rowFirstName = normalizeText(row.firstName);
    const rowClub = normalizeText(row.club);
    const rowSection = normalizeText(row.section);

    if (normalizedLastName && !rowLastName.includes(normalizedLastName)) return false;
    if (normalizedFirstName && !rowFirstName.includes(normalizedFirstName)) return false;
    if (normalizedClub && rowClub !== normalizedClub) return false;
    if (normalizedSection && rowSection !== normalizedSection) return false;

    return true;
  });
}

export function buildComparisonMap(rows: SwimmerStatisticsRow[]) {
  return new Map(rows.map((row) => [getComparisonKey(row.lastName, row.firstName), row]));
}

export async function getChallengeStatisticsData(challengeId: string): Promise<ChallengeStatisticsData | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      name: true,
      eventDate: true,
      clubOrganisateurLogo: true,
      swimmers: {
        select: {
          id: true,
          number: true,
          lastName: true,
          firstName: true,
          club: { select: { name: true } },
          section: { select: { name: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { number: "asc" }],
      },
    },
  });

  if (!challenge) {
    return null;
  }

  const [sheetEntries, finalResults] = await Promise.all([
    prisma.sheetEntry.findMany({
      where: { sheet: { challengeId } },
      select: {
        swimmerId: true,
        distanceM: true,
        sheet: {
          select: {
            roundId: true,
            laneId: true,
            lane: { select: { distanceM: true } },
          },
        },
      },
    }),
    prisma.finalResult.findMany({
      where: { challengeId },
      select: {
        swimmerId: true,
        distanceM: true,
        roundId: true,
        laneId: true,
        lane: { select: { distanceM: true } },
      },
    }),
  ]);

  const effectiveDistancesByLine = new Map<
    string,
    {
      swimmerId: string;
      laneDistanceM: number;
      distanceM: number;
    }
  >();

  for (const entry of sheetEntries) {
    const key = `${entry.sheet.roundId}-${entry.sheet.laneId}-${entry.swimmerId}`;
    effectiveDistancesByLine.set(key, {
      swimmerId: entry.swimmerId,
      laneDistanceM: entry.sheet.lane.distanceM,
      distanceM: entry.distanceM,
    });
  }

  for (const result of finalResults) {
    const key = `${result.roundId}-${result.laneId}-${result.swimmerId}`;
    effectiveDistancesByLine.set(key, {
      swimmerId: result.swimmerId,
      laneDistanceM: result.lane.distanceM,
      distanceM: result.distanceM,
    });
  }

  const totalsBySwimmerId = new Map<string, StatisticsTotals>();

  for (const line of effectiveDistancesByLine.values()) {
    const current = totalsBySwimmerId.get(line.swimmerId) ?? {
      distance25M: 0,
      distance50M: 0,
      totalDistanceM: 0,
    };

    if (line.laneDistanceM === 25) {
      current.distance25M += line.distanceM;
    } else if (line.laneDistanceM === 50) {
      current.distance50M += line.distanceM;
    }

    current.totalDistanceM += line.distanceM;
    totalsBySwimmerId.set(line.swimmerId, current);
  }

  const rows = challenge.swimmers.map((swimmer) => {
    const totals = totalsBySwimmerId.get(swimmer.id) ?? {
      distance25M: 0,
      distance50M: 0,
      totalDistanceM: 0,
    };

    return {
      swimmerId: swimmer.id,
      swimmerNumber: swimmer.number,
      lastName: swimmer.lastName,
      firstName: swimmer.firstName,
      club: swimmer.club?.name ?? "-",
      section: swimmer.section?.name ?? "-",
      distance25M: totals.distance25M,
      distance50M: totals.distance50M,
      totalDistanceM: totals.totalDistanceM,
    } satisfies SwimmerStatisticsRow;
  });

  const clubs = Array.from(new Set(rows.map((row) => row.club).filter((club) => club !== "-"))).sort((a, b) =>
    a.localeCompare(b, "fr-FR"),
  );
  const sections = Array.from(new Set(rows.map((row) => row.section).filter((section) => section !== "-"))).sort((a, b) =>
    a.localeCompare(b, "fr-FR"),
  );

  return {
    challenge: {
      id: challenge.id,
      name: challenge.name,
      eventDate: challenge.eventDate,
      clubOrganisateurLogo: challenge.clubOrganisateurLogo,
    },
    rows,
    clubs,
    sections,
  };
}

export function computeStatisticsView(rows: SwimmerStatisticsRow[], filters: StatisticsFilters) {
  const filteredRows = filterStatisticsRows(rows, filters);
  return {
    rows: filteredRows,
    totals: sumTotals(filteredRows),
  };
}
