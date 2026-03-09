import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";

async function logout() {
  "use server";
  await clearSession();
  redirect("/login");
}

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
        Se déconnecter
      </button>
    </form>
  );
}
