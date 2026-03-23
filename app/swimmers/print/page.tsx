import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireAccessBeforeClosure, requirePreferredChallengeForUser } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const DEFAULT_SWIMMERS_PER_PRINT_PAGE = 24;
const MIN_SWIMMERS_PER_PRINT_PAGE = 8;
const MAX_SWIMMERS_PER_PRINT_PAGE = 60;

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

function parseSwimmersPerPrintPage(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return DEFAULT_SWIMMERS_PER_PRINT_PAGE;

  return Math.min(Math.max(parsed, MIN_SWIMMERS_PER_PRINT_PAGE), MAX_SWIMMERS_PER_PRINT_PAGE);
}

export default async function SwimmersPrintPage({
  searchParams,
}: {
  searchParams?: { q?: string; extraPages?: string; swimmersPerPage?: string };
}) {
  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const challenge = await requirePreferredChallengeForUser(user);

  const query = searchParams?.q?.trim() ?? "";
  const extraPages = Math.max(Number(searchParams?.extraPages) || 0, 0);
  const swimmersPerPage = parseSwimmersPerPrintPage(searchParams?.swimmersPerPage);
  const searchNumber = Number(query);
  const hasSearchNumber = !Number.isNaN(searchNumber);

  const searchFilter = {
    challengeId: challenge.id,
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: "insensitive" as const } },
            { lastName: { contains: query, mode: "insensitive" as const } },
            ...(hasSearchNumber ? [{ number: searchNumber }] : []),
          ],
        }
      : {}),
  };

  const swimmers = await prisma.swimmer.findMany({
    where: searchFilter,
    include: { club: true },
    orderBy: [{ number: "asc" }],
  });

  const swimmerPages = chunkRows(swimmers, swimmersPerPage);
  const blankPages = Array.from({ length: extraPages }, () => [] as typeof swimmers);
  const pages = [...(swimmerPages.length > 0 ? swimmerPages : [[]]), ...blankPages];
  const printQuery = new URLSearchParams();
  if (query) printQuery.set("q", query);
  printQuery.set("swimmersPerPage", String(swimmersPerPage));

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

          .swimmers-print-page {
            break-after: page;
          }

          .swimmers-print-page:last-child {
            break-after: auto;
          }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <BackToMainMenuLink />
          <h1 className="text-lg font-semibold">Tableau nageurs à imprimer — {challenge.name}</h1>
          <p className="text-sm text-slate-600">
            {swimmers.length} nageur(s), {Math.max(swimmerPages.length, 1)} page(s) de données, {extraPages} page(s) vierge(s).
          </p>
          <p className="text-sm text-slate-600">Pagination contrôlée à {swimmersPerPage} nageur(s) par page.</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-3">
            {query ? <input type="hidden" name="q" value={query} /> : null}
            {extraPages > 0 ? <input type="hidden" name="extraPages" value={extraPages} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Nageurs par page</span>
              <input
                name="swimmersPerPage"
                type="number"
                min={MIN_SWIMMERS_PER_PRINT_PAGE}
                max={MAX_SWIMMERS_PER_PRINT_PAGE}
                defaultValue={swimmersPerPage}
                className="w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Appliquer
            </button>
          </form>

          <PrintButton
            currentPages={Math.max(swimmerPages.length, 1)}
            extraPages={extraPages}
            searchParams={printQuery.toString()}
            currentPagesLabel="Pages de données"
            extraPagesLabel="Pages vierges"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-4 print:max-w-none print:space-y-0">
        {pages.map((pageRows, pageIndex) => (
          <section
            key={`swimmers-print-page-${pageIndex + 1}`}
            className="swimmers-print-page rounded border bg-white p-4 print:rounded-none print:border-none"
          >
            <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-2xl font-bold text-slate-900">{challenge.name}</p>
                <p className="text-sm text-slate-600">Tableau nageurs — page {pageIndex + 1}</p>
              </div>
              <div className="text-right text-sm text-slate-600">
                <p>Nageurs affichés : {pageRows.length}</p>
                <p>Pagination : {swimmersPerPage} nageur(s) / page</p>
                <p>Page {pageIndex + 1} / {pages.length}</p>
              </div>
            </header>

            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 p-2 text-left">N°</th>
                  <th className="border border-slate-300 p-2 text-left">Prénom</th>
                  <th className="border border-slate-300 p-2 text-left">Nom</th>
                  <th className="border border-slate-300 p-2 text-left">Club</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length > 0
                  ? pageRows.map((swimmer) => (
                      <tr key={swimmer.id}>
                        <td className="border border-slate-300 p-2">{swimmer.number}</td>
                        <td className="border border-slate-300 p-2">{swimmer.firstName}</td>
                        <td className="border border-slate-300 p-2">{swimmer.lastName}</td>
                        <td className="border border-slate-300 p-2">{swimmer.club?.name ?? "-"}</td>
                      </tr>
                    ))
                  : Array.from({ length: swimmersPerPage }, (_, rowIndex) => (
                      <tr key={`blank-row-${pageIndex + 1}-${rowIndex + 1}`}>
                        <td className="border border-slate-300 p-2">&nbsp;</td>
                        <td className="border border-slate-300 p-2">&nbsp;</td>
                        <td className="border border-slate-300 p-2">&nbsp;</td>
                        <td className="border border-slate-300 p-2">&nbsp;</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
