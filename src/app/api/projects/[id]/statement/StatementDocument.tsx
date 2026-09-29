import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { formatMoney, formatCompactMoney } from "@/lib/currency";
import { subJobTotals, type DueStatusResult } from "@/lib/billing";

// Helvetica (the PDF base-14 font) has no ₹ glyph — it silently falls back
// to the wrong character. Noto Sans covers ₹ and the other currency symbols
// we support, so register it instead of relying on the built-in fonts.
// Google/Fontsource splits glyph coverage by subset: "latin" has $/€/£ and
// standard punctuation, "latin-ext" is where the ₹ (U+20B9) glyph actually
// lives — @react-pdf/renderer/PDFKit does not fall back across font families
// mid-string, so text containing ₹ must be set in the latin-ext family and
// everything else in the latin family (moneyFontFor() below picks per text run).
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-400-normal.ttf", fontWeight: 400, fontStyle: "normal" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-700-normal.ttf", fontWeight: 700, fontStyle: "normal" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-400-italic.ttf", fontWeight: 400, fontStyle: "italic" },
  ],
});
Font.register({
  family: "Noto Sans Rupee",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-ext-400-normal.ttf", fontWeight: 400, fontStyle: "normal" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-ext-700-normal.ttf", fontWeight: 700, fontStyle: "normal" },
  ],
});

function moneyFontFamily(currencyCode: string): string {
  return currencyCode === "INR" ? "Noto Sans Rupee" : "Noto Sans";
}

const BRAND = "#4C8477";
const INK = "#1f2937";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const BORDER = "#e5e7eb";
const BG_SOFT = "#f3f6f5";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9.5,
    color: INK,
    backgroundColor: "#ffffff",
    fontFamily: "Noto Sans",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  companyName: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND,
    fontFamily: "Noto Sans",
  },
  tagline: {
    fontSize: 9.5,
    color: MUTED,
    marginTop: 2,
  },
  generatedDate: {
    fontSize: 8.5,
    color: FAINT,
    textAlign: "right",
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND,
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Noto Sans", fontWeight: 700,
    color: BRAND,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  infoItem: {
    width: "50%",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 7.5,
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10.5,
    fontFamily: "Noto Sans", fontWeight: 700,
    color: INK,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    backgroundColor: BG_SOFT,
  },
  statLabel: {
    fontSize: 7.5,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Noto Sans", fontWeight: 700,
    color: INK,
  },
  subJobTitle: {
    fontSize: 11.5,
    fontFamily: "Noto Sans", fontWeight: 700,
    color: INK,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  table: {
    width: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: BRAND,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    color: "#ffffff",
    fontFamily: "Noto Sans", fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: "#fafbfb",
  },
  tableCell: {
    fontSize: 9,
    color: INK,
  },
  colMilestone: { width: "32%" },
  colPercent: { width: "10%", textAlign: "right" },
  colDue: { width: "18%", textAlign: "right" },
  colBilled: { width: "20%", textAlign: "right" },
  colStatus: { width: "20%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  remarksBox: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 6,
    fontStyle: "italic",
  },
  footerLine: {
    fontSize: 7.5,
    color: FAINT,
    textAlign: "center",
  },
});

function formatDatePdf(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface MilestoneLite {
  id: string;
  label: string;
  percent: number;
  dueDate: Date | string | null;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
  sequence: number;
}
interface CollectionLite {
  amount: number;
}
interface SubJobLite {
  id: string;
  name: string;
  poSupplyAmt: number;
  poInstallationAmt: number;
  sellingSupplyAmt: number;
  sellingErectionAmt: number;
  milestones: MilestoneLite[];
  collections: CollectionLite[];
}
interface ProjectLite {
  id: string;
  name: string;
  clientName: string | null;
  jobCode: string | null;
  status: string;
  currency: string;
  remarks: string | null;
  subJobs: SubJobLite[];
}

export function StatementDocument({
  project,
  computeDueStatus,
}: {
  project: ProjectLite;
  computeDueStatus: (dueDate: Date | string | null, balance: number) => DueStatusResult;
}) {
  const currency = project.currency;
  const generatedOn = formatDatePdf(new Date());

  const totals = project.subJobs.reduce(
    (acc, sj) => {
      const t = subJobTotals(sj);
      acc.po += t.po;
      acc.billed += t.billed;
      acc.collected += t.collected;
      acc.outstanding += t.outstanding;
      return acc;
    },
    { po: 0, billed: 0, collected: 0, outstanding: 0 }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>SPACE AIR</Text>
            <Text style={styles.tagline}>MEP Contracting — Statement of Account</Text>
          </View>
          <View>
            <Text style={styles.generatedDate}>Generated: {generatedOn}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>Project Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Project Name</Text>
            <Text style={styles.infoValue}>{project.name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Client Name</Text>
            <Text style={styles.infoValue}>{project.clientName ?? "—"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Job Code</Text>
            <Text style={styles.infoValue}>{project.jobCode ?? "—"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{project.status.replace("_", " ")}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Currency</Text>
            <Text style={styles.infoValue}>{currency}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>PO Value</Text>
            <Text style={[styles.statValue, { fontFamily: moneyFontFamily(currency) }]}>{formatCompactMoney(totals.po, currency)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Billed</Text>
            <Text style={[styles.statValue, { fontFamily: moneyFontFamily(currency) }]}>{formatCompactMoney(totals.billed, currency)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={[styles.statValue, { fontFamily: moneyFontFamily(currency) }]}>{formatCompactMoney(totals.collected, currency)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={[styles.statValue, { fontFamily: moneyFontFamily(currency) }]}>{formatCompactMoney(totals.outstanding, currency)}</Text>
          </View>
        </View>

        {project.subJobs.map((subJob) => {
          const t = subJobTotals(subJob);
          const collectedRatio = t.billed > 0 ? t.collected / t.billed : 0;
          const sortedMilestones = [...subJob.milestones].sort((a, b) => a.sequence - b.sequence);
          return (
            <View key={subJob.id} wrap={false}>
              <Text style={styles.subJobTitle}>{subJob.name}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.colMilestone]}>Milestone</Text>
                  <Text style={[styles.tableHeaderCell, styles.colPercent]}>%</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDue]}>Due Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colBilled]}>Billed</Text>
                  <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
                </View>
                {sortedMilestones.length === 0 ? (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { color: FAINT }]}>No milestones recorded.</Text>
                  </View>
                ) : (
                  sortedMilestones.map((m, i) => {
                    const billed = m.billedSupplyAmt + m.billedInstallationAmt;
                    const estCollected = billed * Math.min(1, collectedRatio);
                    const balance = Math.max(0, billed - estCollected);
                    const { label } = computeDueStatus(m.dueDate, balance);
                    return (
                      <View
                        key={m.id}
                        style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                      >
                        <Text style={[styles.tableCell, styles.colMilestone]}>{m.label}</Text>
                        <Text style={[styles.tableCell, styles.colPercent]}>{(m.percent * 100).toFixed(0)}%</Text>
                        <Text style={[styles.tableCell, styles.colDue]}>{formatDatePdf(m.dueDate)}</Text>
                        <Text style={[styles.tableCell, styles.colBilled, { fontFamily: moneyFontFamily(currency) }]}>{formatMoney(billed, currency)}</Text>
                        <Text style={[styles.tableCell, styles.colStatus]}>{label}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          {project.remarks && <Text style={styles.remarksBox}>Remarks: {project.remarks}</Text>}
          <Text style={styles.footerLine}>Generated by Space Air Billing Suite on {generatedOn}</Text>
        </View>
      </Page>
    </Document>
  );
}
