"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

type StatisticsRow = {
  swimmerId: string;
  number: number;
  firstName: string;
  lastName: string;
  club: string;
  section: string;
  total25M: number;
  total50M: number;
  totalDistanceM: number;
};

type StatisticsPanelProps = {
  challengeName: string;
  challengeDateLabel: string;
  clubOrganisateur: string;
  clubOrganisateurLogo: string | null;
  rows: StatisticsRow[];
  totalEvent25M: number;
  totalEvent50M: number;
  totalEventDistanceM: number;
};

const DEFAULT_ROWS_PER_PAGE = 18;
const MIN_ROWS_PER_PAGE = 8;
const MAX_ROWS_PER_PAGE = 60;

function formatDistance(distanceM: number) {
  return `${distanceM.toLocaleString("fr-FR")} m`;
}

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

export function StatisticsPanel({
  challengeName,
  challengeDateLabel,
  clubOrganisateur,
  clubOrganisateurLogo,
  rows,
  totalEvent25M,
  totalEvent50M,
  totalEventDistanceM,
}: StatisticsPanelProps) {
  const [query, setQuery] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const clubs = useMemo(
    () => Array.from(new Set(rows.map((row) => row.club).filter((club) => club.trim().length > 0))).sort((a, b) => a.localeCompare(b, "fr")),
    [rows],
  );
  const sections = useMemo(
    () => Array.from(new Set(rows.map((row) => row.section).filter((section) => section.trim().length > 0))).sort((a, b) => a.localeCompare(b, "fr")),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");

    return rows.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.number.toString().includes(normalizedQuery) ||
        row.firstName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        row.lastName.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
        `${row.firstName} ${row.lastName}`.toLocaleLowerCase("fr-FR").includes(normalizedQuery);
      const matchesClub = clubFilter === "all" || row.club === clubFilter;
      const matchesSection = sectionFilter === "all" || row.section === sectionFilter;

      return matchesQuery && matchesClub && matchesSection;
    });
  }, [clubFilter, query, rows, sectionFilter]);

  const filteredTotals = useMemo(
    () =>
      filteredRows.reduce(
        (accumulator, row) => ({
          total25M: accumulator.total25M + row.total25M,
          total50M: accumulator.total50M + row.total50M,
          totalDistanceM: accumulator.totalDistanceM + row.totalDistanceM,
        }),
        { total25M: 0, total50M: 0, totalDistanceM: 0 },
      ),
    [filteredRows],
  );

  const printablePages = useMemo(() => {
    const pages = chunkRows(filteredRows, rowsPerPage);
    return pages.length > 0 ? pages : [[]];
  }, [filteredRows, rowsPerPage]);

  return (
    <section className="space-y-4 rounded border bg-white p-4">
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

          .statistics-screen-controls {
            display: none !important;
          }

          .statistics-print-root {
            display: block !important;
          }

          .statistics-print-page {
            break-after: page;
          }

          .statistics-print-page:last-child {
            break-after: auto;
          }
        }
      `}</style>

      <div className="statistics-screen-controls flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Statistiques nageurs</h2>
          <p className="text-sm text-slate-600">Filtres simples et impression paginée pour laptop et PDF.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Nageurs par page</span>
            <input
              type="number"
              min={MIN_ROWS_PER_PAGE}
              max={MAX_ROWS_PER_PAGE}
              value={rowsPerPage}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) return;
                setRowsPerPage(Math.min(Math.max(Math.trunc(nextValue), MIN_ROWS_PER_PAGE), MAX_ROWS_PER_PAGE));
              }}
              className="w-28 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Imprimer
          </button>
        </div>
      </div>

      <div className="statistics-screen-controls grid gap-3 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Recherche</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="N° / nom / prénom"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Club</span>
          <select value={clubFilter} onChange={(event) => setClubFilter(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Tous les clubs</option>
            {clubs.map((club) => (
              <option key={club} value={club}>
                {club}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Section</span>
          <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Toutes les sections</option>
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </label>

        <article className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Totaux filtrés</p>
          <p>25m : {formatDistance(filteredTotals.total25M)}</p>
          <p>50m : {formatDistance(filteredTotals.total50M)}</p>
          <p>Total : {formatDistance(filteredTotals.totalDistanceM)}</p>
        </article>
      </div>

      <div className="statistics-screen-controls overflow-x-auto rounded border">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">N°</th>
              <th className="p-2 text-left">Nom</th>
              <th className="p-2 text-left">Prénom</th>
              <th className="p-2 text-left">Club</th>
              <th className="p-2 text-left">Section</th>
              <th className="p-2 text-right">Total 25m</th>
              <th className="p-2 text-right">Total 50m</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredRows.map((row) => (
              <tr key={row.swimmerId}>
                <td className="p-2">{row.number}</td>
                <td className="p-2 font-medium text-slate-900">{row.lastName}</td>
                <td className="p-2">{row.firstName}</td>
                <td className="p-2">{row.club || "-"}</td>
                <td className="p-2">{row.section || "-"}</td>
                <td className="p-2 text-right">{formatDistance(row.total25M)}</td>
                <td className="p-2 text-right">{formatDistance(row.total50M)}</td>
                <td className="p-2 text-right font-semibold text-slate-900">{formatDistance(row.totalDistanceM)}</td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-500">
                  Aucun nageur ne correspond aux filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="statistics-print-root hidden">
        {printablePages.map((pageRows, pageIndex) => (
          <section
            key={`statistics-print-page-${pageIndex + 1}`}
            className="statistics-print-page flex min-h-[760px] flex-col bg-white p-6 text-slate-950"
          >
            <header className="mb-4 flex items-center justify-between border-b border-slate-300 pb-3">
              <div className="flex items-center gap-4">
                {clubOrganisateurLogo ? (
                  <Image src={clubOrganisateurLogo} alt="Logo événement" width={72} height={72} className="h-[72px] w-[72px] object-contain" unoptimized />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center border border-dashed border-slate-300 text-center text-[11px] text-slate-500">
                    Sans logo
                  </div>
                )}
                <div>
                  <p className="text-2xl font-extrabold uppercase tracking-wide">{challengeName}</p>
                  <p className="text-base font-medium">Statistiques nageurs</p>
                  <p className="text-sm text-slate-600">{challengeDateLabel} · {clubOrganisateur}</p>
                </div>
              </div>
              <div className="text-right text-sm text-slate-600">
                <p>Nageurs filtrés : {filteredRows.length}</p>
                <p>Nageurs par page : {rowsPerPage}</p>
              </div>
            </header>

            <main className="flex-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-900 px-2 py-2 text-left">N°</th>
                    <th className="border border-slate-900 px-2 py-2 text-left">Nom</th>
                    <th className="border border-slate-900 px-2 py-2 text-left">Prénom</th>
                    <th className="border border-slate-900 px-2 py-2 text-left">Club</th>
                    <th className="border border-slate-900 px-2 py-2 text-left">Section</th>
                    <th className="border border-slate-900 px-2 py-2 text-right">25m</th>
                    <th className="border border-slate-900 px-2 py-2 text-right">50m</th>
                    <th className="border border-slate-900 px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={`print-row-${pageIndex + 1}-${row.swimmerId}`}>
                      <td className="border border-slate-900 px-2 py-2">{row.number}</td>
                      <td className="border border-slate-900 px-2 py-2 font-medium">{row.lastName}</td>
                      <td className="border border-slate-900 px-2 py-2">{row.firstName}</td>
                      <td className="border border-slate-900 px-2 py-2">{row.club || "-"}</td>
                      <td className="border border-slate-900 px-2 py-2">{row.section || "-"}</td>
                      <td className="border border-slate-900 px-2 py-2 text-right">{formatDistance(row.total25M)}</td>
                      <td className="border border-slate-900 px-2 py-2 text-right">{formatDistance(row.total50M)}</td>
                      <td className="border border-slate-900 px-2 py-2 text-right font-semibold">{formatDistance(row.totalDistanceM)}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-900 px-2 py-8 text-center text-slate-500">
                        Aucun nageur à imprimer pour les filtres courants.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </main>

            <footer className="mt-4 border-t border-slate-300 pt-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">Total distance 25m filtré</p>
                  <p className="text-lg font-bold text-slate-950">{formatDistance(filteredTotals.total25M)}</p>
                  <p className="text-xs text-slate-500">Total général événement : {formatDistance(totalEvent25M)}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">Total distance 50m filtré</p>
                  <p className="text-lg font-bold text-slate-950">{formatDistance(filteredTotals.total50M)}</p>
                  <p className="text-xs text-slate-500">Total général événement : {formatDistance(totalEvent50M)}</p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">Distance totale filtrée</p>
                  <p className="text-lg font-bold text-slate-950">{formatDistance(filteredTotals.totalDistanceM)}</p>
                  <p className="text-xs text-slate-500">Total général événement : {formatDistance(totalEventDistanceM)}</p>
                </div>
              </div>
              <div className="mt-3 text-right text-sm text-slate-600">
                {APP_NAME} — v{APP_VERSION} — page {pageIndex + 1} / {printablePages.length}
              </div>
            </footer>
          </section>
        ))}
      </div>
    </section>
  );
}
