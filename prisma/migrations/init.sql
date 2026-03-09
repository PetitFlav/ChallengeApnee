ALTER TABLE "challenges"
ADD COLUMN IF NOT EXISTS "startTime" TEXT NOT NULL DEFAULT '09:30',
ADD COLUMN IF NOT EXISTS "roundsCount" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS "lanes25Count" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS "lanes50Count" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "challenge_clubs" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "isHostClub" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "challenge_clubs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "challenge_clubs_challengeId_clubId_key" ON "challenge_clubs"("challengeId", "clubId");
CREATE INDEX IF NOT EXISTS "challenge_clubs_challengeId_idx" ON "challenge_clubs"("challengeId");
CREATE INDEX IF NOT EXISTS "challenge_clubs_clubId_idx" ON "challenge_clubs"("clubId");
CREATE INDEX IF NOT EXISTS "challenge_clubs_challengeId_isHostClub_idx" ON "challenge_clubs"("challengeId", "isHostClub");

ALTER TABLE "challenge_clubs"
ADD COLUMN IF NOT EXISTS "isHostClub" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'challenge_clubs_challengeId_fkey'
      AND table_name = 'challenge_clubs'
  ) THEN
    ALTER TABLE "challenge_clubs"
    ADD CONSTRAINT "challenge_clubs_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'challenge_clubs_clubId_fkey'
      AND table_name = 'challenge_clubs'
  ) THEN
    ALTER TABLE "challenge_clubs"
    ADD CONSTRAINT "challenge_clubs_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "challenge_clubs" ("id", "challengeId", "clubId")
SELECT md5(random()::text || clock_timestamp()::text), s."challengeId", s."clubId"
FROM (
  SELECT DISTINCT "challengeId", "clubId"
  FROM "swimmers"
  WHERE "clubId" IS NOT NULL
) s
WHERE NOT EXISTS (
  SELECT 1
  FROM "challenge_clubs" cc
  WHERE cc."challengeId" = s."challengeId" AND cc."clubId" = s."clubId"
);

UPDATE "challenges"
SET "isActive" = true
WHERE "id" IN (
  SELECT "id"
  FROM "challenges"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "challenges" WHERE "isActive" = true);


WITH "legacy_host_clubs" AS (
  SELECT cc."challengeId", cc."clubId"
  FROM "challenge_clubs" cc
  INNER JOIN "clubs" c ON c."id" = cc."clubId"
  WHERE c."isHostClub" = true
), "ranked" AS (
  SELECT "challengeId", "clubId", ROW_NUMBER() OVER (PARTITION BY "challengeId" ORDER BY "clubId") AS rn
  FROM "legacy_host_clubs"
)
UPDATE "challenge_clubs" cc
SET "isHostClub" = true
FROM "ranked" r
WHERE cc."challengeId" = r."challengeId"
  AND cc."clubId" = r."clubId"
  AND r.rn = 1;

UPDATE "challenge_clubs" cc
SET "isHostClub" = true
WHERE cc."id" IN (
  SELECT x."id"
  FROM (
    SELECT cc2."id", ROW_NUMBER() OVER (PARTITION BY cc2."challengeId" ORDER BY cc2."createdAt" ASC, cc2."clubId" ASC) AS rn
    FROM "challenge_clubs" cc2
    WHERE cc2."challengeId" NOT IN (
      SELECT DISTINCT cch."challengeId"
      FROM "challenge_clubs" cch
      WHERE cch."isHostClub" = true
    )
  ) x
  WHERE x.rn = 1
);

ALTER TABLE "clubs"
DROP COLUMN IF EXISTS "isHostClub";
