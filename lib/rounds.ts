import { sanitizeStartTime } from "@/lib/challenge";

type RoundWindowInput = {
  id: string;
  label: string;
  scheduledTime: string | null;
};

type ChallengeTimeConfig = {
  eventDate: Date;
  startTime: string | null;
  durationMinutes: number;
};

export type RoundAvailability = {
  id: string;
  label: string;
  opensAt: Date;
  closesAt: Date | null;
  status: "pending" | "active" | "closed";
  isSelectable: boolean;
};

function withClock(baseDate: Date, time: string) {
  const [hours, minutes] = sanitizeStartTime(time)
    .split(":")
    .map((value) => Number.parseInt(value, 10));

  const composedDate = new Date(baseDate);
  composedDate.setHours(hours, minutes, 0, 0);
  return composedDate;
}

export function getChallengeTimeRange(config: ChallengeTimeConfig) {
  const startAt = withClock(config.eventDate, config.startTime ?? "09:30");
  const endAt = new Date(startAt.getTime() + config.durationMinutes * 60_000);

  return { startAt, endAt };
}

export function buildRoundAvailability(
  rounds: RoundWindowInput[],
  challenge: ChallengeTimeConfig,
  now: Date = new Date(),
): RoundAvailability[] {
  const orderedRounds = [...rounds];
  const { startAt, endAt } = getChallengeTimeRange(challenge);

  return orderedRounds.map((round, index) => {
    const opensAt = index === 0 ? startAt : withClock(challenge.eventDate, round.scheduledTime ?? challenge.startTime ?? "09:30");

    const nextRound = orderedRounds[index + 1] ?? null;
    const closesAt = nextRound
      ? withClock(challenge.eventDate, nextRound.scheduledTime ?? challenge.startTime ?? "09:30")
      : endAt;

    const isPending = now < opensAt;
    const isClosed = now >= closesAt;

    const status: RoundAvailability["status"] = isPending ? "pending" : isClosed ? "closed" : "active";

    return {
      id: round.id,
      label: round.label,
      opensAt,
      closesAt,
      status,
      isSelectable: status === "active",
    };
  });
}
