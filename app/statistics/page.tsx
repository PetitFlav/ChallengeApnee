import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireChallengeForModule, requireModuleAccess } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import {
  getStatisticsPageData,
  getTopRankedSwimmers,
  MAX_STATISTICS_ROWS_PER_PAGE,
  MIN_STATISTICS_ROWS_PER_PAGE,
  parseStatisticsRowsPerPage,
  TOP_RANK_LIMIT,
} from "@/lib/statistics";
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

type StatisticsSearchParams = {
  q?: string;
  clubId?: string;
  sectionId?: string;
  rowsPerPage?: string;
  top10RowsPerPage?: string;
};

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
    const rowsPerPage = parseStatisticsRowsPerPage(searchParams?.rowsPerPage);
    const top10RowsPerPage = parseStatisticsRowsPerPage(searchParams?.top10RowsPerPage);

    const {
      swimmerStats,
      filteredTotalDistanceM,
      filteredTotalDistance25M,
      filteredTotalDistance50M,
      generalTotalDistanceM,
      generalTotalDistance25M,
      generalTotalDistance50M,
      challengeClubs,
      sections,
    } = await getStatisticsPageData(challenge.id, {
      query,
      clubId,
      sectionId,
      rowsPerPage,
    });

    const topSwimmers = getTopRankedSwimmers(swimmerStats, TOP_RANK_LIMIT);

    const hasActiveFilters = Boolean(query || clubId || sectionId);
    const printParams = new URLSearchParams();
    if (query) printParams.set("q", query);
    if (clubId) printParams.set("clubId", clubId);
    if (sectionId) printParams.set("sectionId", sectionId);
    printParams.set("rowsPerPage", String(rowsPerPage));
    const printHref = `/statistics/print?${printParams.toString()}`;
    const top10PrintHref = `/statistics/print?${new URLSearchParams({
      ...Object.fromEntries(printParams.entries()),
      rowsPerPage: String(top10RowsPerPage),
      view: "top10",
    }).toString()}`;

    return (
      <div className="space-y-6">
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
                Choisissez vos filtres, le nombre de nageurs par page, puis ouvrez la vue dédiée d&apos;impression.
              </p>
            </div>
            <StatisticsPrintControls href={printHref} label="Imprimer la statistique" />
          </div>

          <form method="get" className="mt-4 grid gap-3 md:grid-cols-4">
            <input type="hidden" name="top10RowsPerPage" value={top10RowsPerPage} />
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
                min={MIN_STATISTICS_ROWS_PER_PAGE}
                max={MAX_STATISTICS_ROWS_PER_PAGE}
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
              <p className="text-sm text-slate-600">Trié par numéro de nageur en ordre croissant.</p>
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

        <section className="rounded border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Top 10</h2>
              <p className="text-sm text-slate-600">
                Classement dense calculé sur les 10 premiers rangs à partir des nageurs déjà filtrés dans la statistique générale.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <form method="get" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="q" value={query} />
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="sectionId" value={sectionId} />
                <input type="hidden" name="rowsPerPage" value={rowsPerPage} />
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Nageurs par page</span>
                  <input
                    type="number"
                    name="top10RowsPerPage"
                    min={MIN_STATISTICS_ROWS_PER_PAGE}
                    max={MAX_STATISTICS_ROWS_PER_PAGE}
                    defaultValue={top10RowsPerPage}
                    className="w-28 rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <button type="submit" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  Appliquer
                </button>
              </form>
              <StatisticsPrintControls href={top10PrintHref} label="Imprimer le Top 10" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">Rang</th>
                  <th className="p-2 text-left">Nom</th>
                  <th className="p-2 text-left">Prénom</th>
                  <th className="p-2 text-left">N° nageur</th>
                  <th className="p-2 text-left">Club</th>
                  <th className="p-2 text-left">Section</th>
                  <th className="p-2 text-right">Distance 25 m</th>
                  <th className="p-2 text-right">Distance 50 m</th>
                  <th className="p-2 text-right">Distance totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSwimmers.map((row) => (
                  <tr key={`top10-${row.swimmerId}`}>
                    <td className="p-2 font-semibold text-slate-900">
                      <div>{row.rank}e</div>
                      {row.isTie ? <div className="text-xs font-normal text-slate-500">ex aequo</div> : null}
                    </td>
                    <td className="p-2">{row.lastName}</td>
                    <td className="p-2">{row.firstName}</td>
                    <td className="p-2">{row.number}</td>
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

          {topSwimmers.length === 0 ? <p className="mt-3 text-sm text-slate-500">Aucun nageur ne correspond aux filtres pour le Top 10.</p> : null}
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
