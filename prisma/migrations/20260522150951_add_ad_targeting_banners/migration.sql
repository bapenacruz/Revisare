-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "targetCompassQuadrants" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "targetRegions" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ad_banners" (
    "id" TEXT NOT NULL,
    "imageDataUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "altText" TEXT,
    "targetRegions" JSONB NOT NULL DEFAULT '[]',
    "targetCompassQuadrants" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_banners_pkey" PRIMARY KEY ("id")
);
