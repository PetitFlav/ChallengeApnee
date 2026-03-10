-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_lines" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "swimmerId" TEXT NOT NULL,
    "squares" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL,
    "totalLengths" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verifications_sheetId_createdAt_idx" ON "verifications"("sheetId", "createdAt");

-- CreateIndex
CREATE INDEX "verifications_userId_idx" ON "verifications"("userId");

-- CreateIndex
CREATE INDEX "verification_lines_verificationId_idx" ON "verification_lines"("verificationId");

-- CreateIndex
CREATE INDEX "verification_lines_swimmerId_idx" ON "verification_lines"("swimmerId");

-- CreateIndex
CREATE INDEX "verification_lines_verificationId_swimmerId_idx" ON "verification_lines"("verificationId", "swimmerId");

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_lines" ADD CONSTRAINT "verification_lines_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_lines" ADD CONSTRAINT "verification_lines_swimmerId_fkey" FOREIGN KEY ("swimmerId") REFERENCES "swimmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
