import { prisma } from "@/lib/prisma";

export const DEFAULT_STATISTICS_ROWS_PER_PAGE = 20;
export const MIN_STATISTICS_ROWS_PER_PAGE = 8;
export const MAX_STATISTICS_ROWS_PER_PAGE = 80;

export type StatisticsRow = {
  swimmerId: string;
  number: number;
  firstName: string;
  lastName: string;
  fullName: string;
  club: string;
  section: string;
  totalDistanceM: number;
  totalDistance25M: number;
  totalDistance50M: number;
};

export type StatisticsPageFilters = {
  query: string;
  clubId: string;
  sectionId: string;
  rowsPerPage: number;
};

export type StatisticsPageData = {
  swimmerStats: StatisticsRow[];
  allRows: StatisticsRow[];
  filteredTotalDistanceM: number;
  filteredTotalDistance25M: number;
  filteredTotalDistance50M: number;
  generalTotalDistanceM: number;
  generalTotalDistance25M: number;
  generalTotalDistance50M: number;
  challengeClubs: Array<{ club: { id: string; name: string } }>;
  sections: Array<{ id: string; name: string }>;
};

export type RankedStatisticsRow = StatisticsRow & {
  rank: number;
  isTie: boolean;
};

export const TOP_RANK_LIMIT = 10;

export function parseStatisticsRowsPerPage(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return DEFAULT_STATISTICS_ROWS_PER_PAGE;

  return Math.min(Math.max(parsed, MIN_STATISTICS_ROWS_PER_PAGE), MAX_STATISTICS_ROWS_PER_PAGE);
}

export function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

export function getTopRankedSwimmers(rows: StatisticsRow[], maxRank: number): RankedStatisticsRow[] {
  const sortedRows = rows.slice().sort((a, b) => {
    if (b.totalDistanceM !== a.totalDistanceM) return b.totalDistanceM - a.totalDistanceM;
    return a.number - b.number;
  });

  if (sortedRows.length === 0) return [];

  const distanceCounts = new Map<number, number>();
  for (const row of sortedRows) {
    distanceCounts.set(row.totalDistanceM, (distanceCounts.get(row.totalDistanceM) ?? 0) + 1);
  }

  const rankedRows: RankedStatisticsRow[] = [];
  let previousDistance: number | null = null;
  let rank = 0;

  for (const row of sortedRows) {
    if (previousDistance === null || row.totalDistanceM !== previousDistance) {
      rank += 1;
      previousDistance = row.totalDistanceM;
    }

    if (rank > maxRank) break;

    rankedRows.push({
      ...row,
      rank,
      isTie: (distanceCounts.get(row.totalDistanceM) ?? 0) > 1,
    });
  }

  return rankedRows;
}

export async function getStatisticsPageData(challengeId: string, filters: StatisticsPageFilters): Promise<StatisticsPageData> {
  const [swimmers, finalResults, sheetEntries, challengeClubs, sections] = await Promise.all([
    prisma.swimmer.findMany({
      where: { challengeId },
      include: { club: true, section: true },
      orderBy: [{ number: "asc" }],
    }),
    prisma.finalResult.findMany({
      where: { challengeId },
      select: {
        roundId: true,
        laneId: true,
        swimmerId: true,
        distanceM: true,
        lane: { select: { distanceM: true } },
      },
    }),
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
    prisma.challengeClub.findMany({
      where: { challengeId },
      include: { club: true },
      orderBy: { club: { name: "asc" } },
    }),
    prisma.section.findMany({ orderBy: { name: "asc" } }),
  ]);

  const distanceByKey = new Map<string, { swimmerId: string; laneDistanceM: number; distanceM: number }>();

  for (const entry of sheetEntries) {
    distanceByKey.set(`${entry.sheet.roundId}-${entry.sheet.laneId}-${entry.swimmerId}`, {
      swimmerId: entry.swimmerId,
      laneDistanceM: entry.sheet.lane.distanceM,
      distanceM: entry.distanceM,
    });
  }

  for (const result of finalResults) {
    distanceByKey.set(`${result.roundId}-${result.laneId}-${result.swimmerId}`, {
      swimmerId: result.swimmerId,
      laneDistanceM: result.lane.distanceM,
      distanceM: result.distanceM,
    });
  }

  const totalsBySwimmerId = new Map<string, { totalDistanceM: number; totalDistance25M: number; totalDistance50M: number }>();

  for (const line of distanceByKey.values()) {
    const current = totalsBySwimmerId.get(line.swimmerId) ?? {
      totalDistanceM: 0,
      totalDistance25M: 0,
      totalDistance50M: 0,
    };

    current.totalDistanceM += line.distanceM;
    if (line.laneDistanceM === 25) current.totalDistance25M += line.distanceM;
    if (line.laneDistanceM === 50) current.totalDistance50M += line.distanceM;
    totalsBySwimmerId.set(line.swimmerId, current);
  }

  const swimmersById = new Map(swimmers.map((swimmer) => [swimmer.id, swimmer]));
  const normalizedQuery = filters.query.toLocaleLowerCase("fr-FR");

  const allRows: StatisticsRow[] = swimmers.map((swimmer) => {
    const totals = totalsBySwimmerId.get(swimmer.id) ?? {
      totalDistanceM: 0,
      totalDistance25M: 0,
      totalDistance50M: 0,
    };

    return {
      swimmerId: swimmer.id,
      number: swimmer.number,
      firstName: swimmer.firstName,
      lastName: swimmer.lastName,
      fullName: `${swimmer.firstName} ${swimmer.lastName}`,
      club: swimmer.club?.name ?? "-",
      section: swimmer.section?.name ?? "-",
      ...totals,
    };
  });

  const swimmerStats = allRows
    .filter((row) => {
      if (row.totalDistanceM <= 0) return false;

      const swimmer = swimmersById.get(row.swimmerId);
      if (!swimmer) return false;

      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.fullName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        row.firstName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        row.lastName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        row.club.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        row.section.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        String(row.number).includes(normalizedQuery);

      const matchesClub = !filters.clubId || swimmer.clubId === filters.clubId;
      const matchesSection = !filters.sectionId || swimmer.sectionId === filters.sectionId;

      return matchesQuery && matchesClub && matchesSection;
    })
    .sort((a, b) => a.number - b.number);

  return {
    swimmerStats,
    allRows,
    filteredTotalDistanceM: swimmerStats.reduce((sum, row) => sum + row.totalDistanceM, 0),
    filteredTotalDistance25M: swimmerStats.reduce((sum, row) => sum + row.totalDistance25M, 0),
    filteredTotalDistance50M: swimmerStats.reduce((sum, row) => sum + row.totalDistance50M, 0),
    generalTotalDistanceM: allRows.reduce((sum, row) => sum + row.totalDistanceM, 0),
    generalTotalDistance25M: allRows.reduce((sum, row) => sum + row.totalDistance25M, 0),
    generalTotalDistance50M: allRows.reduce((sum, row) => sum + row.totalDistance50M, 0),
    challengeClubs,
    sections,
  };
}
