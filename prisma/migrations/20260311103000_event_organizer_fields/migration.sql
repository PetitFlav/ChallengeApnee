ALTER TABLE "challenges"
ADD COLUMN IF NOT EXISTS "clubOrganisateur" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "clubOrganisateurLogo" TEXT;

DROP INDEX IF EXISTS "challenge_clubs_challengeId_isHostClub_idx";
ALTER TABLE "challenge_clubs" DROP COLUMN IF EXISTS "isHostClub";
