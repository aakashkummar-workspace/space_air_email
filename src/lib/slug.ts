import { prisma } from "@/lib/prisma";

/** Lowercase, hyphenated, alphanumeric-only — e.g. "CRM_1" -> "crm-1". */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "project";
}

/**
 * A slug guaranteed unique among Projects — appends -2, -3, ... on
 * collision. Pass excludeId when regenerating a slug for a project that
 * already exists (e.g. after a rename), so it doesn't collide with itself.
 */
export async function uniqueProjectSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const existing = await prisma.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}
