-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "LinkPreview" (
    "url" TEXT NOT NULL,
    "siteName" TEXT,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "iconUrl" TEXT,
    "mediaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPreview_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "MessageLink" (
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLink_pkey" PRIMARY KEY ("messageId","url")
);

-- CreateIndex
CREATE INDEX "MessageLink_url_idx" ON "MessageLink"("url");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLink" ADD CONSTRAINT "MessageLink_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
