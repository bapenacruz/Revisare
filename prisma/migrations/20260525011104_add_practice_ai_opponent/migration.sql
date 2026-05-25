-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "isPractice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Debate" ADD COLUMN     "isAiOpponent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPractice" BOOLEAN NOT NULL DEFAULT false;
