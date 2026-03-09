import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_EVENT_NAME,
  DEFAULT_LANES_25_COUNT,
  DEFAULT_LANES_50_COUNT,
  DEFAULT_ROUNDS_COUNT,
  DEFAULT_START_TIME,
} from "@/lib/constants";

export async function createDefaultEvent(options?: { active?: boolean }) {
  return prisma.challenge.create({
    data: {
      name: DEFAULT_EVENT_NAME,
      eventDate: new Date(),
      startTime: DEFAULT_START_TIME,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      roundsCount: DEFAULT_ROUNDS_COUNT,
      lanes25Count: DEFAULT_LANES_25_COUNT,
      lanes50Count: DEFAULT_LANES_50_COUNT,
      isActive: options?.active ?? true,
    },
  });
}

export async function ensureActiveChallenge() {
  const active = await prisma.challenge.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (active) return active;

  const firstChallenge = await prisma.challenge.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (firstChallenge) {
    return prisma.challenge.update({
      where: { id: firstChallenge.id },
      data: { isActive: true },
    });
  }

  return createDefaultEvent({ active: true });
}

export async function setActiveChallenge(challengeId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.challenge.updateMany({
      where: { isActive: true, NOT: { id: challengeId } },
      data: { isActive: false },
    });

    await tx.challenge.update({
      where: { id: challengeId },
      data: { isActive: true },
    });
  });
}
