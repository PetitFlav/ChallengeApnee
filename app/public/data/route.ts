import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { requireChallengeForModule, requirePublicScreenAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSessionUser();
  await requirePublicScreenAccess(user);
  const challenge = await requireChallengeForModule(user);

  const total = await prisma.sheetEntry.aggregate({
    where: { sheet: { challengeId: challenge.id } },
    _sum: { distanceM: true },
  });

  return NextResponse.json({
    totalDistanceM: total._sum.distanceM ?? 0,
    updatedAt: new Date().toISOString(),
  });
}
