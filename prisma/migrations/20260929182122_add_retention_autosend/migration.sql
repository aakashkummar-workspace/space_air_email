-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RetentionInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Retention',
    "amount" REAL NOT NULL,
    "dueDate" DATETIME,
    "amountReceived" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "autoSendEmail" BOOLEAN NOT NULL DEFAULT false,
    "autoSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetentionInstallment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RetentionInstallment" ("amount", "amountReceived", "createdAt", "dueDate", "id", "label", "projectId", "remarks", "updatedAt") SELECT "amount", "amountReceived", "createdAt", "dueDate", "id", "label", "projectId", "remarks", "updatedAt" FROM "RetentionInstallment";
DROP TABLE "RetentionInstallment";
ALTER TABLE "new_RetentionInstallment" RENAME TO "RetentionInstallment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
