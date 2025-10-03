-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'READY');

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER,
    "checksum" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileObject_status_idx" ON "FileObject"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_bucket_key_key" ON "FileObject"("bucket", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_messageId_fileId_key" ON "Attachment"("messageId", "fileId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
