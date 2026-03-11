import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  id: string;
  isSuperUser: boolean;
};

export const NO_ACTIVE_CHALLENGE_ACCESS_MESSAGE = "Aucun événement actif ne vous est accessible actuellement.";
export const NO_CHALLENGE_ACCESS_MESSAGE = "Aucun événement ne vous est accessible actuellement.";
export const UNAUTHORIZED_MODULE_ACCESS_MESSAGE = "Accès non autorisé à cette fonctionnalité.";
export const POST_CLOSURE_MODULE_ACCESS_MESSAGE =
  "Accès limité après clôture : seuls Vérification et Dashboard restent disponibles.";

export function canAccessRestrictedModules(user: SessionUser) {
  return user.isSuperUser;
}

export async function requireRestrictedModulesAccess(user: SessionUser) {
  if (!canAccessRestrictedModules(user)) {
    redirect("/?message=forbidden-module");
  }
}

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

  return prisma.challenge.findFirst({
    where: {
      isActive: true,
      userLinks: { some: { userId: user.id } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireSuperUser(user: SessionUser, redirectPath = "/") {
  if (!user.isSuperUser) {
    redirect(redirectPath);
  }
}

export async function requireActiveChallengeForUser(user: SessionUser) {
  const challenge = await ensureActiveChallengeForUser(user);
  if (!challenge) {
    redirect("/?message=no-active-event");
  }
  return challenge;
}

export async function ensurePreferredChallengeForUser(user: SessionUser) {
  if (user.isSuperUser) {
    return prisma.challenge.findFirst({
      orderBy: [{ isActive: "desc" }, { eventDate: "desc" }, { createdAt: "desc" }],
    });
  }

  return prisma.challenge.findFirst({
    where: {
      userLinks: { some: { userId: user.id } },
    },
    orderBy: [{ isActive: "desc" }, { eventDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function requirePreferredChallengeForUser(user: SessionUser) {
  const challenge = await ensurePreferredChallengeForUser(user);
  if (!challenge) {
    redirect("/events?message=forbidden");
  }
  return challenge;
}

export async function isPostClosureRestrictedUser(user: SessionUser) {
  if (user.isSuperUser) {
    return false;
  }

  const challenge = await ensurePreferredChallengeForUser(user);
  return Boolean(challenge?.closedAt);
}

export async function requireAccessBeforeClosure(user: SessionUser) {
  if (await isPostClosureRestrictedUser(user)) {
    redirect("/?message=post-closure-restricted");
  }
}
