import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureActiveChallengeForUser, NO_ACTIVE_CHALLENGE_ACCESS_MESSAGE } from "@/lib/access";
import { LogoutButton } from "@/app/logout-button";

const links = [
  ["/events", "Événements"],
  ["/swimmers", "Nageurs"],
  ["/sheets", "Vérifications saisies"],
  ["/sheets/new", "Saisie des distances"],
  ["/dashboard", "Dashboard"],
  ["/public", "Écran public"],
] as const;

export default async function HomePage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const activeChallenge = await ensureActiveChallengeForUser(user);
  const hasActiveChallengeAccess = Boolean(activeChallenge);

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

      {searchParams?.message === "no-active-event" || !hasActiveChallengeAccess ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {NO_ACTIVE_CHALLENGE_ACCESS_MESSAGE}
        </div>
      ) : null}

      <nav className="grid gap-2 sm:grid-cols-2">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={hasActiveChallengeAccess ? href : "/?message=no-active-event"}
            className="rounded border bg-white p-3 hover:bg-slate-100"
          >
            {label}
          </Link>
        ))}
        {user.isSuperUser ? (
          <Link href="/admin/users" className="rounded border bg-white p-3 hover:bg-slate-100">
            Gestion des utilisateurs
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
