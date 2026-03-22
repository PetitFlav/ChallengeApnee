import Image from "next/image";
import Link from "next/link";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireSessionUser } from "@/lib/auth";
import { getUserAccessibleChallenges, requireModuleAccess } from "@/lib/access";
import {
  buildComparisonMap,
  COMPARISON_SOURCE_OPTIONS,
  comparisonExcelImportSpec,
  computeStatisticsView,
  getChallengeStatisticsData,
  getComparisonKey,
  type ComparisonSource,
} from "@/lib/statistics";

export const dynamic = "force-dynamic";

type SearchParams = {
  challengeId?: string;
  lastName?: string;
  firstName?: string;
  club?: string;
  section?: string;
  compare?: string;
  comparisonSource?: string;
  comparisonChallengeId?: string;
};

function formatDistance(distanceM: number) {
  return distanceM.toLocaleString("fr-FR");
}

function isComparisonSource(value: string | undefined): value is ComparisonSource {
  return value === COMPARISON_SOURCE_OPTIONS.event || value === COMPARISON_SOURCE_OPTIONS.excel;
}

export default async function StatisticsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireSessionUser();
  await requireModuleAccess(user, "dashboard");

  const challenges = await getUserAccessibleChallenges(user);
  const selectedChallengeId = searchParams?.challengeId ?? challenges[0]?.id;
  const selectedChallenge = selectedChallengeId ? challenges.find((challenge) => challenge.id === selectedChallengeId) ?? null : null;

  if (!selectedChallenge) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Statistique</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Aucun événement accessible pour afficher les statistiques.
        </div>
      </div>
    );
  }

  const comparisonEnabled = searchParams?.compare === "1";
  const comparisonSource = isComparisonSource(searchParams?.comparisonSource)
    ? searchParams?.comparisonSource
    : COMPARISON_SOURCE_OPTIONS.event;

  const filters = {
    lastName: searchParams?.lastName?.trim() ?? "",
    firstName: searchParams?.firstName?.trim() ?? "",
    club: searchParams?.club?.trim() ?? "",
    section: searchParams?.section?.trim() ?? "",
  };

  const currentData = await getChallengeStatisticsData(selectedChallenge.id);

  if (!currentData) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Statistique</h1>
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
          Impossible de charger les statistiques de l&apos;événement sélectionné.
        </div>
      </div>
    );
  }

  const comparisonChallengeId =
    comparisonEnabled && comparisonSource === COMPARISON_SOURCE_OPTIONS.event
      ? searchParams?.comparisonChallengeId?.trim() || ""
      : "";

  const comparisonChallenge = comparisonChallengeId
    ? challenges.find((challenge) => challenge.id === comparisonChallengeId && challenge.id !== selectedChallenge.id) ?? null
    : null;

  const comparisonData = comparisonChallenge ? await getChallengeStatisticsData(comparisonChallenge.id) : null;

  const currentView = computeStatisticsView(currentData.rows, filters);
  const comparisonRowsByName = comparisonData ? buildComparisonMap(comparisonData.rows) : new Map();
  const comparisonTotals = currentView.rows.reduce(
    (totals, row) => {
      const comparisonRow = comparisonRowsByName.get(getComparisonKey(row.lastName, row.firstName));
      if (!comparisonRow) return totals;

      return {
        distance25M: totals.distance25M + comparisonRow.distance25M,
        distance50M: totals.distance50M + comparisonRow.distance50M,
        totalDistanceM: totals.totalDistanceM + comparisonRow.totalDistanceM,
      };
    },
    { distance25M: 0, distance50M: 0, totalDistanceM: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <BackToMainMenuLink />
        <Link href="/dashboard" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Voir le dashboard
        </Link>
      </div>

      <div className="statistics-print-header rounded border bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Cartouche événement</p>
            <h1 className="text-3xl font-semibold">Statistique</h1>
            <p className="text-slate-600">
              {currentData.challenge.name} · {currentData.challenge.eventDate.toLocaleDateString("fr-FR")}
            </p>
          </div>
          {currentData.challenge.clubOrganisateurLogo ? (
            <Image
              src={currentData.challenge.clubOrganisateurLogo}
              alt="Logo de l&apos;événement"
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded object-contain"
              unoptimized
            />
          ) : null}
        </div>
      </div>

      <section className="rounded border bg-white p-4 print:hidden">
        <form className="space-y-4" method="get">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Événement</span>
              <select name="challengeId" defaultValue={selectedChallenge.id} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Nom</span>
              <input
                type="text"
                name="lastName"
                defaultValue={filters.lastName}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tous les noms"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Prénom</span>
              <input
                type="text"
                name="firstName"
                defaultValue={filters.firstName}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tous les prénoms"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Club</span>
              <select name="club" defaultValue={filters.club} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">Tous les clubs</option>
                {currentData.clubs.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Section</span>
              <select name="section" defaultValue={filters.section} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">Toutes les sections</option>
                {currentData.sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4 rounded border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="compare" value="1" defaultChecked={comparisonEnabled} className="h-4 w-4 rounded border-slate-300" />
              Comparaison
            </label>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Source de comparaison</span>
                <select
                  name="comparisonSource"
                  defaultValue={comparisonSource}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={COMPARISON_SOURCE_OPTIONS.event}>Autre événement</option>
                  <option value={COMPARISON_SOURCE_OPTIONS.excel}>Import Excel (à venir)</option>
                </select>
              </label>

              {comparisonSource === COMPARISON_SOURCE_OPTIONS.event ? (
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Événement de comparaison</span>
                  <select
                    name="comparisonChallengeId"
                    defaultValue={comparisonChallenge?.id ?? ""}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner un événement</option>
                    {challenges
                      .filter((challenge) => challenge.id !== selectedChallenge.id)
                      .map((challenge) => (
                        <option key={challenge.id} value={challenge.id}>
                          {challenge.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <div className="rounded border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
                  Import Excel prévu : correspondance par nom + prénom, avec colonnes attendues&nbsp;
                  {comparisonExcelImportSpec.expectedColumns.join(", ")}.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Appliquer les filtres
            </button>
            <Link href="/statistics" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Réinitialiser
            </Link>
          </div>
        </form>
      </section>


      {comparisonEnabled && comparisonSource === COMPARISON_SOURCE_OPTIONS.event && !comparisonChallenge ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
          Activez un événement de comparaison pour afficher les valeurs secondaires sous chaque distance.
        </div>
      ) : null}

      <section className="rounded border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tableau des performances</h2>
            <p className="text-sm text-slate-600">
              Priorité aux données finales validées, sinon conservation de la saisie initiale.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {currentView.rows.length} nageur{currentView.rows.length > 1 ? "s" : ""} affiché{currentView.rows.length > 1 ? "s" : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-3 py-3 font-semibold">Nom</th>
                <th className="px-3 py-3 font-semibold">Prénom</th>
                <th className="px-3 py-3 font-semibold">Numéro de nageur</th>
                <th className="px-3 py-3 font-semibold">Club</th>
                <th className="px-3 py-3 font-semibold">Section</th>
                <th className="px-3 py-3 font-semibold">Distance parcourue en 25m</th>
                <th className="px-3 py-3 font-semibold">Distance parcourue en 50m</th>
                <th className="px-3 py-3 font-semibold">Distance totale tous formats confondus</th>
              </tr>
            </thead>
            <tbody>
              {currentView.rows.map((row) => {
                const comparisonRow = comparisonRowsByName.get(getComparisonKey(row.lastName, row.firstName));

                return (
                  <tr key={row.swimmerId} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 font-medium text-slate-900">{row.lastName}</td>
                    <td className="px-3 py-3">{row.firstName}</td>
                    <td className="px-3 py-3">{row.swimmerNumber}</td>
                    <td className="px-3 py-3">{row.club}</td>
                    <td className="px-3 py-3">{row.section}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{formatDistance(row.distance25M)} m</div>
                      {comparisonEnabled && comparisonRow ? (
                        <div className="text-xs text-slate-500">{formatDistance(comparisonRow.distance25M)} m</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{formatDistance(row.distance50M)} m</div>
                      {comparisonEnabled && comparisonRow ? (
                        <div className="text-xs text-slate-500">{formatDistance(comparisonRow.distance50M)} m</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{formatDistance(row.totalDistanceM)} m</div>
                      {comparisonEnabled && comparisonRow ? (
                        <div className="text-xs text-slate-500">{formatDistance(comparisonRow.totalDistanceM)} m</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={5} className="px-3 py-3 font-semibold text-slate-900">
                  Total général
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-900">{formatDistance(currentView.totals.distance25M)} m</div>
                  {comparisonEnabled && comparisonData ? (
                    <div className="text-xs text-slate-500">{formatDistance(comparisonTotals.distance25M)} m</div>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-900">{formatDistance(currentView.totals.distance50M)} m</div>
                  {comparisonEnabled && comparisonData ? (
                    <div className="text-xs text-slate-500">{formatDistance(comparisonTotals.distance50M)} m</div>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-900">{formatDistance(currentView.totals.totalDistanceM)} m</div>
                  {comparisonEnabled && comparisonData ? (
                    <div className="text-xs text-slate-500">{formatDistance(comparisonTotals.totalDistanceM)} m</div>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="statistics-print-footer rounded border bg-white p-4 text-sm text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {currentData.challenge.name} · statistiques nageurs · impression / export prête.
          </p>
          <p className="statistics-page-number print:block">Page </p>
        </div>
      </div>
    </div>
  );
}
