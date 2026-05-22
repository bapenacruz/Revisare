-- AlterTable
ALTER TABLE "ad_banners" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "targetUsernames" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "officialResult" TEXT,
ADD COLUMN     "targetUsernames" JSONB NOT NULL DEFAULT '[]';
