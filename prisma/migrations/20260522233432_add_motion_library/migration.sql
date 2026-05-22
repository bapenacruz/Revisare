/*
  Warnings:

  - You are about to drop the `debate_motions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "debate_motions" DROP CONSTRAINT "debate_motions_categoryId_fkey";

-- DropTable
DROP TABLE "debate_motions";

-- CreateTable
CREATE TABLE "motion_library" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "categoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motion_library_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "motion_library" ADD CONSTRAINT "motion_library_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
