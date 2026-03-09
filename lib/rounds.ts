import { sanitizeStartTime } from "@/lib/challenge";

type RoundWindowInput = {
  id: string;
  label: string;
  scheduledTime: string | null;
};

type ChallengeTimeConfig = {
  eventDate: Date;
  startTime: string | null;
  timezone: string | null;
  durationMinutes: number;
  closedAt?: Date | null;
};

export type RoundAvailability = {
  id: string;
  label: string;
  opensAt: Date;
  closesAt: Date | null;
  status: "pending" | "active" | "closed";
  isSelectable: boolean;
};

const DEFAULT_EVENT_TIMEZONE = "Europe/Paris";

function getEventTimezone(timezone: string | null | undefined) {
  const candidate = timezone?.trim();
  if (!candidate) return DEFAULT_EVENT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

function getUtcDateParts(baseDate: Date) {
  return {
    year: baseDate.getUTCFullYear(),
    month: baseDate.getUTCMonth() + 1,
    day: baseDate.getUTCDate(),
  };
}

function getTimeZoneOffsetMilliseconds(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number.parseInt(map.year, 10),
    Number.parseInt(map.month, 10) - 1,
    Number.parseInt(map.day, 10),
    Number.parseInt(map.hour, 10),
    Number.parseInt(map.minute, 10),
    Number.parseInt(map.second, 10),
  );

  return asUtc - date.getTime();
}

function toUtcFromEventLocalDateTime(baseDate: Date, time: string, timezone: string) {
  const [hours, minutes] = sanitizeStartTime(time)
    .split(":")
    .map((value) => Number.parseInt(value, 10));
  const { year, month, day } = getUtcDateParts(baseDate);

  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const initialOffset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timezone);
  let timestamp = utcGuess - initialOffset;
  const adjustedOffset = getTimeZoneOffsetMilliseconds(new Date(timestamp), timezone);

  if (adjustedOffset !== initialOffset) {
    timestamp = utcGuess - adjustedOffset;
  }

  return new Date(timestamp);
}

function formatEventLocalDateTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(" ", "T");
}

export function getChallengeTimeRange(config: ChallengeTimeConfig) {
  const eventTimezone = getEventTimezone(config.timezone);
  const startAt = toUtcFromEventLocalDateTime(config.eventDate, config.startTime ?? "09:30", eventTimezone);
  const endAt = new Date(startAt.getTime() + config.durationMinutes * 60_000);

  return { startAt, endAt, eventTimezone };
}

export function buildRoundAvailability(
  rounds: RoundWindowInput[],
  challenge: ChallengeTimeConfig,
  now: Date = new Date(),
): RoundAvailability[] {
  const orderedRounds = [...rounds];
  const { startAt, endAt, eventTimezone } = getChallengeTimeRange(challenge);

  const computedRounds = orderedRounds.map((round, index) => {
    const opensAt =
      index === 0
        ? startAt
        : toUtcFromEventLocalDateTime(
            challenge.eventDate,
            round.scheduledTime ?? challenge.startTime ?? "09:30",
            eventTimezone,
          );
    const nextRound = orderedRounds[index + 1] ?? null;
    const closesAt = nextRound
      ? toUtcFromEventLocalDateTime(challenge.eventDate, nextRound.scheduledTime ?? challenge.startTime ?? "09:30", eventTimezone)
      : challenge.closedAt ?? null;

    return {
      id: round.id,
      label: round.label,
      scheduledTime: round.scheduledTime,
      opensAt,
      closesAt,
    };
  });

  const currentlyOpenRound =
    computedRounds.find((round) => now >= round.opensAt && (!round.closesAt || now < round.closesAt)) ?? null;
  let blockReason: string | null = null;

  if (!currentlyOpenRound) {
    const firstRound = computedRounds[0] ?? null;
    const lastRound = computedRounds[computedRounds.length - 1] ?? null;

    if (!firstRound || !lastRound) {
      blockReason = "Aucune tournée configurée.";
    } else if (now < firstRound.opensAt) {
      blockReason = `La saisie n'est pas encore ouverte (ouverture prévue à ${firstRound.opensAt.toISOString()}).`;
    } else if (lastRound.closesAt && now >= lastRound.closesAt) {
      blockReason = `La saisie est terminée (fermeture finale à ${lastRound.closesAt.toISOString()}).`;
    } else {
      blockReason = "Aucune tournée active trouvée pour l'heure courante (vérifier les horaires calculés des tournées).";
    }
  }

  console.info("[Sheets][RoundOpeningDebug]", {
    now: now.toISOString(),
    timezone: eventTimezone,
    eventLocalDateTime: formatEventLocalDateTime(startAt, eventTimezone),
    eventDate: challenge.eventDate.toISOString(),
    startTime: challenge.startTime ?? "09:30",
    endTime: endAt.toISOString(),
    rounds: computedRounds.map((round) => ({
      id: round.id,
      label: round.label,
      scheduledTime: round.scheduledTime,
      opensAt: round.opensAt.toISOString(),
      closesAt: round.closesAt?.toISOString() ?? null,
      isOpenNow: now >= round.opensAt && (!round.closesAt || now < round.closesAt),
    })),
    openRound: currentlyOpenRound
      ? {
          id: currentlyOpenRound.id,
          label: currentlyOpenRound.label,
          opensAt: currentlyOpenRound.opensAt.toISOString(),
          closesAt: currentlyOpenRound.closesAt?.toISOString() ?? null,
        }
      : null,
    blockingReason: blockReason,
  });

  return computedRounds.map((round) => {
    const { opensAt, closesAt } = round;

    const isPending = now < opensAt;
    const isClosed = closesAt ? now >= closesAt : false;

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
