import Link from "next/link";

const links = [
  ["/login", "Login"],
  ["/swimmers", "Nageurs"],
  ["/sheets", "Feuilles"],
  ["/sheets/new", "Nouvelle feuille"],
  ["/dashboard", "Dashboard"],
  ["/public", "Écran public"],
] as const;

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Challenge Apnée V1</h1>
      <p className="text-slate-600">Structure minimale initialisée.</p>
      <nav className="grid gap-2 sm:grid-cols-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded border bg-white p-3 hover:bg-slate-100">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
