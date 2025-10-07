/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `Conversation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);
