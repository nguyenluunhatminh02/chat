-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "eventKey" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outbox_topic_createdAt_idx" ON "Outbox"("topic", "createdAt");
