-- AlterTable
ALTER TABLE "ad_banners" ADD COLUMN     "targetCountries" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "targetStates" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "targetCountries" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "targetStates" JSONB NOT NULL DEFAULT '[]';
