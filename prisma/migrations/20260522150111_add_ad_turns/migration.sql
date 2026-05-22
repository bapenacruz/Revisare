-- CreateTable
CREATE TABLE "ad_turns" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "roundName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_turns_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ad_turns" ADD CONSTRAINT "ad_turns_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
