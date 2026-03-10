-- CreateEnum
CREATE TYPE "FinalResultSource" AS ENUM ('original', 'verification', 'manual');

-- CreateTable
CREATE TABLE "final_results" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "swimmerId" TEXT NOT NULL,
    "clubId" TEXT,
    "sectionId" TEXT,
    "source" "FinalResultSource" NOT NULL,
    "sourceVerificationId" TEXT,
    "sourceVerificationLineId" TEXT,
    "sourceSheetEntryId" TEXT,
    "squares" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL,
    "totalLengths" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "validatedByUserId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "final_results_challengeId_roundId_laneId_swimmerId_key" ON "final_results"("challengeId", "roundId", "laneId", "swimmerId");

-- CreateIndex
CREATE INDEX "final_results_challengeId_validatedAt_idx" ON "final_results"("challengeId", "validatedAt");

-- CreateIndex
CREATE INDEX "final_results_sheetId_idx" ON "final_results"("sheetId");

-- CreateIndex
CREATE INDEX "final_results_swimmerId_idx" ON "final_results"("swimmerId");

-- CreateIndex
CREATE INDEX "final_results_validatedByUserId_idx" ON "final_results"("validatedByUserId");

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_swimmerId_fkey" FOREIGN KEY ("swimmerId") REFERENCES "swimmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_sourceVerificationId_fkey" FOREIGN KEY ("sourceVerificationId") REFERENCES "verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_sourceVerificationLineId_fkey" FOREIGN KEY ("sourceVerificationLineId") REFERENCES "verification_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_sourceSheetEntryId_fkey" FOREIGN KEY ("sourceSheetEntryId") REFERENCES "sheet_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
