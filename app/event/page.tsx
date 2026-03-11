import { redirect } from "next/navigation";
import { requireAccessBeforeClosure, requirePreferredChallengeForUser } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const user = await requireSessionUser();
  await requireAccessBeforeClosure(user);
  const challenge = await requirePreferredChallengeForUser(user);

  redirect(`/events/${challenge.id}`);
}
