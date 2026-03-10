import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { requireSessionUser } from "@/lib/auth";
import { requireRestrictedModulesAccess } from "@/lib/access";

export default async function SheetDetailPage({ params }: { params: { id: string } }) {
  const user = await requireSessionUser();
  await requireRestrictedModulesAccess(user);
  return (
    <div className="space-y-4">
      <BackToMainMenuLink />
      <div>
        <h1 className="text-2xl font-semibold">/sheets/{params.id}</h1>
        <p className="text-slate-600">Placeholder V1.</p>
      </div>
    </div>
  );
}
