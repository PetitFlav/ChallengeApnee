import { PrismaClient } from "@prisma/client";
import { buildLaneDefinitions, buildRoundDefinitions } from "../lib/challenge";

const prisma = new PrismaClient();

async function main() {
  const startTime = "09:30";
  const durationMinutes = 120;
  const roundsCount = 4;
  const lanes25Count = 4;
  const lanes50Count = 6;

  const challenge = await prisma.challenge.upsert({
    where: { id: "challenge-v1-default" },
    update: {
      startTime,
      durationMinutes,
      roundsCount,
      lanes25Count,
      lanes50Count,
    },
    create: {
      id: "challenge-v1-default",
      name: "Challenge Apnée V1",
      eventDate: new Date(),
      startTime,
      durationMinutes,
      roundsCount,
      lanes25Count,
      lanes50Count,
    },
  });

  await prisma.club.upsert({
    where: { name: "Club Organisateur" },
    update: { isHostClub: true },
    create: { name: "Club Organisateur", isHostClub: true },
  });

  await Promise.all(
    ["Club Exterieur A", "Club Exterieur B"].map((name) =>
      prisma.club.upsert({
        where: { name },
        update: {},
        create: { name, isHostClub: false },
      }),
    ),
  );

  await Promise.all(
    ["Apnéistes", "Plongeurs", "Chasseurs", "Hockeyeurs"].map((name) =>
      prisma.section.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const lanes = buildLaneDefinitions(lanes25Count, lanes50Count);

  for (const lane of lanes) {
    await prisma.lane.upsert({
      where: {
        challengeId_code: {
          challengeId: challenge.id,
          code: lane.code,
        },
      },
      update: { distanceM: lane.distanceM, displayOrder: lane.displayOrder, isActive: true },
      create: {
        challengeId: challenge.id,
        code: lane.code,
        distanceM: lane.distanceM,
        displayOrder: lane.displayOrder,
      },
    });
  }

  const rounds = buildRoundDefinitions(startTime, durationMinutes, roundsCount);

  for (const round of rounds) {
    await prisma.round.upsert({
      where: {
        challengeId_roundNumber: {
          challengeId: challenge.id,
          roundNumber: round.roundNumber,
        },
      },
      update: { label: round.label, scheduledTime: round.scheduledTime, displayOrder: round.displayOrder },
      create: {
        challengeId: challenge.id,
        roundNumber: round.roundNumber,
        label: round.label,
        scheduledTime: round.scheduledTime,
        displayOrder: round.displayOrder,
      },
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
