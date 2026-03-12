import { requireSessionUser } from "@/lib/auth";
import { requireChallengeForModule, requirePublicScreenAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { PublicLiveScreen } from "./public-live-screen";

export const dynamic = "force-dynamic";

function computeEndTime(startTime: string | null, durationMinutes: number, fallback: string | null) {
  if (fallback) return fallback;
  if (!startTime) return null;

  const [hoursRaw, minutesRaw] = startTime.split(":");
  const hours = Number.parseInt(hoursRaw ?? "", 10);
  const minutes = Number.parseInt(minutesRaw ?? "", 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const startTotalMinutes = hours * 60 + minutes;
  const endTotalMinutes = startTotalMinutes + durationMinutes;
  const endHours = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export default async function PublicScreenPage() {
  const user = await requireSessionUser();
  await requirePublicScreenAccess(user);

  const challenge = await requireChallengeForModule(user);

  const total = await prisma.sheetEntry.aggregate({
    where: { sheet: { challengeId: challenge.id } },
    _sum: { distanceM: true },
  });

  const totalDistanceM = total._sum.distanceM ?? 0;

  return (
    <PublicLiveScreen
      challengeName={challenge.name}
      startTime={challenge.startTime ?? "--:--"}
      endTime={computeEndTime(challenge.startTime, challenge.durationMinutes, challenge.endTime)}
      initialTotalDistanceM={totalDistanceM}
      dataEndpoint="/public/data"
      refreshIntervalMs={10000}
    />
  );
}
