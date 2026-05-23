-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@arguably.app',
    "contactMailtoBody" TEXT NOT NULL DEFAULT '[Your message here]

--- Do not modify below ---
Username: [username]
Country: [country]
Region: [region]
---',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
