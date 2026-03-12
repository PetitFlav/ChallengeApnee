import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  canAccessRestrictedModules,
  ensurePreferredChallengeForUser,
  NO_CHALLENGE_ACCESS_MESSAGE,
  UNAUTHORIZED_MODULE_ACCESS_MESSAGE,
  POST_CLOSURE_MODULE_ACCESS_MESSAGE,
  isPostClosureRestrictedUser,
} from "@/lib/access";
import { LogoutButton } from "@/app/logout-button";

const links = [
  { href: "/events", label: "Événements", access: "superuser" },
  { href: "/swimmers", label: "Nageurs", access: "superuser" },
  { href: "/sheets", label: "Vérification", access: "event-user" },
  { href: "/sheets/new", label: "Saisie des longueurs", access: "superuser" },
  { href: "/dashboard", label: "Dashboard", access: "event-user" },
  { href: "/public", label: "Écran public", access: "superuser" },
] as const;

const rightsSummary = [
  {
    eventStatus: "Événement non actif",
    rows: [
      { menu: "Événement", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Nageurs", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Vérification", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Saisie des longueurs", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Dashboard", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Écran public", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Gestion des utilisateurs", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
    ],
  },
  {
    eventStatus: "Événement actif",
    rows: [
      { menu: "Événement", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Nageurs", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Vérification", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Saisie des longueurs", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Dashboard", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Écran public", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Gestion des utilisateurs", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
    ],
  },
  {
    eventStatus: "Événement clôturé",
    rows: [
      { menu: "Événement", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Nageurs", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
      { menu: "Vérification", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Saisie des longueurs", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Dashboard", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Écran public", superUser: true, affiliatedUser: true, nonAffiliatedUser: false },
      { menu: "Gestion des utilisateurs", superUser: true, affiliatedUser: false, nonAffiliatedUser: false },
    ],
  },
] as const;

function AccessCell({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
        allowed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {allowed ? "Accès" : "Pas accès"}
    </span>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const challenge = await ensurePreferredChallengeForUser(user);
  const hasChallengeAccess = Boolean(challenge);
  const hasSuperUserAccess = canAccessRestrictedModules(user);
  const isPostClosureRestricted = await isPostClosureRestrictedUser(user);

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
            (link.access === "superuser" && !hasSuperUserAccess) ||
            (isPostClosureRestricted && (link.href === "/events" || link.href === "/swimmers"));

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
        {user.isSuperUser ? (
          <Link href="/admin/users" className="rounded border bg-white p-3 hover:bg-slate-100">
            Gestion des utilisateurs
          </Link>
        ) : null}
      </nav>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Récapitulatif des droits</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border-b p-2">Statut</th>
                <th className="border-b p-2">Menu</th>
                <th className="border-b p-2">Superuser</th>
                <th className="border-b p-2">Utilisateur affilié</th>
                <th className="border-b p-2">Utilisateur non affilié</th>
              </tr>
            </thead>
            <tbody>
              {rightsSummary.map((status) =>
                status.rows.map((row, index) => (
                  <tr key={`${status.eventStatus}-${row.menu}`} className="align-top odd:bg-white even:bg-slate-50">
                    {index === 0 ? (
                      <td className="border-b p-2 font-medium" rowSpan={status.rows.length}>
                        {status.eventStatus}
                      </td>
                    ) : null}
                    <td className="border-b p-2">{row.menu}</td>
                    <td className="border-b p-2">
                      <AccessCell allowed={row.superUser} />
                    </td>
                    <td className="border-b p-2">
                      <AccessCell allowed={row.affiliatedUser} />
                    </td>
                    <td className="border-b p-2">
                      <AccessCell allowed={row.nonAffiliatedUser} />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
