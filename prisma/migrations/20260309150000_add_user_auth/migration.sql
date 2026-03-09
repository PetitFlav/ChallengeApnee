CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isSuperUser" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "challenge_users" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "challenge_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "challenge_users_userId_challengeId_key" ON "challenge_users"("userId", "challengeId");
CREATE INDEX "challenge_users_userId_idx" ON "challenge_users"("userId");
CREATE INDEX "challenge_users_challengeId_idx" ON "challenge_users"("challengeId");

ALTER TABLE "challenge_users" ADD CONSTRAINT "challenge_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_users" ADD CONSTRAINT "challenge_users_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
