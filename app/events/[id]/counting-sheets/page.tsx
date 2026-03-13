import { notFound } from "next/navigation";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireAccessBeforeClosure, requireChallengeAccess } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/app/swimmers/print/print-button";

export const dynamic = "force-dynamic";

const ROWS_PER_SHEET = 16;
const COUNT_BOXES_PER_ROW = 10;

function CountingSheetTemplate() {
  return (
    <article className="counting-sheet flex h-full flex-col border border-slate-900 bg-white p-3">
      <header className="space-y-3 text-[10px] leading-tight">
        <p className="font-semibold">
          Nom - Prénom compteur : <span className="inline-block min-w-[130px] border-b border-dotted border-slate-700">&nbsp;</span>
        </p>

        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-2 gap-y-1">
          <p className="font-semibold">
            Longueur distance ligne : <span className="inline-block min-w-[26px] border-b border-dotted border-slate-700">&nbsp;</span>
          </p>
          <p>mètres</p>
          <p className="justify-self-end font-semibold">Identifiant ligne :</p>
          <p className="inline-block min-w-[24px] border-b border-dotted border-slate-700">&nbsp;</p>
        </div>
      </header>

      <table className="counting-sheet-table mt-3 flex-1 text-[10px]">
        <thead>
          <tr>
            <th className="w-[62px] border border-slate-900 px-1.5 py-1 text-left font-semibold leading-tight">Numéro nageur</th>
            <th className="border border-slate-900 px-1 py-1 text-center text-[20px] font-semibold">Tournée ...</th>
            <th className="w-[54px] border border-slate-900 px-1 py-1 text-center font-semibold">Multi ligne</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS_PER_SHEET }, (_, rowIndex) => (
            <tr key={`row-${rowIndex + 1}`}>
              <td className="border border-slate-900 px-1">&nbsp;</td>
              <td className="border border-slate-900 px-1 py-[2px]">
                <div className="flex justify-center gap-[5px]">
                  {Array.from({ length: COUNT_BOXES_PER_ROW }, (_, boxIndex) => (
                    <span
                      key={`box-${rowIndex + 1}-${boxIndex + 1}`}
                      className="inline-block h-[18px] w-[18px] border border-slate-700"
                    />
                  ))}
                </div>
              </td>
              <td className="border border-slate-900 px-1 py-[2px]">
                <div className="flex justify-center">
                  <span className="inline-block h-[16px] w-[16px] border border-slate-900" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default async function CountingSheetsPrintPage({ params }: { params: { id: string } }) {
  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  await requireChallengeAccess(user, params.id);

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!challenge) notFound();

  return (
    <div className="bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
          }

          *,
          *::before,
          *::after {
            box-sizing: border-box;
          }

          .print-root {
            width: 194mm;
          }

          .print-page {
            width: 194mm;
            height: 281mm;
            break-after: auto;
            break-inside: avoid;
          }

          .counting-sheets-grid {
            display: grid;
            grid-template-columns: 95mm 95mm;
            column-gap: 2mm;
            width: 192mm;
            height: 279mm;
          }

          .counting-sheet-column {
            width: 95mm;
            height: 279mm;
          }

          .counting-sheet-column--right {
            border-left: 1px solid rgb(15 23 42);
            padding-left: 1mm;
          }

          .counting-sheet {
            break-inside: avoid;
          }

          .counting-sheet-table {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            table-layout: fixed;
          }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <BackToMainMenuLink />
          <h1 className="text-lg font-semibold">Fiches de comptage vierges — {challenge.name}</h1>
          <p className="text-sm text-slate-600">Format A4 portrait, 2 fiches par page.</p>
        </div>
        <PrintButton />
      </div>

      <section className="print-page mx-auto aspect-[210/297] w-full max-w-[900px] rounded border border-slate-300 bg-white p-3 print-root print:max-w-none print:rounded-none print:border-none print:p-0">
        <div className="counting-sheets-grid grid h-full grid-cols-2 gap-2">
          <div className="counting-sheet-column pr-1">
            <CountingSheetTemplate />
          </div>
          <div className="counting-sheet-column counting-sheet-column--right pl-1">
            <CountingSheetTemplate />
          </div>
        </div>
      </section>
    </div>
  );
}
