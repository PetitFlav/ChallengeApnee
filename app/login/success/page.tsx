import Image from "next/image";
import { ensureActiveChallenge } from "@/lib/events";
import { RedirectOnMount } from "./redirect-on-mount";

export const dynamic = "force-dynamic";

export default async function LoginSuccessPage() {
  let challengeName = "Événement actif";
  let logo: string | null = null;

  try {
    const challenge = await ensureActiveChallenge();
    challengeName = challenge.name;
    logo = challenge.clubOrganisateurLogo;
  } catch {
    challengeName = "Menu général";
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <RedirectOnMount />
      <div className="rounded border bg-white p-8 text-center shadow-sm">
        {logo ? (
          <Image src={logo} alt="Logo du club organisateur" width={96} height={96} className="mx-auto mb-4 h-24 w-24 object-contain" unoptimized />
        ) : null}
        <p className="text-sm text-slate-500">Connexion réussie</p>
        <h1 className="mt-2 text-4xl font-semibold">{challengeName}</h1>
        <p className="mt-3 text-sm text-slate-500">Redirection vers le menu général...</p>
      </div>
    </div>
  );
}
