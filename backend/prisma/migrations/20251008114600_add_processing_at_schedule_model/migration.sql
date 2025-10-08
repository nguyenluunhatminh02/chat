-- AlterEnum
ALTER TYPE "ScheduledMessageStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "ScheduledMessage" ADD COLUMN     "processingAt" TIMESTAMP(3);
