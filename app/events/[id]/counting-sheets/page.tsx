import { notFound } from "next/navigation";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireAccessBeforeClosure, requireChallengeAccess } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/app/swimmers/print/print-button";

export const dynamic = "force-dynamic";

const ROWS_PER_SHEET = 16;
const COUNT_BOXES_PER_ROW = 12;

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

      <table className="mt-3 w-full flex-1 border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="w-[62px] border border-slate-900 px-1.5 py-1 text-left font-semibold leading-tight">Numéro nageur</th>
            <th className="border border-slate-900 px-1 py-1 text-center text-[20px] font-semibold">Tournée ...</th>
            <th className="w-[54px] border border-slate-900 px-1 py-1 text-center font-semibold">Totaux</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS_PER_SHEET }, (_, rowIndex) => (
            <tr key={`row-${rowIndex + 1}`}>
              <td className="border border-slate-900 px-1">&nbsp;</td>
              <td className="border border-slate-900 px-1 py-[2px]">
                <div className="flex justify-center gap-[8px]">
                  {Array.from({ length: COUNT_BOXES_PER_ROW }, (_, boxIndex) => (
                    <span
                      key={`box-${rowIndex + 1}-${boxIndex + 1}`}
                      className="inline-block h-[14px] w-[14px] border border-dotted border-slate-700"
                    />
                  ))}
                </div>
              </td>
              <td className="border border-slate-900 px-1">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-3 flex justify-end text-[10px] font-semibold">
        <div className="flex items-center gap-1">
          <span>Total Feuille :</span>
          <span className="inline-block h-[28px] w-[72px] border-[3px] border-slate-900" />
        </div>
      </footer>
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
          .print-page {
            break-after: page;
          }

          .print-page:last-child {
            break-after: auto;
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

      <section className="print-page mx-auto aspect-[210/297] w-full max-w-[900px] rounded border border-slate-300 bg-white p-3 print:max-w-none print:rounded-none print:border-none print:p-0">
        <div className="grid h-full grid-cols-2 gap-2 divide-x divide-slate-900">
          <div className="pr-1">
            <CountingSheetTemplate />
          </div>
          <div className="pl-1">
            <CountingSheetTemplate />
          </div>
        </div>
      </section>
    </div>
  );
}
