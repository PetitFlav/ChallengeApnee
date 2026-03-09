import { redirect } from "next/navigation";
import { ensureActiveChallengeForUser } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const user = await requireSessionUser();
  const challenge = await ensureActiveChallengeForUser(user);

  if (!challenge) {
    redirect("/events");
  }

  redirect(`/events/${challenge.id}`);
}
