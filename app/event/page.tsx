import { redirect } from "next/navigation";
import { ensureActiveChallenge } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  const challenge = await ensureActiveChallenge();
  redirect(`/events/${challenge.id}`);
}
