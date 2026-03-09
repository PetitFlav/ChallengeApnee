import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { LogoutButton } from "@/app/logout-button";
import { requireSessionUser } from "@/lib/auth";

export default async function SheetsPage() {
  await requireSessionUser();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackToMainMenuLink />
        <LogoutButton />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">/sheets</h1>
        <p className="text-slate-600">Placeholder V1.</p>
      </div>
    </div>
  );
}
