"use client";

export function DeleteEventButton({
  warningMessage,
  disabled = false,
}: {
  warningMessage: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded bg-red-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      onClick={(event) => {
        if (!confirm(warningMessage)) {
          event.preventDefault();
        }
      }}
    >
      Supprimer
    </button>
  );
}
