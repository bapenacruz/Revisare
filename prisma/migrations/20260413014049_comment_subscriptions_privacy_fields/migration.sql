-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showFollowers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showLocation" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DebateCommentSubscription" (
    "userId" TEXT NOT NULL,
    "debateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateCommentSubscription_pkey" PRIMARY KEY ("userId","debateId")
);

-- AddForeignKey
ALTER TABLE "DebateComment" ADD CONSTRAINT "DebateComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateCommentSubscription" ADD CONSTRAINT "DebateCommentSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateCommentSubscription" ADD CONSTRAINT "DebateCommentSubscription_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "Debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
