-- Add slug as nullable first so existing rows can be backfilled.
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- Backfill: lowercase, non-alphanumeric runs -> single hyphen, trim leading/
-- trailing hyphens. Mirrors src/lib/slug.ts's slugify() in SQL.
UPDATE "Project"
SET "slug" = trim(both '-' from regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g'));

-- Disambiguate any duplicate slugs (two projects with the same/similar
-- name) by appending a short suffix from the row's own id.
WITH ranked AS (
  SELECT "id", "slug", row_number() OVER (PARTITION BY "slug" ORDER BY "createdAt") AS rn
  FROM "Project"
)
UPDATE "Project" p
SET "slug" = p."slug" || '-' || substr(p."id", 1, 6)
FROM ranked r
WHERE p."id" = r."id" AND r.rn > 1;

-- Now enforce NOT NULL + uniqueness.
ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
