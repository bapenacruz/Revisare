-- CreateTable
CREATE TABLE "debate_motions" (
    "id" TEXT NOT NULL,
    "motion" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debate_motions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "debate_motions" ADD CONSTRAINT "debate_motions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
