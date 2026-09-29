-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MILESTONE',
    "toRecipients" TEXT NOT NULL DEFAULT '',
    "ccRecipients" TEXT NOT NULL DEFAULT '',
    "bccRecipients" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailTemplate" ("bccRecipients", "body", "ccRecipients", "createdAt", "id", "name", "subject", "toRecipients", "updatedAt") SELECT "bccRecipients", "body", "ccRecipients", "createdAt", "id", "name", "subject", "toRecipients", "updatedAt" FROM "EmailTemplate";
DROP TABLE "EmailTemplate";
ALTER TABLE "new_EmailTemplate" RENAME TO "EmailTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
