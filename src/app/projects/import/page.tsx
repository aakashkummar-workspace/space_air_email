"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button, Select } from "@/components/ui";
import { formatCompactINR, formatDate } from "@/lib/format";
import { parseWorkbook, ParsedSheet } from "@/lib/import/parse";
import { guessField, IMPORT_FIELDS, ImportField } from "@/lib/import/fields";
import { buildProjectsFromRows, ColumnMapping, BuiltProject } from "@/lib/import/build";

type Step = "upload" | "map" | "preview" | "done";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<"create" | "merge">("create");
  const [built, setBuilt] = useState<BuiltProject[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsedSheets = parseWorkbook(buffer);
      if (parsedSheets.length === 0) {
        setError("No readable data found in this file. Make sure it has at least one sheet with a header row and data.");
        return;
      }
      setFileName(file.name);
      setSheets(parsedSheets);
      setSheetIndex(0);
      setMapping(guessMappingForSheet(parsedSheets[0]));
      setStep("map");
    } catch {
      setError("Couldn't read this file. Make sure it's a valid .xlsx or .xls file.");
    }
  }

  function guessMappingForSheet(sheet: ParsedSheet): ColumnMapping {
    const mapping: ColumnMapping = {};
    sheet.columns.forEach((c) => {
      const samples = sheet.rows.slice(0, 5).map((row) => row[c.index]);
      mapping[c.index] = guessField(c.header, c.section, samples);
    });
    return mapping;
  }

  function switchSheet(idx: number) {
    setSheetIndex(idx);
    setMapping(guessMappingForSheet(sheets[idx]));
  }

  function goToPreview() {
    const currentSheet = sheets[sheetIndex];
    const projects = buildProjectsFromRows(currentSheet.rows, mapping, currentSheet.columns);
    setBuilt(projects);
    setStep("preview");
  }

  async function confirmImport() {
    setImporting(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects: built, mode }),
    });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    setStep("done");
  }

  const hasProjectNameMapped = Object.values(mapping).includes("projectName");

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/projects" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← All Projects
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">Import from Excel</h1>
            <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
              Upload a spreadsheet and map its columns — works with the Team Sheet format, the blank
              template below, or your own layout.
            </p>
          </div>
          <a href="/api/import/template" download>
            <Button variant="secondary">⭳ Download blank template</Button>
          </a>
        </div>
      </div>

      <StepIndicator step={step} />

      {step === "upload" && (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 border-dashed">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-soft)", color: "var(--accent-soft-ink)" }}
          >
            <UploadIcon />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium">Drop your .xlsx file here, or click to browse</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--ink-faint)" }}>
              .xlsx or .xls, any column layout
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
          {error && (
            <p className="text-[12.5px] mt-1" style={{ color: "var(--status-overdue)" }}>
              {error}
            </p>
          )}
        </Card>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">{fileName}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                {sheets[sheetIndex].rows.length} data rows detected
              </div>
            </div>
            {sheets.length > 1 && (
              <div className="w-56">
                <Select value={sheetIndex} onChange={(e) => switchSheet(parseInt(e.target.value, 10))}>
                  {sheets.map((s, i) => (
                    <option key={s.sheetName} value={i}>
                      {s.sheetName}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-[13.5px] mb-1">Map columns</h3>
            <p className="text-[12px] mb-4" style={{ color: "var(--ink-muted)" }}>
              We've guessed a mapping for each column. Adjust any that look wrong, then continue.
            </p>
            <div className="flex flex-col gap-2">
              {sheets[sheetIndex].columns.map((col) => (
                <div key={col.index} className="grid grid-cols-2 gap-3 items-center py-1.5 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium truncate">
                      {col.header}
                      {col.section && (
                        <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent-soft-ink)" }}>
                          {col.section}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>
                      e.g. {String(sheets[sheetIndex].rows[0]?.[col.index] ?? "—")}
                    </div>
                  </div>
                  <Select
                    value={mapping[col.index] ?? "ignore"}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [col.index]: e.target.value as ImportField }))}
                  >
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.group ? `${f.group} — ${f.label}` : f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            {!hasProjectNameMapped && (
              <p className="text-[12px] mt-3" style={{ color: "var(--status-due-soon)" }}>
                Map at least one column to &quot;Project Name&quot; to continue.
              </p>
            )}
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={goToPreview} disabled={!hasProjectNameMapped}>
              Preview Import
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-[13.5px]">
                  {built.length} project{built.length === 1 ? "" : "s"} detected
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
                  {built.reduce((s, p) => s + p.subJobs.length, 0)} sub-jobs ·{" "}
                  {built.reduce((s, p) => s + p.subJobs.reduce((s2, sj) => s2 + sj.milestones.length, 0), 0)} milestones
                </p>
              </div>
              <div className="w-64">
                <Select value={mode} onChange={(e) => setMode(e.target.value as "create" | "merge")}>
                  <option value="create">Create as new projects</option>
                  <option value="merge">Merge into existing projects (match by name)</option>
                </Select>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            {built.map((p, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-semibold text-[14px]">{p.name}</h4>
                  <span className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                    {p.jobCode || "No job code"} {p.clientName ? `· ${p.clientName}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {p.subJobs.map((sj, j) => (
                    <div key={j} className="rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--bg)" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{sj.name}</span>
                        <span className="tabular" style={{ color: "var(--ink-muted)" }}>
                          PO {formatCompactINR(sj.poSupplyAmt + sj.poInstallationAmt)}
                        </span>
                      </div>
                      {sj.milestones.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5" style={{ color: "var(--ink-faint)" }}>
                          {sj.milestones.slice(0, 3).map((m, k) => (
                            <div key={k} className="flex items-center justify-between text-[11px]">
                              <span>
                                {m.label} {m.percent > 0 && `(${(m.percent * 100).toFixed(0)}%)`}
                              </span>
                              <span className="tabular">
                                {formatCompactINR(m.billedSupplyAmt + m.billedInstallationAmt)}
                                {m.dueDate && ` · Due ${formatDate(m.dueDate)}`}
                              </span>
                            </div>
                          ))}
                          {sj.milestones.length > 3 && <div className="text-[11px]">+{sj.milestones.length - 3} more</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${built.length} project${built.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && importResult && (
        <Card className="flex flex-col items-center text-center gap-3 py-10">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--status-completed-bg)", color: "var(--status-completed)" }}
          >
            <CheckIcon />
          </div>
          <div>
            <p className="text-[15px] font-semibold">Import complete</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-muted)" }}>
              {importResult.imported} project{importResult.imported === 1 ? "" : "s"} imported successfully.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Import Another File
            </Button>
            <Button onClick={() => router.push("/projects")}>View Projects</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "map", label: "Map Columns" },
    { key: "preview", label: "Preview" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 animate-fade-up" style={{ animationDelay: "40ms" }}>
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium"
            style={{
              background: i <= currentIdx ? "var(--accent-soft)" : "var(--surface)",
              color: i <= currentIdx ? "var(--accent-soft-ink)" : "var(--ink-faint)",
              border: i <= currentIdx ? "none" : "1px solid var(--border)",
            }}
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9.5px] font-bold"
              style={{
                background: i <= currentIdx ? "var(--accent)" : "var(--border)",
                color: i <= currentIdx ? "var(--accent-ink)" : "var(--ink-faint)",
              }}
            >
              {i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <span className="w-4 h-px" style={{ background: "var(--border)" }} />}
        </div>
      ))}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
