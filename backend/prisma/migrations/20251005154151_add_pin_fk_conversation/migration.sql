-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
