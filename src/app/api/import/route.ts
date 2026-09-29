import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const milestoneSchema = z.object({
  label: z.string(),
  percent: z.number(),
  billedSupplyAmt: z.number(),
  billedInstallationAmt: z.number(),
  dueDate: z.string().nullable(),
});
const collectionSchema = z.object({ amount: z.number() });
const subJobSchema = z.object({
  name: z.string(),
  poSupplyAmt: z.number(),
  poInstallationAmt: z.number(),
  sellingSupplyAmt: z.number(),
  sellingErectionAmt: z.number(),
  milestones: z.array(milestoneSchema),
  collections: z.array(collectionSchema),
});
const monthlyTargetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  billingTarget: z.number(),
  billingAchieved: z.number(),
  collectionTarget: z.number(),
  collectionAchieved: z.number(),
});
const projectSchema = z.object({
  name: z.string().min(1),
  jobCode: z.string().nullable(),
  clientName: z.string().nullable(),
  remarks: z.string().nullable(),
  subJobs: z.array(subJobSchema),
  monthlyTargets: z.array(monthlyTargetSchema).default([]),
});
const importSchema = z.object({
  projects: z.array(projectSchema),
  mode: z.enum(["create", "merge"]).default("create"),
});

// "create" always makes new Project rows (safe default — never silently
// overwrites existing data). "merge" matches by exact project name and adds
// new sub-jobs/milestones/collections onto that existing project.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projects, mode } = parsed.data;
  const results: { name: string; action: "created" | "merged"; subJobs: number; milestones: number }[] = [];

  for (const p of projects) {
    const milestoneCount = p.subJobs.reduce((s, sj) => s + sj.milestones.length, 0);

    let existing = null;
    if (mode === "merge") {
      existing = await prisma.project.findFirst({ where: { name: p.name } });
    }

    if (existing) {
      for (const sj of p.subJobs) {
        await prisma.subJob.create({
          data: {
            projectId: existing.id,
            name: sj.name,
            poSupplyAmt: sj.poSupplyAmt,
            poInstallationAmt: sj.poInstallationAmt,
            sellingSupplyAmt: sj.sellingSupplyAmt,
            sellingErectionAmt: sj.sellingErectionAmt,
            milestones: {
              create: sj.milestones.map((m, i) => ({
                label: m.label,
                percent: m.percent,
                sequence: i + 1,
                billedSupplyAmt: m.billedSupplyAmt,
                billedInstallationAmt: m.billedInstallationAmt,
                dueDate: m.dueDate ? new Date(m.dueDate) : null,
              })),
            },
            collections: {
              create: sj.collections.map((c) => ({ amount: c.amount })),
            },
          },
        });
      }
      for (const mt of p.monthlyTargets) {
        await prisma.monthlyTarget.upsert({
          where: { projectId_year_month: { projectId: existing.id, year: mt.year, month: mt.month } },
          update: {
            billingTarget: mt.billingTarget,
            billingAchieved: mt.billingAchieved,
            collectionTarget: mt.collectionTarget,
            collectionAchieved: mt.collectionAchieved,
          },
          create: { projectId: existing.id, ...mt },
        });
      }
      results.push({ name: p.name, action: "merged", subJobs: p.subJobs.length, milestones: milestoneCount });
    } else {
      const created = await prisma.project.create({
        data: {
          name: p.name,
          jobCode: p.jobCode,
          clientName: p.clientName,
          remarks: p.remarks,
          subJobs: {
            create: p.subJobs.map((sj) => ({
              name: sj.name,
              poSupplyAmt: sj.poSupplyAmt,
              poInstallationAmt: sj.poInstallationAmt,
              sellingSupplyAmt: sj.sellingSupplyAmt,
              sellingErectionAmt: sj.sellingErectionAmt,
              milestones: {
                create: sj.milestones.map((m, i) => ({
                  label: m.label,
                  percent: m.percent,
                  sequence: i + 1,
                  billedSupplyAmt: m.billedSupplyAmt,
                  billedInstallationAmt: m.billedInstallationAmt,
                  dueDate: m.dueDate ? new Date(m.dueDate) : null,
                })),
              },
              collections: {
                create: sj.collections.map((c) => ({ amount: c.amount })),
              },
            })),
          },
          monthlyTargets: {
            create: p.monthlyTargets.map((mt) => ({
              month: mt.month,
              year: mt.year,
              billingTarget: mt.billingTarget,
              billingAchieved: mt.billingAchieved,
              collectionTarget: mt.collectionTarget,
              collectionAchieved: mt.collectionAchieved,
            })),
          },
        },
      });
      results.push({ name: created.name, action: "created", subJobs: p.subJobs.length, milestones: milestoneCount });
    }
  }

  return NextResponse.json({ imported: results.length, results });
}
