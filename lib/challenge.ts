import { PrismaClient } from "@prisma/client";

export type EventConfigInput = {
  name: string;
  eventDate: Date;
  startTime: string;
  timezone?: string;
  durationMinutes: number;
  roundsCount: number;
  lanes25Count: number;
  lanes50Count: number;
};

export function sanitizeStartTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "09:30";

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "09:30";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildLaneDefinitions(lanes25Count: number, lanes50Count: number) {
  const lanes: Array<{ code: string; distanceM: number; displayOrder: number }> = [];
  let displayOrder = 1;

  for (let index = 1; index <= lanes25Count; index += 1) {
    lanes.push({ code: `25-${index}`, distanceM: 25, displayOrder });
    displayOrder += 1;
  }

  for (let index = 1; index <= lanes50Count; index += 1) {
    lanes.push({ code: `50-${index}`, distanceM: 50, displayOrder });
    displayOrder += 1;
  }

  return lanes;
}

export function buildRoundDefinitions(startTime: string, durationMinutes: number, roundsCount: number) {
  const [startHour, startMinute] = sanitizeStartTime(startTime)
    .split(":")
    .map((value) => Number.parseInt(value, 10));

  const startTotalMinutes = startHour * 60 + startMinute;
  const intervalMinutes = roundsCount > 0 ? durationMinutes / roundsCount : durationMinutes;

  return Array.from({ length: roundsCount }, (_, index) => {
    const roundNumber = index + 1;
    const timeInMinutes =
      roundNumber === roundsCount
        ? startTotalMinutes + durationMinutes
        : Math.round(startTotalMinutes + intervalMinutes * roundNumber);
    const hours = Math.floor(timeInMinutes / 60) % 24;
    const minutes = timeInMinutes % 60;

    return {
      roundNumber,
      label: `T${roundNumber}`,
      scheduledTime: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      displayOrder: roundNumber,
    };
  });
}

export async function regenerateEventStructure(prisma: PrismaClient, challengeId: string, config: EventConfigInput) {
  const lanes = buildLaneDefinitions(config.lanes25Count, config.lanes50Count);
  const rounds = buildRoundDefinitions(config.startTime, config.durationMinutes, config.roundsCount);

  await prisma.$transaction(async (tx) => {
    await tx.challenge.update({
      where: { id: challengeId },
      data: {
        name: config.name,
        eventDate: config.eventDate,
        startTime: sanitizeStartTime(config.startTime),
        timezone: config.timezone?.trim() || "Europe/Paris",
        durationMinutes: config.durationMinutes,
        roundsCount: config.roundsCount,
        lanes25Count: config.lanes25Count,
        lanes50Count: config.lanes50Count,
      },
    });

    await tx.sheet.deleteMany({ where: { challengeId } });
    await tx.round.deleteMany({ where: { challengeId } });
    await tx.lane.deleteMany({ where: { challengeId } });

    if (lanes.length > 0) {
      await tx.lane.createMany({
        data: lanes.map((lane) => ({
          challengeId,
          code: lane.code,
          distanceM: lane.distanceM,
          displayOrder: lane.displayOrder,
          isActive: true,
        })),
      });
    }

    if (rounds.length > 0) {
      await tx.round.createMany({
        data: rounds.map((round) => ({
          challengeId,
          roundNumber: round.roundNumber,
          label: round.label,
          scheduledTime: round.scheduledTime,
          displayOrder: round.displayOrder,
        })),
      });
    }
  });
}
