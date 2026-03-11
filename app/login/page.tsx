import { redirect } from "next/navigation";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";

async function mockLogin() {
  "use server";
  redirect("/login/success");
}

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <BackToMainMenuLink />
      <div>
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-slate-600">Écran de connexion simplifié pour la V1.</p>
      </div>
      <form action={mockLogin}>
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          Se connecter
        </button>
      </form>
    </div>
  );
}
