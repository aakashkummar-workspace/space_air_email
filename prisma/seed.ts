import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  // Wipe existing data (dev-only reseed)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.reminderStage.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.subJob.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------
  // Users — one Admin, one Finance, one PM for role-based testing
  // ---------------------------------------------------------------------
  const defaultPasswordHash = await bcrypt.hash("spaceair123", 10);
  await prisma.user.createMany({
    data: [
      { name: "Admin", email: "support@sirahdigital.in", passwordHash: defaultPasswordHash, role: "ADMIN" },
      { name: "Finance Team", email: "finance@spaceair.in", passwordHash: defaultPasswordHash, role: "FINANCE" },
      { name: "Project Manager", email: "pm@spaceair.in", passwordHash: defaultPasswordHash, role: "PM" },
    ],
  });

  // ---------------------------------------------------------------------
  // Email templates + reminder stages (configurable, seeded with sane
  // defaults matching the requested "before / on / after / escalation" flow)
  // ---------------------------------------------------------------------
  const defaultTemplate = await prisma.emailTemplate.create({
    data: {
      name: "Standard Payment Reminder",
      subject: "Payment Reminder — {{projectName}} ({{milestoneLabel}})",
      body: `Dear {{clientName}},

This is a reminder regarding the outstanding balance for {{projectName}} ({{jobCode}}).

Milestone: {{milestoneLabel}}
Amount Due: {{balanceAmount}}
Due Date: {{dueDate}}

Please arrange payment at your earliest convenience. If payment has already been made, kindly disregard this notice.

Regards,
Sirah Digital`,
      toRecipients: "",
      ccRecipients: "support@sirahdigital.in",
      bccRecipients: "",
    },
  });

  const escalationTemplate = await prisma.emailTemplate.create({
    data: {
      name: "Overdue Escalation",
      subject: "URGENT: Overdue Payment — {{projectName}} ({{milestoneLabel}})",
      body: `Dear {{clientName}},

The payment below is significantly overdue and requires immediate attention.

Milestone: {{milestoneLabel}}
Amount Due: {{balanceAmount}}
Original Due Date: {{dueDate}}

Please contact us immediately to resolve this outstanding balance.

Regards,
Sirah Digital`,
      toRecipients: "",
      ccRecipients: "support@sirahdigital.in",
      bccRecipients: "",
    },
  });

  await prisma.reminderStage.createMany({
    data: [
      { name: "Upcoming — 3 days before due", offsetDays: -3, sequence: 1, templateId: defaultTemplate.id, isEscalation: false },
      { name: "Due today", offsetDays: 0, sequence: 2, templateId: defaultTemplate.id, isEscalation: false },
      { name: "7 days overdue", offsetDays: 7, sequence: 3, templateId: defaultTemplate.id, isEscalation: false },
      { name: "21 days overdue — Escalation", offsetDays: 21, sequence: 4, templateId: escalationTemplate.id, isEscalation: true },
    ],
  });

  // ---------------------------------------------------------------------
  // HCL Capital Land — single-job project (from HCL- DETAIL.xlsx)
  // ---------------------------------------------------------------------
  const hcl = await prisma.project.create({
    data: {
      name: "HCL Capital Land",
      clientName: "HCL Capital Land",
      jobCode: null,
      remarks: "Retention held until 02-Feb-2027.",
      subJobs: {
        create: [
          {
            name: "HCL Capital Land",
            poSupplyAmt: 20287964,
            poInstallationAmt: 0,
            sellingSupplyAmt: 20287964,
            sellingErectionAmt: 0,
            milestones: {
              create: [
                {
                  label: "Full Billing",
                  percent: 1,
                  sequence: 1,
                  billedSupplyAmt: 19070685,
                  billedInstallationAmt: 0,
                  dueDate: daysFromNow(-10),
                },
                {
                  label: "Retention Release",
                  percent: 0,
                  sequence: 2,
                  billedSupplyAmt: 0,
                  billedInstallationAmt: 0,
                  dueDate: new Date("2027-02-02"),
                },
              ],
            },
            collections: {
              create: [{ amount: 19070685, receivedOn: daysFromNow(-15), reference: "Bulk billed collection" }],
            },
          },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Supreme Power — 3 sub-jobs (Admin / Factory / Mezzanine), P164
  // ---------------------------------------------------------------------
  const supreme = await prisma.project.create({
    data: {
      name: "Supreme Power",
      clientName: "Supreme Power",
      jobCode: "SAP/TN/25-26/P164",
      remarks:
        "Selling Value only recorded against Admin Building in source sheet; Factory Building and Mezzanine Floor have PO/Billed only.",
      subJobs: {
        create: [
          {
            name: "Admin Building",
            poSupplyAmt: 9361126.5,
            poInstallationAmt: 1211353.25,
            sellingSupplyAmt: 25072455.71,
            sellingErectionAmt: 2748351.38,
            milestones: {
              create: [
                {
                  label: "Full Term",
                  percent: 1,
                  sequence: 1,
                  billedSupplyAmt: 9261086.58,
                  billedInstallationAmt: 1131951.49,
                  dueDate: daysFromNow(5),
                },
              ],
            },
            collections: { create: [{ amount: 10393038.07, receivedOn: daysFromNow(-5) }] },
          },
          {
            name: "Factory Building",
            poSupplyAmt: 12351815,
            poInstallationAmt: 1147338,
            sellingSupplyAmt: 0,
            sellingErectionAmt: 0,
            milestones: {
              create: [
                {
                  label: "Full Term",
                  percent: 1,
                  sequence: 1,
                  billedSupplyAmt: 13129402.1,
                  billedInstallationAmt: 1361480.94,
                  dueDate: daysFromNow(-2),
                },
              ],
            },
            collections: { create: [{ amount: 14490883.04, receivedOn: daysFromNow(-3) }] },
          },
          {
            name: "Mezzanine Floor",
            poSupplyAmt: 2680844,
            poInstallationAmt: 247523,
            sellingSupplyAmt: 0,
            sellingErectionAmt: 0,
            milestones: {
              create: [
                {
                  label: "Full Term",
                  percent: 1,
                  sequence: 1,
                  billedSupplyAmt: 2220957.06,
                  billedInstallationAmt: 177293.95,
                  dueDate: daysFromNow(30),
                },
              ],
            },
            collections: { create: [{ amount: 2398251.01, receivedOn: daysFromNow(-1) }] },
          },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Chettinad — 1 sub-job, 5 payment-term milestones (20/30/30/10/10), P153
  // ---------------------------------------------------------------------
  const chettinad = await prisma.project.create({
    data: {
      name: "Chettinad",
      clientName: "Chettinad",
      jobCode: "SAP/TN/25-26/P153",
      remarks: "Row note from source sheet: '50L' flagged against Term 1 (manual remark, meaning unclear — verify with team).",
      subJobs: {
        create: [
          {
            name: "Chettinad",
            poSupplyAmt: 97407167,
            poInstallationAmt: 7592833,
            sellingSupplyAmt: 64239310.735,
            sellingErectionAmt: 4457977.855,
            milestones: {
              create: [
                {
                  label: "Term 1 — 20%",
                  percent: 0.2,
                  sequence: 1,
                  billedSupplyAmt: 11489346.436,
                  billedInstallationAmt: 646474.332,
                  dueDate: daysFromNow(-45),
                },
                {
                  label: "Term 2 — 30%",
                  percent: 0.3,
                  sequence: 2,
                  billedSupplyAmt: 17234019.649,
                  billedInstallationAmt: 969711.503,
                  dueDate: daysFromNow(-20),
                },
                {
                  label: "Term 3 — 30%",
                  percent: 0.3,
                  sequence: 3,
                  billedSupplyAmt: 16076524.42,
                  billedInstallationAmt: 1041006.61,
                  dueDate: daysFromNow(3),
                },
                {
                  label: "Term 4 — 10%",
                  percent: 0.1,
                  sequence: 4,
                  billedSupplyAmt: 3470854.18,
                  billedInstallationAmt: 295462.21,
                  dueDate: daysFromNow(15),
                },
                {
                  label: "Term 5 — 10%",
                  percent: 0.1,
                  sequence: 5,
                  billedSupplyAmt: 0,
                  billedInstallationAmt: 0,
                  dueDate: daysFromNow(45),
                },
              ],
            },
            collections: {
              create: [{ amount: 51223399.34, receivedOn: daysFromNow(-10), notes: "Cumulative collection to date" }],
            },
          },
        ],
      },
    },
  });

  console.log("Seeded projects:", hcl.id, supreme.id, chettinad.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
