-- CreateTable
CREATE TABLE "MonthlyTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "billingTarget" REAL NOT NULL DEFAULT 0,
    "billingAchieved" REAL NOT NULL DEFAULT 0,
    "collectionTarget" REAL NOT NULL DEFAULT 0,
    "collectionAchieved" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyTarget_projectId_year_month_key" ON "MonthlyTarget"("projectId", "year", "month");
