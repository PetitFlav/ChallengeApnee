WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "sheetId", "userId" ORDER BY "createdAt" DESC, id DESC) AS rn
  FROM "verifications"
)
DELETE FROM "verifications"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

ALTER TABLE "verifications"
ADD CONSTRAINT "verifications_sheetId_userId_key" UNIQUE ("sheetId", "userId");
