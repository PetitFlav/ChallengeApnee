import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_EVENT_NAME,
  DEFAULT_LANES_25_COUNT,
  DEFAULT_LANES_50_COUNT,
  DEFAULT_ROUNDS_COUNT,
  DEFAULT_START_TIME,
} from "@/lib/constants";

export const ARCHIVED_ACTIVATION_ERROR =
  "Attention : cet événement est archivé. Il doit d’abord être désarchivé avant de pouvoir être activé.";

export const ARCHIVED_READ_ONLY_MESSAGE =
  "Attention : cet événement est archivé. Il est disponible en consultation uniquement.";

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
      isArchived: false,
    },
  });
}

export async function ensureActiveChallenge() {
  const active = await prisma.challenge.findFirst({
    where: { isActive: true, isArchived: false },
    orderBy: { createdAt: "asc" },
  });

  if (active) return active;

  const firstChallenge = await prisma.challenge.findFirst({
    where: { isArchived: false },
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
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      select: { id: true, isArchived: true },
    });

    if (!challenge) {
      throw new Error("Événement introuvable.");
    }

    if (challenge.isArchived) {
      throw new Error(ARCHIVED_ACTIVATION_ERROR);
    }

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

export async function setChallengeArchivedStatus(challengeId: string, isArchived: boolean) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { isArchived: true },
  });

  if (!challenge) {
    throw new Error("Événement introuvable.");
  }

  if (challenge.isArchived) {
    throw new Error(ARCHIVED_READ_ONLY_MESSAGE);
  }

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      isArchived,
      ...(isArchived ? { isActive: false } : {}),
    },
  });
}

export async function assertChallengeWritable(challengeId: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { isArchived: true },
  });

  if (!challenge) {
    throw new Error("Événement introuvable.");
  }

  if (challenge.isArchived) {
    throw new Error(ARCHIVED_READ_ONLY_MESSAGE);
  }
}
