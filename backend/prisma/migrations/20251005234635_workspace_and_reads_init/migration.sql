/*
  Warnings:

  - Added the required column `workspaceId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- CreateTable: Create Workspace first
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- Insert default workspace (MUST be created before adding column)
INSERT INTO "Workspace" (id, name, "createdAt") 
VALUES ('ws_default', 'Default Workspace', NOW())
ON CONFLICT (id) DO NOTHING;

-- AlterTable: Add workspaceId column (nullable first)
ALTER TABLE "Conversation" ADD COLUMN "workspaceId" TEXT;

-- Update existing rows to use default workspace
UPDATE "Conversation" SET "workspaceId" = 'ws_default' WHERE "workspaceId" IS NULL;

-- Make column NOT NULL after data migration
ALTER TABLE "Conversation" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- Add all existing users to default workspace
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", role, "joinedAt")
SELECT 'ws_default', id, 'MEMBER', NOW()
FROM "User"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_updatedAt_idx" ON "Conversation"("workspaceId", "updatedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
