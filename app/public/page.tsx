import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";

export default function PublicScreenPage() {
  return (
    <div className="space-y-4">
      <BackToMainMenuLink />
      <div>
        <h1 className="text-2xl font-semibold">/public</h1>
        <p className="text-slate-600">Placeholder V1.</p>
      </div>
    </div>
  );
}
