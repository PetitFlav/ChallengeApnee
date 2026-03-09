import Link from "next/link";

export function BackToMainMenuLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      ← Retour au menu principal
    </Link>
  );
}

