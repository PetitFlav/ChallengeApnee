import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  const email = (process.env.TEST_USER_EMAIL || "demo@example.com").trim().toLowerCase();
  const password = process.env.TEST_USER_PASSWORD || "ChangeMe123!";
  const firstName = process.env.TEST_USER_FIRST_NAME || "Demo";
  const lastName = process.env.TEST_USER_LAST_NAME || "User";
  const challengeId = process.env.TEST_USER_CHALLENGE_ID || "";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      passwordHash: hashPassword(password),
    },
    create: {
      firstName,
      lastName,
      email,
      passwordHash: hashPassword(password),
    },
  });

  if (challengeId) {
    await prisma.challengeUser.upsert({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        challengeId,
      },
    });
  }

  console.log(`Utilisateur prêt: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
