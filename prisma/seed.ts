import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const challenge = await prisma.challenge.upsert({
    where: { id: "challenge-v1-default" },
    update: {},
    create: {
      id: "challenge-v1-default",
      name: "Challenge Apnée V1",
      eventDate: new Date(),
      durationMinutes: 120,
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

  const lanes = [
    ["25-1", 25],
    ["25-2", 25],
    ["25-3", 25],
    ["25-4", 25],
    ["50-1", 50],
    ["50-2", 50],
    ["50-3", 50],
    ["50-4", 50],
    ["50-5", 50],
    ["50-6", 50],
  ] as const;

  for (const [index, lane] of lanes.entries()) {
    await prisma.lane.upsert({
      where: {
        challengeId_code: {
          challengeId: challenge.id,
          code: lane[0],
        },
      },
      update: { distanceM: lane[1], displayOrder: index + 1, isActive: true },
      create: {
        challengeId: challenge.id,
        code: lane[0],
        distanceM: lane[1],
        displayOrder: index + 1,
      },
    });
  }

  const rounds = [
    [1, "T1", "09:30"],
    [2, "T2", "10:00"],
    [3, "T3", "10:30"],
    [4, "T4", "11:00"],
  ] as const;

  for (const [index, round] of rounds.entries()) {
    await prisma.round.upsert({
      where: {
        challengeId_roundNumber: {
          challengeId: challenge.id,
          roundNumber: round[0],
        },
      },
      update: { label: round[1], scheduledTime: round[2], displayOrder: index + 1 },
      create: {
        challengeId: challenge.id,
        roundNumber: round[0],
        label: round[1],
        scheduledTime: round[2],
        displayOrder: index + 1,
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
