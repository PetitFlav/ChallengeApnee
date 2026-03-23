"use client";

type PrintButtonProps = {
  currentPages?: number;
  extraPages?: number;
  searchParams?: string;
};

export function PrintButton({ currentPages, extraPages = 0, searchParams = "" }: PrintButtonProps) {
  const showPaginationControls = typeof currentPages === "number";
  const preservedSearchParams = Array.from(new URLSearchParams(searchParams).entries());

  return (
    <div className="flex items-end gap-3">
      {showPaginationControls ? <p className="text-sm font-medium text-slate-700">Pages actuelles : {currentPages}</p> : null}

      {showPaginationControls ? (
        <form method="get" className="flex items-end gap-2">
          {preservedSearchParams.map(([name, value]) => (
            <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
          ))}
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
      ) : null}

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
