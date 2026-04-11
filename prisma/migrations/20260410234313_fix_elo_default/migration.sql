-- Fix ELO default from 1200 to 1000 and reset existing users who still have the old default
ALTER TABLE "User" ALTER COLUMN "elo" SET DEFAULT 1000;
UPDATE "User" SET "elo" = 1000 WHERE "elo" = 1200;
