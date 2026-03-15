"use client";

type PrintButtonProps = {
  currentPages: number;
  extraPages: number;
};

export function PrintButton({ currentPages, extraPages }: PrintButtonProps) {
  return (
    <div className="flex items-end gap-3">
      <p className="text-sm font-medium text-slate-700">Pages actuelles : {currentPages}</p>

      <form method="get" className="flex items-end gap-2">
        <label htmlFor="extraPages" className="text-sm font-medium text-slate-700">
          Pages supplémentaires
        </label>
        <input
          id="extraPages"
          name="extraPages"
          type="number"
          min={0}
          defaultValue={extraPages}
          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          Appliquer
        </button>
      </form>

      <button
        type="button"
        onClick={() => window.print()}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Imprimer / Enregistrer en PDF
      </button>
    </div>
  );
}
