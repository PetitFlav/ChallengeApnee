import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  id: string;
  isSuperUser: boolean;
};

export async function getUserAccessibleChallenges(user: SessionUser) {
  if (user.isSuperUser) {
    return prisma.challenge.findMany({
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    });
  }

  return prisma.challenge.findMany({
    where: {
      userLinks: {
        some: {
          userId: user.id,
        },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function canAccessChallenge(user: SessionUser, challengeId: string) {
  if (user.isSuperUser) return true;

  const link = await prisma.challengeUser.findUnique({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId,
      },
    },
    select: { id: true },
  });

  return Boolean(link);
}

export async function requireChallengeAccess(user: SessionUser, challengeId: string) {
  const allowed = await canAccessChallenge(user, challengeId);
  if (!allowed) {
    redirect("/events?message=forbidden");
  }
}

export async function ensureActiveChallengeForUser(user: SessionUser) {
  if (user.isSuperUser) {
    return prisma.challenge.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  const active = await prisma.challenge.findFirst({
    where: {
      isActive: true,
      userLinks: { some: { userId: user.id } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (active) return active;

  return prisma.challenge.findFirst({
    where: {
      userLinks: { some: { userId: user.id } },
      isArchived: false,
    },
    orderBy: { createdAt: "asc" },
  });
}
