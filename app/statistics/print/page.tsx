import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { PrintButton } from "@/app/swimmers/print/print-button";
import { requireChallengeForModule, requireModuleAccess } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import { chunkRows, getStatisticsPageData, parseStatisticsRowsPerPage } from "@/lib/statistics";

export const dynamic = "force-dynamic";

const TOP_TEN_SIZE = 10;

type StatisticsPrintSearchParams = {
  q?: string;
  clubId?: string;
  sectionId?: string;
  rowsPerPage?: string;
  view?: string;
};

export default async function StatisticsPrintPage({
  searchParams,
}: {
  searchParams?: StatisticsPrintSearchParams;
}) {
  const user = await requireSessionUser();
  await requireModuleAccess(user, "statistics");
  const challenge = await requireChallengeForModule(user);

  const query = searchParams?.q?.trim() ?? "";
  const clubId = searchParams?.clubId?.trim() ?? "";
  const sectionId = searchParams?.sectionId?.trim() ?? "";
  const rowsPerPage = parseStatisticsRowsPerPage(searchParams?.rowsPerPage);
  const printView = searchParams?.view === "top10" ? "top10" : "general";

  const {
    swimmerStats,
    filteredTotalDistanceM,
    filteredTotalDistance25M,
    filteredTotalDistance50M,
    generalTotalDistanceM,
  } = await getStatisticsPageData(challenge.id, {
    query,
    clubId,
    sectionId,
    rowsPerPage,
  });

  const rowsToPrint =
    printView === "top10"
      ? swimmerStats
          .slice()
          .sort((a, b) => {
            if (b.totalDistanceM !== a.totalDistanceM) return b.totalDistanceM - a.totalDistanceM;
            return a.number - b.number;
          })
          .slice(0, TOP_TEN_SIZE)
      : swimmerStats;

  const pages = chunkRows(rowsToPrint, printView === "top10" ? TOP_TEN_SIZE : rowsPerPage);
  const printedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
          }

          .statistics-print-page {
            break-after: page;
          }

          .statistics-print-page:last-child {
            break-after: auto;
          }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <BackToMainMenuLink />
          <h1 className="text-lg font-semibold">
            {printView === "top10" ? "Impression Top 10" : "Impression statistique"} — {challenge.name}
          </h1>
          <p className="text-sm text-slate-600">
            {rowsToPrint.length} nageur(s) filtré(s)
            {printView === "top10"
              ? ", classement limité aux 10 meilleurs nageurs."
              : `, ${rowsPerPage} lignes par tableau, ${Math.max(pages.length, 1)} page(s).`}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[1400px] space-y-4 print:max-w-none print:space-y-0">
        {pages.length === 0 ? (
          <article className="statistics-print-page rounded border bg-white p-4 print:rounded-none print:border-none">
            <h2 className="text-xl font-semibold text-slate-900">
              {printView === "top10" ? "Impression Top 10" : "Impression statistique"}
            </h2>
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
                    <p className="text-sm text-slate-600">
                      {printView === "top10"
                        ? "Top 10 nageurs — impression filtrée, tri par distance totale décroissante"
                        : "Statistique nageurs — impression filtrée, tri par numéro croissant"}
                    </p>
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
                  {printView === "top10" ? (
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">Rang</th>
                      <th className="border border-slate-300 p-2 text-left">Nom</th>
                      <th className="border border-slate-300 p-2 text-left">Prénom</th>
                      <th className="border border-slate-300 p-2 text-left">N° nageur</th>
                      <th className="border border-slate-300 p-2 text-left">Club</th>
                      <th className="border border-slate-300 p-2 text-left">Section</th>
                      <th className="border border-slate-300 p-2 text-right">25 m</th>
                      <th className="border border-slate-300 p-2 text-right">50 m</th>
                      <th className="border border-slate-300 p-2 text-right">Total</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">#</th>
                      <th className="border border-slate-300 p-2 text-left">Nageur</th>
                      <th className="border border-slate-300 p-2 text-left">Club</th>
                      <th className="border border-slate-300 p-2 text-left">Section</th>
                      <th className="border border-slate-300 p-2 text-right">25 m</th>
                      <th className="border border-slate-300 p-2 text-right">50 m</th>
                      <th className="border border-slate-300 p-2 text-right">Total</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {pageRows.map((row, rowIndex) => (
                    <tr key={`print-row-${row.swimmerId}`}>
                      {printView === "top10" ? (
                        <>
                          <td className="border border-slate-300 p-2">{pageIndex * TOP_TEN_SIZE + rowIndex + 1}</td>
                          <td className="border border-slate-300 p-2">{row.lastName}</td>
                          <td className="border border-slate-300 p-2">{row.firstName}</td>
                          <td className="border border-slate-300 p-2">{row.number}</td>
                          <td className="border border-slate-300 p-2">{row.club}</td>
                          <td className="border border-slate-300 p-2">{row.section}</td>
                          <td className="border border-slate-300 p-2 text-right">{row.totalDistance25M.toLocaleString("fr-FR")} m</td>
                          <td className="border border-slate-300 p-2 text-right">{row.totalDistance50M.toLocaleString("fr-FR")} m</td>
                          <td className="border border-slate-300 p-2 text-right font-semibold">{row.totalDistanceM.toLocaleString("fr-FR")} m</td>
                        </>
                      ) : (
                        <>
                          <td className="border border-slate-300 p-2">{row.number}</td>
                          <td className="border border-slate-300 p-2">{row.fullName}</td>
                          <td className="border border-slate-300 p-2">{row.club}</td>
                          <td className="border border-slate-300 p-2">{row.section}</td>
                          <td className="border border-slate-300 p-2 text-right">{row.totalDistance25M.toLocaleString("fr-FR")} m</td>
                          <td className="border border-slate-300 p-2 text-right">{row.totalDistance50M.toLocaleString("fr-FR")} m</td>
                          <td className="border border-slate-300 p-2 text-right font-semibold">{row.totalDistanceM.toLocaleString("fr-FR")} m</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
