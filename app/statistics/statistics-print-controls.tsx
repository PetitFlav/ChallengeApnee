"use client";

export function StatisticsPrintControls() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      Imprimer
    </button>
  );
}
