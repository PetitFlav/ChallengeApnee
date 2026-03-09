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

  const computedRounds = orderedRounds.map((round, index) => {
    const opensAt = index === 0 ? startAt : withClock(challenge.eventDate, round.scheduledTime ?? challenge.startTime ?? "09:30");
    const nextRound = orderedRounds[index + 1] ?? null;
    const closesAt = nextRound
      ? withClock(challenge.eventDate, nextRound.scheduledTime ?? challenge.startTime ?? "09:30")
      : endAt;

    return {
      id: round.id,
      label: round.label,
      scheduledTime: round.scheduledTime,
      opensAt,
      closesAt,
    };
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentlyOpenRound = computedRounds.find((round) => now >= round.opensAt && now < round.closesAt) ?? null;
  let blockReason: string | null = null;

  if (!currentlyOpenRound) {
    const firstRound = computedRounds[0] ?? null;
    const lastRound = computedRounds[computedRounds.length - 1] ?? null;

    if (!firstRound || !lastRound) {
      blockReason = "Aucune tournée configurée.";
    } else if (now < firstRound.opensAt) {
      blockReason = `La saisie n'est pas encore ouverte (ouverture prévue à ${firstRound.opensAt.toISOString()}).`;
    } else if (now >= lastRound.closesAt) {
      blockReason = `La saisie est terminée (fermeture finale à ${lastRound.closesAt.toISOString()}).`;
    } else {
      blockReason = "Aucune tournée active trouvée pour l'heure courante (vérifier les horaires calculés des tournées).";
    }
  }

  console.info("[Sheets][RoundOpeningDebug]", {
    now: now.toISOString(),
    timezone,
    eventDate: challenge.eventDate.toISOString(),
    startTime: challenge.startTime ?? "09:30",
    endTime: endAt.toISOString(),
    rounds: computedRounds.map((round) => ({
      id: round.id,
      label: round.label,
      scheduledTime: round.scheduledTime,
      opensAt: round.opensAt.toISOString(),
      closesAt: round.closesAt.toISOString(),
      isOpenNow: now >= round.opensAt && now < round.closesAt,
    })),
    openRound: currentlyOpenRound
      ? {
          id: currentlyOpenRound.id,
          label: currentlyOpenRound.label,
          opensAt: currentlyOpenRound.opensAt.toISOString(),
          closesAt: currentlyOpenRound.closesAt.toISOString(),
        }
      : null,
    blockingReason: blockReason,
  });

  return computedRounds.map((round) => {
    const { opensAt, closesAt } = round;

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
