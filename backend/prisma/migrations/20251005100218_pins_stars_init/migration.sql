-- CreateTable
CREATE TABLE "Star" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Star_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Star_userId_createdAt_idx" ON "Star"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Star_messageId_idx" ON "Star"("messageId");

-- CreateIndex
CREATE INDEX "Pin_conversationId_createdAt_idx" ON "Pin"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pin_conversationId_messageId_key" ON "Pin"("conversationId", "messageId");

-- AddForeignKey
ALTER TABLE "Star" ADD CONSTRAINT "Star_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
