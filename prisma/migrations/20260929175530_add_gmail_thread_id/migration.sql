-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN "gmailThreadId" TEXT;

-- CreateIndex
CREATE INDEX "EmailThread_gmailThreadId_idx" ON "EmailThread"("gmailThreadId");
