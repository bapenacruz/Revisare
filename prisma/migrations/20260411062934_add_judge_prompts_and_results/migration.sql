-- CreateTable
CREATE TABLE "judge_prompts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judge_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_results" (
    "id" TEXT NOT NULL,
    "debateId" TEXT NOT NULL,
    "winnerId" TEXT,
    "votes" JSONB NOT NULL,
    "consensus" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debate_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "judge_prompts_type_key" ON "judge_prompts"("type");

-- CreateIndex
CREATE UNIQUE INDEX "debate_results_debateId_key" ON "debate_results"("debateId");

-- AddForeignKey
ALTER TABLE "debate_results" ADD CONSTRAINT "debate_results_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "Debate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_results" ADD CONSTRAINT "debate_results_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
