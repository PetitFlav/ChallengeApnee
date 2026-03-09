import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/app/logout-button";

const links = [
  ["/events", "Événements"],
  ["/swimmers", "Nageurs"],
  ["/sheets", "Feuilles"],
  ["/sheets/new", "Saisie des distances"],
  ["/dashboard", "Dashboard"],
  ["/public", "Écran public"],
] as const;

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Challenge Apnée V1</h1>
          <p className="text-slate-600">
            Connecté : {user.firstName} {user.lastName}
          </p>
        </div>
        <LogoutButton />
      </div>
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
