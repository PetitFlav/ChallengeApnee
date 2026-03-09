import { redirect } from "next/navigation";
import { authenticateUser, getSessionUser, setSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=invalid");
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    redirect("/login?error=invalid");
  }

  await setSession(user.id);
  redirect("/events");
}

export default async function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const user = await getSessionUser();
  if (user) {
    redirect("/events");
  }

  return (
    <div className="mx-auto mt-10 max-w-md space-y-6 rounded border bg-white p-6">
      <div>
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <p className="text-sm text-slate-600">Connectez-vous avec votre email et mot de passe.</p>
      </div>

      {searchParams?.error === "invalid" ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Identifiants invalides. Vérifiez votre email et votre mot de passe.
        </div>
      ) : null}

      <form action={login} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input name="email" type="email" required className="w-full rounded border p-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Mot de passe</span>
          <input name="password" type="password" required className="w-full rounded border p-2" />
        </label>

        <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-white">
          Se connecter
        </button>
      </form>
    </div>
  );
}
