import Image from "next/image";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { requireSessionUser } from "@/lib/auth";
import { requirePreferredChallengeForUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_ROWS_PER_PAGE = 24;
const MIN_ROWS_PER_PAGE = 8;
const MAX_ROWS_PER_PAGE = 80;

type PrintableRow = {
  number: number;
  fullName: string;
  club: string;
};

function parseRowsPerPage(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return DEFAULT_ROWS_PER_PAGE;

  return Math.min(Math.max(parsed, MIN_ROWS_PER_PAGE), MAX_ROWS_PER_PAGE);
}

function chunkRows(rows: PrintableRow[], chunkSize: number) {
  const chunks: PrintableRow[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

export default async function SwimmersPrintPage({
  searchParams,
}: {
  searchParams?: { rowsPerPage?: string };
}) {
  const rowsPerPage = parseRowsPerPage(searchParams?.rowsPerPage);
  const rowsPerColumn = Math.ceil(rowsPerPage / 2);

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);

  const swimmers = await prisma.swimmer.findMany({
    where: { challengeId: challenge.id },
    include: { club: true },
    orderBy: [{ number: "asc" }],
  });

  const maxSwimmerNumber = swimmers.length > 0 ? swimmers[swimmers.length - 1].number : 0;
  const minimumRows = Math.max(swimmers.length, rowsPerPage);
  const printableRowsCount = Math.ceil(minimumRows / rowsPerPage) * rowsPerPage;

  const printableRows: PrintableRow[] = [
    ...swimmers.map((swimmer) => ({
      number: swimmer.number,
      fullName: `${swimmer.firstName} ${swimmer.lastName}`,
      club: swimmer.club?.name ?? "",
    })),
    ...Array.from({ length: printableRowsCount - swimmers.length }, (_, index) => ({
      number: maxSwimmerNumber + index + 1,
      fullName: "",
      club: "",
    })),
  ];

  const pages = chunkRows(printableRows, rowsPerPage);
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
          .print-page {
            break-after: page;
          }

          .print-page:last-child {
            break-after: auto;
          }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Prévisualisation impression — Liste des nageurs</h1>
        <button type="button" onClick={() => window.print()} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <div className="mx-auto max-w-[1120px] space-y-4 print:max-w-none print:space-y-0">
        {pages.map((pageRows, pageIndex) => {
          const leftRows = pageRows.slice(0, rowsPerColumn);
          const rightRows = pageRows.slice(rowsPerColumn, rowsPerPage);

          return (
            <section
              key={`page-${pageIndex + 1}`}
              className="print-page flex min-h-[760px] flex-col rounded border border-slate-300 bg-white p-6 print:min-h-0 print:rounded-none print:border-none print:p-0"
            >
              <header className="mb-4 flex items-center justify-between border-b border-slate-400 pb-3">
                <div className="flex items-center gap-4">
                  {challenge.clubOrganisateurLogo ? (
                    <Image
                      src={challenge.clubOrganisateurLogo}
                      alt="Logo de l'événement"
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center border border-dashed border-slate-400 text-center text-[11px] text-slate-500">
                      Sans logo
                    </div>
                  )}
                  <div>
                    <p className="text-3xl font-extrabold uppercase tracking-wide">{challenge.name}</p>
                    <p className="text-base font-medium">Liste des nageurs</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Imprimé le {printedAt}</p>
              </header>

              <main className="grid flex-1 grid-cols-2 gap-4">
                {[leftRows, rightRows].map((columnRows, columnIndex) => (
                  <table key={`column-${columnIndex + 1}`} className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="w-16 border border-slate-900 px-2 py-2 text-base font-semibold">N°</th>
                        <th className="border border-slate-900 px-2 py-2 text-base font-semibold">Prénom Nom</th>
                        <th className="w-40 border border-slate-900 px-2 py-2 text-base font-semibold">Club</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columnRows.map((row) => (
                        <tr key={`row-${pageIndex + 1}-${columnIndex + 1}-${row.number}`}>
                          <td className="border border-slate-900 px-2 py-4 align-middle text-2xl font-extrabold leading-none">{row.number}</td>
                          <td className="border border-slate-900 px-2 py-4 align-middle text-lg font-medium">{row.fullName}</td>
                          <td className="border border-slate-900 px-2 py-4 align-middle text-base">{row.club}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </main>

              <footer className="mt-4 border-t border-slate-400 pt-2 text-right text-sm text-slate-700">
                {APP_NAME} — v{APP_VERSION} — page {pageIndex + 1} / {pages.length}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
