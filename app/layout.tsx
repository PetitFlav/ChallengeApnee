import Image from "next/image";
import type { Metadata } from "next";
import "./globals.css";
import { ensureActiveChallenge } from "@/lib/events";
import { APP_NAME, APP_VERSION, APP_VERSION_DATE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Challenge Apnée",
  description: "Saisie des feuilles de distances",
};

const databaseUrl = process.env.DATABASE_URL;
const hasDatabaseUrl = (() => {
  if (!databaseUrl) return false;
  try {
    new URL(databaseUrl);
    return true;
  } catch {
    return false;
  }
})();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let activeChallenge = null;

  if (hasDatabaseUrl) {
    try {
      activeChallenge = await ensureActiveChallenge();
    } catch {
      activeChallenge = null;
    }
  }

  return (
    <html lang="fr">
      <body className="bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col p-6">
          <header className="mb-6 flex items-center justify-between rounded border bg-white p-4 print:hidden">
            <div>
              <p className="text-sm text-slate-500">Événement actif</p>
              <p className="text-xl font-semibold">{activeChallenge?.name ?? "Aucun événement actif"}</p>
            </div>
            {activeChallenge?.clubOrganisateurLogo ? (
              <Image src={activeChallenge.clubOrganisateurLogo} alt="Logo du club organisateur" width={56} height={56} className="h-14 w-14 rounded object-contain" unoptimized />
            ) : null}
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-6 rounded border bg-white p-3 text-sm text-slate-600">
            {APP_NAME} · v{APP_VERSION} · {APP_VERSION_DATE}
          </footer>
        </div>
      </body>
    </html>
  );
}
