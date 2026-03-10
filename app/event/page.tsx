import { redirect } from "next/navigation";
import { requirePreferredChallengeForUser } from "@/lib/access";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);

  redirect(`/events/${challenge.id}`);
}
