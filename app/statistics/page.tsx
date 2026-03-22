import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireChallengeForModule, requireModuleAccess } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatisticsPrintControls } from "./statistics-print-controls";

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

const DEFAULT_ROWS_PER_PAGE = 20;
const MIN_ROWS_PER_PAGE = 8;
const MAX_ROWS_PER_PAGE = 80;

type StatisticsSearchParams = {
  q?: string;
  clubId?: string;
  sectionId?: string;
  rowsPerPage?: string;
};

type StatisticsRow = {
  swimmerId: string;
  number: number;
  fullName: string;
  club: string;
  section: string;
  totalDistanceM: number;
  totalDistance25M: number;
  totalDistance50M: number;
};

function parseRowsPerPage(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return DEFAULT_ROWS_PER_PAGE;

  return Math.min(Math.max(parsed, MIN_ROWS_PER_PAGE), MAX_ROWS_PER_PAGE);
}

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams?: StatisticsSearchParams;
}) {
  const user = await requireSessionUser();

  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Statistique</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer l&apos;écran Statistique.
        </div>
      </div>
    );
  }

  try {
    await requireModuleAccess(user, "statistics");
    const challenge = await requireChallengeForModule(user);

    const query = searchParams?.q?.trim() ?? "";
    const clubId = searchParams?.clubId?.trim() ?? "";
    const sectionId = searchParams?.sectionId?.trim() ?? "";
    const rowsPerPage = parseRowsPerPage(searchParams?.rowsPerPage);

    const [swimmers, finalResults, sheetEntries, challengeClubs, sections] = await Promise.all([
      prisma.swimmer.findMany({
        where: { challengeId: challenge.id },
        include: { club: true, section: true },
        orderBy: [{ number: "asc" }],
      }),
      prisma.finalResult.findMany({
        where: { challengeId: challenge.id },
        select: {
          roundId: true,
          laneId: true,
          swimmerId: true,
          distanceM: true,
          lane: { select: { distanceM: true } },
        },
      }),
      prisma.sheetEntry.findMany({
        where: { sheet: { challengeId: challenge.id } },
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
        where: { challengeId: challenge.id },
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
    const normalizedQuery = query.toLocaleLowerCase("fr-FR");

    const allRows: StatisticsRow[] = swimmers.map((swimmer) => {
      const totals = totalsBySwimmerId.get(swimmer.id) ?? {
        totalDistanceM: 0,
        totalDistance25M: 0,
        totalDistance50M: 0,
      };

      return {
        swimmerId: swimmer.id,
        number: swimmer.number,
        fullName: `${swimmer.firstName} ${swimmer.lastName}`,
        club: swimmer.club?.name ?? "-",
        section: swimmer.section?.name ?? "-",
        ...totals,
      };
    });

    const swimmerStats = allRows
      .filter((row) => {
        const swimmer = swimmersById.get(row.swimmerId);
        if (!swimmer) return false;

        const matchesQuery =
          normalizedQuery.length === 0 ||
          row.fullName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
          row.club.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
          row.section.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
          String(row.number).includes(normalizedQuery);

        const matchesClub = !clubId || swimmer.clubId === clubId;
        const matchesSection = !sectionId || swimmer.sectionId === sectionId;

        return matchesQuery && matchesClub && matchesSection;
      })
      .sort((a, b) => {
        if (b.totalDistanceM !== a.totalDistanceM) return b.totalDistanceM - a.totalDistanceM;
        return a.number - b.number;
      });

    const filteredTotalDistanceM = swimmerStats.reduce((sum, row) => sum + row.totalDistanceM, 0);
    const filteredTotalDistance25M = swimmerStats.reduce((sum, row) => sum + row.totalDistance25M, 0);
    const filteredTotalDistance50M = swimmerStats.reduce((sum, row) => sum + row.totalDistance50M, 0);

    const generalTotalDistanceM = allRows.reduce((sum, row) => sum + row.totalDistanceM, 0);
    const generalTotalDistance25M = allRows.reduce((sum, row) => sum + row.totalDistance25M, 0);
    const generalTotalDistance50M = allRows.reduce((sum, row) => sum + row.totalDistance50M, 0);

    const pages = chunkRows(swimmerStats, rowsPerPage);
    const printedAt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const hasActiveFilters = Boolean(query || clubId || sectionId);

    return (
      <div className="space-y-6">
        <style>{`
          @media print {
            .statistics-screen-controls {
              display: none;
            }

            .statistics-print-page {
              break-after: page;
            }

            .statistics-print-page:last-child {
              break-after: auto;
            }
          }
        `}</style>

        <BackToMainMenuLink />

        <div>
          <h1 className="text-3xl font-semibold">Statistique</h1>
          <p className="text-slate-600">
            Tableau statistique nageurs, filtres et impression centralisés sur un seul écran.
          </p>
        </div>

        <section className="statistics-screen-controls rounded border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Filtres et impression</h2>
              <p className="text-sm text-slate-600">
                Choisissez vos filtres, le nombre de nageurs par page, puis imprimez la statistique filtrée.
              </p>
            </div>
            <StatisticsPrintControls />
          </div>

          <form method="get" className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Recherche</span>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="N°, nom, club, section"
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Club</span>
              <select name="clubId" defaultValue={clubId} className="w-full rounded border border-slate-300 px-3 py-2">
                <option value="">Tous les clubs</option>
                {challengeClubs.map(({ club }) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Section</span>
              <select name="sectionId" defaultValue={sectionId} className="w-full rounded border border-slate-300 px-3 py-2">
                <option value="">Toutes les sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Nageurs par page</span>
              <input
                type="number"
                name="rowsPerPage"
                min={MIN_ROWS_PER_PAGE}
                max={MAX_ROWS_PER_PAGE}
                defaultValue={rowsPerPage}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="flex flex-wrap gap-2 md:col-span-4">
              <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Appliquer les filtres
              </button>
              <a href="/statistics" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                Réinitialiser
              </a>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total filtré</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">{filteredTotalDistanceM.toLocaleString("fr-FR")} m</p>
            <p className="text-sm text-slate-600">{swimmerStats.length} nageur(s) retenu(s)</p>
          </article>
          <article className="rounded border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total filtré 25 m</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredTotalDistance25M.toLocaleString("fr-FR")} m</p>
          </article>
          <article className="rounded border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total filtré 50 m</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredTotalDistance50M.toLocaleString("fr-FR")} m</p>
          </article>
          <article className="rounded border bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total général 25 m</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{generalTotalDistance25M.toLocaleString("fr-FR")} m</p>
          </article>
          <article className="rounded border bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Comparaison total général</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">{generalTotalDistanceM.toLocaleString("fr-FR")} m</p>
            <p className="text-sm text-emerald-800">
              {hasActiveFilters
                ? `Écart : ${(generalTotalDistanceM - filteredTotalDistanceM).toLocaleString("fr-FR")} m`
                : "Aucun filtre actif : total filtré = total général."}
            </p>
            <p className="text-sm text-emerald-800">Total général 50 m : {generalTotalDistance50M.toLocaleString("fr-FR")} m</p>
          </article>
        </section>

        <section className="rounded border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Tableau statistique nageurs</h2>
              <p className="text-sm text-slate-600">Trié par distance totale décroissante, puis par numéro nageur.</p>
            </div>
            <p className="text-sm text-slate-600">Total général de comparaison : {generalTotalDistanceM.toLocaleString("fr-FR")} m</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Nageur</th>
                  <th className="p-2 text-left">Club</th>
                  <th className="p-2 text-left">Section</th>
                  <th className="p-2 text-right">Total 25 m</th>
                  <th className="p-2 text-right">Total 50 m</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {swimmerStats.map((row) => (
                  <tr key={row.swimmerId}>
                    <td className="p-2 font-medium text-slate-900">{row.number}</td>
                    <td className="p-2">{row.fullName}</td>
                    <td className="p-2">{row.club}</td>
                    <td className="p-2">{row.section}</td>
                    <td className="p-2 text-right">{row.totalDistance25M.toLocaleString("fr-FR")} m</td>
                    <td className="p-2 text-right">{row.totalDistance50M.toLocaleString("fr-FR")} m</td>
                    <td className="p-2 text-right font-semibold text-blue-700">{row.totalDistanceM.toLocaleString("fr-FR")} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {swimmerStats.length === 0 ? <p className="mt-3 text-sm text-slate-500">Aucun nageur ne correspond aux filtres.</p> : null}
        </section>

        <section className="space-y-4 print:space-y-0">
          {pages.length === 0 ? (
            <article className="statistics-print-page rounded border bg-white p-4">
              <h2 className="text-xl font-semibold text-slate-900">Impression statistique</h2>
              <p className="mt-2 text-sm text-slate-600">Aucune donnée à imprimer avec les filtres actuels.</p>
            </article>
          ) : (
            pages.map((pageRows, pageIndex) => (
              <article
                key={`statistics-page-${pageIndex + 1}`}
                className="statistics-print-page rounded border bg-white p-4 print:rounded-none print:border-none"
              >
                <header className="mb-4 border-b border-slate-200 pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{challenge.name}</p>
                      <p className="text-sm text-slate-600">Statistique nageurs — impression filtrée</p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <p>Imprimé le {printedAt}</p>
                      <p>Page {pageIndex + 1} / {pages.length}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <p>Total filtré : <span className="font-semibold">{filteredTotalDistanceM.toLocaleString("fr-FR")} m</span></p>
                    <p>Total général : <span className="font-semibold">{generalTotalDistanceM.toLocaleString("fr-FR")} m</span></p>
                    <p>Total filtré 25 m : <span className="font-semibold">{filteredTotalDistance25M.toLocaleString("fr-FR")} m</span></p>
                    <p>Total filtré 50 m : <span className="font-semibold">{filteredTotalDistance50M.toLocaleString("fr-FR")} m</span></p>
                  </div>
                </header>

                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">#</th>
                      <th className="border border-slate-300 p-2 text-left">Nageur</th>
                      <th className="border border-slate-300 p-2 text-left">Club</th>
                      <th className="border border-slate-300 p-2 text-left">Section</th>
                      <th className="border border-slate-300 p-2 text-right">25 m</th>
                      <th className="border border-slate-300 p-2 text-right">50 m</th>
                      <th className="border border-slate-300 p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={`print-row-${row.swimmerId}`}>
                        <td className="border border-slate-300 p-2">{row.number}</td>
                        <td className="border border-slate-300 p-2">{row.fullName}</td>
                        <td className="border border-slate-300 p-2">{row.club}</td>
                        <td className="border border-slate-300 p-2">{row.section}</td>
                        <td className="border border-slate-300 p-2 text-right">{row.totalDistance25M.toLocaleString("fr-FR")} m</td>
                        <td className="border border-slate-300 p-2 text-right">{row.totalDistance50M.toLocaleString("fr-FR")} m</td>
                        <td className="border border-slate-300 p-2 text-right font-semibold">{row.totalDistanceM.toLocaleString("fr-FR")} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))
          )}
        </section>
      </div>
    );
  } catch {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Statistique</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Impossible de se connecter à la base de données. Vérifiez DATABASE_URL.
        </div>
      </div>
    );
  }
}
