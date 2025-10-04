/*
  Warnings:

  - A unique constraint covering the columns `[topic,eventKey]` on the table `Outbox` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Outbox" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedBy" TEXT;

-- CreateIndex
CREATE INDEX "Outbox_publishedAt_claimedAt_createdAt_idx" ON "Outbox"("publishedAt", "claimedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_topic_eventKey_key" ON "Outbox"("topic", "eventKey");
