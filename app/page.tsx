import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  ensurePreferredChallengeForUser,
  NO_CHALLENGE_ACCESS_MESSAGE,
  UNAUTHORIZED_MODULE_ACCESS_MESSAGE,
  POST_CLOSURE_MODULE_ACCESS_MESSAGE,
  canAccessModule,
} from "@/lib/access";
import { LogoutButton } from "@/app/logout-button";

const links = [
  { href: "/events", label: "Événements" },
  { href: "/swimmers", label: "Nageurs" },
  { href: "/sheets", label: "Vérification" },
  { href: "/sheets/new", label: "Saisie des longueurs" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/statistics", label: "Statistique" },
  { href: "/public", label: "Écran public" },
] as const;

export default async function HomePage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const challenge = await ensurePreferredChallengeForUser(user);
  const hasChallengeAccess = Boolean(challenge);
  const [canAccessEvents, canAccessSwimmers, canAccessVerification, canAccessLengthsEntry, canAccessDashboard, canAccessStatistics, canAccessPublicScreen, canAccessUserAdmin] = await Promise.all([
    canAccessModule(user, "events"),
    canAccessModule(user, "swimmers"),
    canAccessModule(user, "verification"),
    canAccessModule(user, "lengths-entry"),
    canAccessModule(user, "dashboard"),
    canAccessModule(user, "statistics"),
    canAccessModule(user, "public-screen"),
    canAccessModule(user, "user-admin"),
  ]);

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

      {searchParams?.message === "no-active-event" || !hasChallengeAccess ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {NO_CHALLENGE_ACCESS_MESSAGE}
        </div>
      ) : null}

      {searchParams?.message === "forbidden-module" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {UNAUTHORIZED_MODULE_ACCESS_MESSAGE}
        </div>
      ) : null}

      {searchParams?.message === "post-closure-restricted" ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {POST_CLOSURE_MODULE_ACCESS_MESSAGE}
        </div>
      ) : null}

      <nav className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const isDisabled =
            !hasChallengeAccess ||
            (link.href === "/events" && !canAccessEvents) ||
            (link.href === "/swimmers" && !canAccessSwimmers) ||
            (link.href === "/sheets" && !canAccessVerification) ||
            (link.href === "/sheets/new" && !canAccessLengthsEntry) ||
            (link.href === "/dashboard" && !canAccessDashboard) ||
            (link.href === "/statistics" && !canAccessStatistics) ||
            (link.href === "/public" && !canAccessPublicScreen);

          if (isDisabled) {
            return (
              <span
                key={link.href}
                aria-disabled="true"
                className="cursor-not-allowed rounded border bg-slate-100 p-3 text-slate-500"
              >
                {link.label}
              </span>
            );
          }

          return (
            <Link key={link.href} href={link.href} className="rounded border bg-white p-3 hover:bg-slate-100">
              {link.label}
            </Link>
          );
        })}
        {canAccessUserAdmin ? (
          <Link href="/admin/users" className="rounded border bg-white p-3 hover:bg-slate-100">
            Gestion des utilisateurs
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
