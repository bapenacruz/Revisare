-- CreateTable
CREATE TABLE "ad_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📢',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "motion" TEXT NOT NULL,
    "proponentName" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "categoryId" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_categories_slug_key" ON "ad_categories"("slug");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ad_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
