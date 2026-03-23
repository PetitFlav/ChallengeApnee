import Link from "next/link";

type StatisticsPrintControlsProps = {
  href: string;
  label?: string;
};

export function StatisticsPrintControls({ href, label = "Imprimer" }: StatisticsPrintControlsProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}
