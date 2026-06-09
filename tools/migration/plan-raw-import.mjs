#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_RAW =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_Export_2026-06-02.csv";
const DEFAULT_BACKFILL_RAW =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_Export_2026-06-01.csv";
const DEFAULT_RESOURCES =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/ResourceDetail_Export_2026-06-02.csv";
const DEFAULT_PROJECT_DESCRIPTIONS =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_ProjectDescription.csv";
const DEFAULT_OG_MAP = "tools/migration/mappings/og-lob-map.csv";
const DEFAULT_OUTPUT = "tools/migration/raw-plan-output";
const FALLBACK_USER_EMAIL = "sharepointapps@koniag-gs.com";
const LEGACY_FALLBACK_USER_EMAIL = "sharepointnotifications@koniag-gs.com";
const DEFAULT_HR_EMAIL = "bmack@koniag-gs.com";
const DEFAULT_CFO_EMAIL = "jmorris@koniag-gs.com";
const MIGRATION_CUTOFF = new Date("2026-06-02T00:00:00-04:00");

const WORKFLOW_STATUS_MAP = {
  Completed: { runStatus: "completed", outcome: "approved", currentStepKey: "cfo", pendingRole: "" },
  "Rejected by AR": { runStatus: "rejected", outcome: "rejected", currentStepKey: "cfo", pendingRole: "" },
  "Waiting for OG Manager Approval": { runStatus: "active", outcome: "none", currentStepKey: "ogPresident", pendingRole: "ogPresident" },
  "Sent to AR  to process": { runStatus: "active", outcome: "none", currentStepKey: "cfo", pendingRole: "cfo" },
  "Waiting for HR Approval": { runStatus: "active", outcome: "none", currentStepKey: "hr", pendingRole: "hr" },
  Processing: { runStatus: "active", outcome: "none", currentStepKey: "hr", pendingRole: "hr" },
  Submitted: { runStatus: "active", outcome: "none", currentStepKey: "pm", pendingRole: "pm" },
  "Waiting for Entity A & B Signature": { runStatus: "active", outcome: "none", currentStepKey: "pm", pendingRole: "pm" }
};

const PENDING_ROLE_FIELD = {
  pm: "ProjectManager",
  hr: "HR_Manager",
  ogPresident: "OG_President",
  cfo: ""
};

function parseArgs(argv) {
  const args = {
    raw: DEFAULT_RAW,
    backfillRaw: DEFAULT_BACKFILL_RAW,
    resources: DEFAULT_RESOURCES,
    projectDescriptions: DEFAULT_PROJECT_DESCRIPTIONS,
    ogMap: DEFAULT_OG_MAP,
    out: DEFAULT_OUTPUT,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node tools/migration/plan-raw-import.mjs [options]",
    "",
    "Options:",
    "  --raw <path>          Raw Agreements_Export_2026-06-02.csv",
    "  --backfillRaw <path>  Optional older full export for expired family rows",
    "  --resources <path>    Raw ResourceDetail_Export_2026-06-02.csv",
    "  --projectDescriptions <path>  Optional plain-text ProjectDescription export",
    "  --ogMap <path>        OG/LOB mapping CSV",
    "  --out <dir>           Output folder",
    "  --help                Show this help"
  ].join("\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1)
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = values[index] ?? "";
      });
      return item;
    });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

function get(row, field) {
  return (row?.[field] ?? "").trim();
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }
  if (/^\d{4,5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 25000 && serial < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    }
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIso(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toISOString() : "";
}

function toDateOnly(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function parseNumber(value) {
  const text = String(value ?? "").replace(/[,$\s]/g, "");
  if (!text) {
    return 0;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function parseMoney(value) {
  return parseNumber(value);
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isTrue(value) {
  return /^(true|yes|1)$/i.test(String(value ?? "").trim());
}

function isFutureRow(row) {
  const endDate = parseDate(get(row, "End Date"));
  return !!endDate && endDate > MIGRATION_CUTOFF;
}

function isMod(row) {
  return isTrue(get(row, "Mod")) || parseNumber(get(row, "ModNumber")) > 0;
}

function extractAbbr(value) {
  const match = String(value ?? "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : "";
}

function stripEntity(value) {
  return String(value ?? "").replace(/\s*\([^)]+\)\s*$/, "").trim();
}

function cleanEmailOrFallback(value, fallbackEmail = FALLBACK_USER_EMAIL) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === LEGACY_FALLBACK_USER_EMAIL) {
    return FALLBACK_USER_EMAIL;
  }
  return text.includes("@") ? text : fallbackEmail;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function auditUserEmail(row, field, issues, authNumber, legacyId = get(row, "ID"), context = {}) {
  const value = get(row, field);
  if (!isEmail(value)) {
    issues.push({
      issueType: "invalid_user_email",
      severity: "warning",
      authNumber,
      ...context,
      legacyId,
      field,
      message: `User field '${field}' is not an email for legacy ID '${legacyId}'. Fallback '${FALLBACK_USER_EMAIL}' will be used.`
    });
  }
}

function defaultEmailForRole(role) {
  if (role === "hr") {
    return DEFAULT_HR_EMAIL;
  }
  if (role === "cfo") {
    return DEFAULT_CFO_EMAIL;
  }
  return FALLBACK_USER_EMAIL;
}

function pendingApproverEmail(row, role) {
  const pendingField = PENDING_ROLE_FIELD[role] ?? "";
  if (pendingField) {
    return cleanEmailOrFallback(get(row, pendingField), defaultEmailForRole(role));
  }
  return role ? defaultEmailForRole(role) : "";
}

function normalizeState(value) {
  const code = String(value ?? "").trim().toUpperCase();
  const states = {
    AL: "Alabama (AL)",
    AK: "Alaska (AK)",
    AZ: "Arizona (AZ)",
    AR: "Arkansas (AR)",
    CA: "California (CA)",
    CO: "Colorado (CO)",
    CT: "Connecticut (CT)",
    DE: "Delaware (DE)",
    DC: "District of Columbia (DC)",
    FL: "Florida (FL)",
    GA: "Georgia (GA)",
    HI: "Hawaii (HI)",
    ID: "Idaho (ID)",
    IL: "Illinois (IL)",
    IN: "Indiana (IN)",
    IA: "Iowa (IA)",
    KS: "Kansas (KS)",
    KY: "Kentucky (KY)",
    LA: "Louisiana (LA)",
    ME: "Maine (ME)",
    MD: "Maryland (MD)",
    MA: "Massachusetts (MA)",
    MI: "Michigan (MI)",
    MN: "Minnesota (MN)",
    MS: "Mississippi (MS)",
    MO: "Missouri (MO)",
    MT: "Montana (MT)",
    NE: "Nebraska (NE)",
    NV: "Nevada (NV)",
    NH: "New Hampshire (NH)",
    NJ: "New Jersey (NJ)",
    NM: "New Mexico (NM)",
    NY: "New York (NY)",
    NC: "North Carolina (NC)",
    ND: "North Dakota (ND)",
    OH: "Ohio (OH)",
    OK: "Oklahoma (OK)",
    OR: "Oregon (OR)",
    PA: "Pennsylvania (PA)",
    RI: "Rhode Island (RI)",
    SC: "South Carolina (SC)",
    SD: "South Dakota (SD)",
    TN: "Tennessee (TN)",
    TX: "Texas (TX)",
    UT: "Utah (UT)",
    VT: "Vermont (VT)",
    VA: "Virginia (VA)",
    WA: "Washington (WA)",
    WV: "West Virginia (WV)",
    WI: "Wisconsin (WI)",
    WY: "Wyoming (WY)"
  };
  if (!code) {
    return "";
  }
  return states[code] ?? String(value ?? "").trim();
}

function normalizeContractType(value) {
  return /^ffp$/i.test(String(value ?? "").trim()) ? "ffp" : "tm";
}

function firstNonBlank(rows, field) {
  return get(rows.find((row) => get(row, field)), field);
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function richTextToPlainText(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return decodeHtmlEntities(text)
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<(br|br\/)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
  });
  return map;
}

function loadOgMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const rawOperatingGroup = get(row, "rawOperatingGroup");
    if (!rawOperatingGroup) {
      return;
    }
    map.set(rawOperatingGroup, {
      targetOperatingGroup: get(row, "targetOperatingGroup"),
      lob: get(row, "lob")
    });
  });
  return map;
}

function minDate(rows, field) {
  const dates = rows.map((row) => parseDate(get(row, field))).filter(Boolean);
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : undefined;
}

function maxDate(rows, field) {
  const dates = rows.map((row) => parseDate(get(row, field))).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : undefined;
}

function sortFamily(rows) {
  return [...rows].sort((left, right) => {
    const leftMod = parseNumber(get(left, "ModNumber"));
    const rightMod = parseNumber(get(right, "ModNumber"));
    if (leftMod !== rightMod) {
      return leftMod - rightMod;
    }
    return parseNumber(get(left, "ID")) - parseNumber(get(right, "ID"));
  });
}

function latestFamilyRow(rows) {
  return [...rows].sort((left, right) => {
    const modDiff = parseNumber(get(right, "ModNumber")) - parseNumber(get(left, "ModNumber"));
    if (modDiff !== 0) {
      return modDiff;
    }
    return (parseDate(get(right, "Modified"))?.getTime() ?? 0) - (parseDate(get(left, "Modified"))?.getTime() ?? 0);
  })[0];
}

function baseFamilyRow(rows) {
  return sortFamily(rows).find((row) => !isMod(row)) ?? latestFamilyRow(rows);
}

function authStatusForFamily(rows) {
  const latest = latestFamilyRow(rows);
  const status = get(latest, "Status");
  const statusText = `${status} ${get(latest, "Workflow Status")} ${get(latest, "Approval_Status")}`;
  if (/rejected/i.test(statusText)) {
    return "rejected";
  }
  if (get(latest, "Approval_Status") === "Approved" || isTrue(get(latest, "SignedA")) || isTrue(get(latest, "SignedB")) || /completed/i.test(get(latest, "Workflow Status"))) {
    return "approved";
  }
  if (/in progress/i.test(status)) {
    return "underReview";
  }
  if (/not started|submitted/i.test(status)) {
    return "submitted";
  }
  return "approved";
}

function workflowStatusForFamily(rows) {
  const latest = latestFamilyRow(rows);
  return get(latest, "Workflow Status") || "Completed";
}

function workflowStatusForRow(row) {
  return get(row, "Workflow Status") || "Completed";
}

function legacyNote(row) {
  return `Migrated from Legacy IWA list. Legacy Sequence: ${get(row, "Sequence")}, Legacy ID: ${get(row, "ID")}`;
}

function pdfFileNameFromLocation(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
  } catch {
    const clean = text.split(/[?#]/)[0];
    return decodeURIComponent(clean.split("/").filter(Boolean).pop() ?? "");
  }
}

function migratedPdfPath(row) {
  const fileName = pdfFileNameFromLocation(get(row, "PdfLocation"));
  return fileName ? `IWAExports/${fileName}` : "";
}

function parseSequenceParts(row) {
  const sequence = get(row, "Sequence");
  const match = sequence.match(/^(.+?\([^)]+\))-(\d{4})-\d{2}-(\d+)-(.+?)(?:\s+-\s+Mod\s+\d+)?$/i);
  if (!match) {
    return undefined;
  }
  return {
    firstAbbr: extractAbbr(match[1]),
    secondAbbr: extractAbbr(match[4]),
    year: match[2],
    sequenceNumber: match[3]
  };
}

function plannedAuthNumber(rows) {
  const latest = latestFamilyRow(rows);
  const base = rows.find((row) => !isMod(row)) ?? latest;
  const parsed = parseSequenceParts(base) ?? parseSequenceParts(latest) ?? rows.map(parseSequenceParts).find(Boolean);
  const firstAbbr = parsed?.firstAbbr || extractAbbr(get(latest, "EntityB")) || "UNK";
  const secondAbbr = parsed?.secondAbbr || extractAbbr(get(latest, "EntityA")) || "UNK";
  const year = parsed?.year || parseDate(get(latest, "Start Date"))?.getFullYear() || "YYYY";
  const sequenceNumber = parsed?.sequenceNumber || get(base, "ID") || get(latest, "ID");
  return `IWA-${firstAbbr}-${secondAbbr}-${year}-M-${sequenceNumber}`;
}

function resourcesForFamily(resourceRows, familyRows) {
  const ids = new Set(familyRows.map((row) => get(row, "ID")));
  const guids = new Set();
  familyRows.forEach((row) => {
    [get(row, "GUID"), get(row, "Parent GUID"), get(row, "Mod GUID")].filter(Boolean).forEach((guid) => guids.add(guid));
  });
  return resourceRows.filter((row) => {
    if (ids.has(get(row, "ParentID"))) {
      return true;
    }
    return [get(row, "ParGuid"), get(row, "Parent_GUID"), get(row, "ModGuid")].some((guid) => guid && guids.has(guid));
  });
}

function associatedFamilyRow(resource, familyRows) {
  const byId = familyRows.find((row) => get(row, "ID") === get(resource, "ParentID"));
  if (byId) {
    return byId;
  }
  return familyRows.find((row) => get(row, "Mod GUID") === get(resource, "ModGuid")) ??
    familyRows.find((row) => !isMod(row)) ??
    familyRows[0];
}

function buildAuthorization(familyRows, ogMap, issues) {
  const sorted = sortFamily(familyRows);
  const latest = latestFamilyRow(sorted);
  const base = baseFamilyRow(sorted);
  const authNumber = plannedAuthNumber(sorted);
  const mapped = ogMap.get(get(latest, "Operating Group"));
  const status = authStatusForFamily(sorted);
  const projectDescription = richTextToPlainText(get(base, "ProjectDescription")) || richTextToPlainText(get(latest, "ProjectDescription"));
  const contractId = get(latest, "ProjectId") || get(base, "ProjectId") || firstNonBlank(sorted, "ProjectId");
  const customerContractCode = get(latest, "Contract Number");
  const issueContext = { contractId, customerContractCode };
  const invoice = get(latest, "Task Order Project ID");
  const baseLaborAmount = parseMoney(get(base, "Amount Authorized"));
  const baseTravelAmount = parseMoney(get(base, "ODC Amount")) || parseMoney(get(base, "GrandODC"));
  const baseGrandTotal = baseLaborAmount + baseTravelAmount;
  const modCount = Math.max(0, ...sorted.map((row) => parseNumber(get(row, "ModNumber"))));
  const approvedRows = sorted.filter((row) => {
    if (!isMod(row)) {
      return true;
    }
    return get(row, "Approval_Status") === "Approved" || isTrue(get(row, "SignedA")) || isTrue(get(row, "SignedB"));
  });
  const approvedLaborAmount = approvedRows.reduce((total, row) => total + parseMoney(get(row, "Amount Authorized")), 0);
  const approvedTravelAmount = approvedRows.reduce((total, row) => total + (parseMoney(get(row, "ODC Amount")) || parseMoney(get(row, "GrandODC"))), 0);
  const approvedGrandTotal = approvedLaborAmount + approvedTravelAmount;

  if (!mapped?.targetOperatingGroup || !mapped?.lob) {
    issues.push({
      issueType: "missing_og_lob_mapping",
      severity: "warning",
      authNumber,
      ...issueContext,
      legacyId: sorted.map((row) => get(row, "ID")).join(";"),
      message: `Missing OG/LOB mapping for raw Operating Group '${get(latest, "Operating Group")}'.`
    });
  }

  sorted
    .filter((row) => !get(row, "ProjectId"))
    .forEach((row) => {
      issues.push({
        issueType: "missing_legacy_project_id_with_family_fallback",
        severity: "warning",
        authNumber,
        ...issueContext,
        legacyId: get(row, "ID"),
        message: `Legacy ProjectId is blank for '${get(row, "Sequence")}'. Family fallback contractId '${contractId || "(blank)"}' will be used.`
      });
    });

  if (!contractId) {
    issues.push({
      issueType: "missing_planned_contract_id",
      severity: "error",
      authNumber,
      ...issueContext,
      legacyId: sorted.map((row) => get(row, "ID")).join(";"),
      message: "No legacy ProjectId was found anywhere in this family, so target contractId would be blank."
    });
  }

  if (invoice && !/^\d{6}-\d{4}$/.test(invoice)) {
    issues.push({
      issueType: "invoice_format_issue",
      severity: "warning",
      authNumber,
      ...issueContext,
      legacyId: get(latest, "ID"),
      invoice,
      message: `Invoice '${invoice}' from Task Order Project ID does not match expected format ######-####.`
    });
  }

  ["ProjectManager", "EntityAManager", "EntityBManager", "HR_Manager", "OG_President", "Created By", "Modified By"].forEach((field) => {
    auditUserEmail(latest, field, issues, authNumber, get(latest, "ID"), issueContext);
  });

  return {
    migrationKey: authNumber,
    legacyParentGuid: get(latest, "Parent GUID"),
    legacySourceIds: sorted.map((row) => get(row, "ID")).join(";"),
    Title: authNumber,
    authorizationStatus: status,
    pmRaw: get(latest, "ProjectManager"),
    pmEmail: cleanEmailOrFallback(get(latest, "ProjectManager")),
    donorEntity: stripEntity(get(latest, "EntityA")),
    donorEntityAbbr: extractAbbr(get(latest, "EntityA")),
    donorGmRaw: get(latest, "EntityAManager"),
    donorGmEmail: cleanEmailOrFallback(get(latest, "EntityAManager")),
    receivingEntity: stripEntity(get(latest, "EntityB")),
    receivingEntityAbbr: extractAbbr(get(latest, "EntityB")),
    receivingGmRaw: get(latest, "EntityBManager"),
    receivingGmEmail: cleanEmailOrFallback(get(latest, "EntityBManager")),
    og: mapped?.targetOperatingGroup ?? "",
    lob: mapped?.lob ?? "",
    rawOperatingGroup: get(latest, "Operating Group"),
    contractName: get(latest, "Project Name"),
    contractId,
    iwaJamisProjectId: get(latest, "IWA Project ID"),
    customerContractCode,
    invoice,
    contractType: normalizeContractType(get(latest, "Contract Type")),
    periodStart: toDateOnly(minDate(sorted, "Start Date")),
    periodEnd: toDateOnly(maxDate(sorted, "End Date")),
    scopeOfWork: projectDescription,
    justification: projectDescription,
    notes: legacyNote(base),
    legacyPdfLocation: get(base, "PdfLocation"),
    pdfUrl: migratedPdfPath(base),
    baseLaborAmount,
    baseTravelAmount,
    baseGrandTotal,
    approvedLaborAmount,
    approvedTravelAmount,
    approvedGrandTotal,
    modCount,
    approvedOn: status === "approved" ? toIso(get(latest, "Modified")) : "",
    rejectedOn: status === "rejected" ? toIso(get(latest, "Modified")) : "",
    created: toIso(get(latest, "Created")),
    createdByRaw: get(latest, "Created By"),
    createdByEmail: cleanEmailOrFallback(get(latest, "Created By")),
    modified: toIso(get(latest, "Modified")),
    modifiedByRaw: get(latest, "Modified By"),
    modifiedByEmail: cleanEmailOrFallback(get(latest, "Modified By")),
    workflowStatus: workflowStatusForFamily(sorted),
    rawFamilyRowCount: sorted.length,
    futureFamilyRowCount: sorted.filter(isFutureRow).length,
    expiredBackfillRowCount: sorted.filter((row) => !isFutureRow(row)).length
  };
}

function buildMods(auth, familyRows, issues) {
  return sortFamily(familyRows).filter(isMod).map((row) => {
    const modNumber = parseNumber(get(row, "ModNumber"));
    const isRejected = /rejected/i.test(`${get(row, "Status")} ${get(row, "Workflow Status")} ${get(row, "Approval_Status")}`);
    const isApproved = get(row, "Approval_Status") === "Approved" || isTrue(get(row, "SignedA")) || isTrue(get(row, "SignedB"));
    const laborAmount = parseMoney(get(row, "Amount Authorized"));
    const travelAmount = parseMoney(get(row, "ODC Amount")) || parseMoney(get(row, "GrandODC"));
    ["Created By", "Modified By"].forEach((field) => {
      auditUserEmail(row, field, issues, auth.migrationKey, get(row, "ID"), {
        contractId: auth.contractId,
        customerContractCode: auth.customerContractCode
      });
    });
    return {
      migrationKey: `${auth.migrationKey}:MOD:${modNumber || get(row, "ID")}`,
      authorizationMigrationKey: auth.migrationKey,
      legacyId: get(row, "ID"),
      Title: `${auth.Title}-MOD-${String(modNumber || 0).padStart(2, "0")}`,
      modNumber,
      modStatus: isRejected ? "rejected" : isApproved ? "approved" : "underReview",
      reason: richTextToPlainText(get(row, "ProjectDescription")) || "Migrated legacy modification",
      changeSummary: get(row, "Sequence"),
      notes: legacyNote(row),
      legacyPdfLocation: get(row, "PdfLocation"),
      pdfUrl: migratedPdfPath(row),
      laborAmount,
      travelAmount,
      grandTotal: laborAmount + travelAmount,
      approvedOn: isApproved ? toIso(get(row, "Modified")) : "",
      rejectedOn: isRejected ? toIso(get(row, "Modified")) : "",
      created: toIso(get(row, "Created")),
      createdByRaw: get(row, "Created By"),
      createdByEmail: cleanEmailOrFallback(get(row, "Created By")),
      modified: toIso(get(row, "Modified")),
      modifiedByRaw: get(row, "Modified By"),
      modifiedByEmail: cleanEmailOrFallback(get(row, "Modified By"))
    };
  });
}

function buildLines(auth, familyRows, resourceRows, issues) {
  const resources = [];
  const laborLines = [];
  const employees = new Map();
  resourcesForFamily(resourceRows, familyRows).forEach((resource, index) => {
    const familyRow = associatedFamilyRow(resource, familyRows);
    const modNumber = isMod(familyRow) ? parseNumber(get(familyRow, "ModNumber")) : 0;
    const lineScope = modNumber ? "mod" : "base";
    const employeeRaw = get(resource, "Employee");
    const employeeEmail = cleanEmailOrFallback(employeeRaw);
    const employeeDisplayName = employeeRaw || employeeEmail;
    const lineNumber = index + 1;
    const resourceKey = `${auth.migrationKey}:RESOURCE:${get(resource, "ID") || lineNumber}`;
    if (employeeDisplayName) {
      const key = employeeDisplayName.toLowerCase();
      if (!employees.has(key)) {
        employees.set(key, { employeeDisplayName, employeeEmail: isEmail(employeeRaw) ? employeeEmail : "", occurrenceCount: 0 });
      }
      employees.get(key).occurrenceCount += 1;
    }
    if (!isEmail(employeeRaw)) {
      issues.push({
        issueType: "resource_employee_needs_resolution",
        severity: "info",
        authNumber: auth.migrationKey,
        contractId: auth.contractId,
        customerContractCode: auth.customerContractCode,
        legacyId: get(resource, "ParentID"),
        message: `Resource employee '${employeeDisplayName || "(blank)"}' will default to ${FALLBACK_USER_EMAIL} unless mapped before live import.`
      });
    }
    resources.push({
      migrationKey: resourceKey,
      authorizationMigrationKey: auth.migrationKey,
      modNumber,
      legacyResourceId: get(resource, "ID"),
      legacyParentId: get(resource, "ParentID"),
      lineScope,
      lineNumber,
      displayOrder: lineNumber,
      Title: employeeDisplayName || `Resource ${lineNumber}`,
      employeeDisplayName,
      employeeEmail,
      state: normalizeState(get(resource, "Work State")),
      laborCategory: get(resource, "Role_Position"),
      comments: ""
    });
    const pricingType = normalizeContractType(get(resource, "Contract_Type") || auth.contractType);
    const totalAmount = parseMoney(get(resource, "Total")) || parseMoney(get(resource, "Original Total"));
    const standardHours = parseNumber(get(resource, "Units Quantity")) || parseNumber(get(resource, "Total Hours")) || parseNumber(get(resource, "Original"));
    const standardRate = parseMoney(get(resource, "Bill Rate")) || parseMoney(get(resource, "Original Cost"));
    const jobId = get(resource, "JobID");
    const standardAmount = roundCurrency(standardRate * standardHours);
    if (!jobId) {
      issues.push({
        issueType: "missing_resource_job_id",
        severity: "warning",
        authNumber: auth.migrationKey,
        contractId: auth.contractId,
        customerContractCode: auth.customerContractCode,
        legacyId: get(resource, "ParentID"),
        legacyResourceId: get(resource, "ID"),
        message: `Resource legacy ID '${get(resource, "ID") || "(blank)"}' has a blank JobID.`
      });
    }
    laborLines.push({
      migrationKey: `${resourceKey}:LABOR`,
      authorizationMigrationKey: auth.migrationKey,
      resourceMigrationKey: resourceKey,
      invoice: auth.invoice,
      "JAMIS Project ID": auth.iwaJamisProjectId,
      modNumber,
      lineScope,
      lineNumber,
      displayOrder: lineNumber,
      Title: `${employeeDisplayName || `Labor ${lineNumber}`} Labor`,
      pricingType,
      jobId,
      standardRate: pricingType === "tm" ? standardRate : 0,
      standardHours: pricingType === "tm" ? standardHours : 0,
      standardAmount: pricingType === "tm" ? standardAmount : 0,
      lumpSumAmount: pricingType === "ffp" ? totalAmount : 0,
      totalAmount,
      comments: ""
    });
  });
  return { employees: Array.from(employees.values()), laborLines, resources };
}

function buildTravel(auth, familyRows, issues) {
  return sortFamily(familyRows).flatMap((row, index) => {
    const amount = parseMoney(get(row, "ODC Amount")) || parseMoney(get(row, "GrandODC"));
    const jobId = get(row, "ODC Job_ID");
    if (!amount && !jobId && !isTrue(get(row, "Travel"))) {
      return [];
    }
    if (!jobId) {
      issues.push({
        issueType: "missing_travel_odc_job_id",
        severity: "warning",
        authNumber: auth.migrationKey,
        contractId: auth.contractId,
        customerContractCode: auth.customerContractCode,
        legacyId: get(row, "ID"),
        amount,
        message: `Travel/ODC legacy ID '${get(row, "ID") || "(blank)"}' has a blank ODC Job_ID.`
      });
    }
    const modNumber = isMod(row) ? parseNumber(get(row, "ModNumber")) : 0;
    return [{
      migrationKey: `${auth.migrationKey}:TRAVEL:${get(row, "ID")}`,
      authorizationMigrationKey: auth.migrationKey,
      invoice: auth.invoice,
      "JAMIS Project ID": auth.iwaJamisProjectId,
      modNumber,
      legacyId: get(row, "ID"),
      lineScope: modNumber ? "mod" : "base",
      lineNumber: index + 1,
      displayOrder: index + 1,
      Title: get(row, "ODC Job_Name") || "Migrated Travel/ODC",
      lineType: isTrue(get(row, "Travel")) ? "travel" : "odc",
      jobId,
      description: get(row, "ODC Job_Name") || "Migrated legacy ODC amount",
      amount,
      comments: ""
    }];
  });
}

function statusForWorkflowRow(row, fallbackStatus) {
  const textValue = `${get(row, "Status")} ${get(row, "Workflow Status")} ${get(row, "Approval_Status")}`;
  if (/rejected/i.test(textValue)) {
    return "rejected";
  }
  if (get(row, "Approval_Status") === "Approved" || isTrue(get(row, "SignedA")) || isTrue(get(row, "SignedB")) || /completed/i.test(get(row, "Workflow Status"))) {
    return "approved";
  }
  return fallbackStatus;
}

function buildWorkflowForRow(auth, row, options) {
  const rowStatus = statusForWorkflowRow(row, auth.authorizationStatus);
  const mapping = WORKFLOW_STATUS_MAP[workflowStatusForRow(row)] ?? WORKFLOW_STATUS_MAP.Completed;
  const runStatus = rowStatus === "approved" ? "completed" : rowStatus === "rejected" ? "rejected" : mapping.runStatus;
  const outcome = rowStatus === "approved" ? "approved" : rowStatus === "rejected" ? "rejected" : mapping.outcome;
  const currentStepKey = runStatus === "completed" ? "cfo" : mapping.currentStepKey;
  const pendingRole = runStatus === "active" ? mapping.pendingRole : "";
  const actionDate = toIso(get(row, "Modified")) || toIso(get(row, "Created")) || new Date().toISOString();
  const runKey = `${auth.migrationKey}:RUN:${options.runNumber}`;
  const runTitle = `${auth.Title}-RUN-${options.runNumber}`;
  const run = {
    migrationKey: runKey,
    authorizationMigrationKey: auth.migrationKey,
    modMigrationKey: options.modMigrationKey ?? "",
    modNumber: options.modNumber ?? 0,
    Title: runTitle,
    runNumber: options.runNumber,
    runType: options.runType,
    runStatus,
    hasDecision: runStatus !== "active",
    outcome,
    currentStepKey,
    pendingRole,
    pendingApproverEmail: pendingApproverEmail(row, pendingRole),
    stepAssignedDate: runStatus === "active" ? actionDate : "",
    completedOn: runStatus === "active" ? "" : actionDate,
    skipPmStep: false,
    hrRaw: get(row, "HR_Manager"),
    hrEmail: cleanEmailOrFallback(get(row, "HR_Manager"), DEFAULT_HR_EMAIL),
    ogPresidentRaw: get(row, "OG_President"),
    ogPresidentEmail: cleanEmailOrFallback(get(row, "OG_President")),
    cfoEmail: DEFAULT_CFO_EMAIL
  };
  const actions = [{
    migrationKey: `${run.migrationKey}:SUBMIT`,
    authorizationMigrationKey: auth.migrationKey,
    modMigrationKey: run.modMigrationKey,
    workflowRunMigrationKey: run.migrationKey,
    Title: `${auth.Title}-Run${options.runNumber}-submitted`,
    stepKey: "submit",
    actionType: "submitted",
    actionByEmail: cleanEmailOrFallback(get(row, "Created By")),
    actionDate: toIso(get(row, "Created")) || actionDate,
    role: "requestor",
    comments: "Migrated legacy IWA submission."
  }];
  if (runStatus === "completed") {
    actions.push({
      migrationKey: `${run.migrationKey}:PM_APPROVED`,
      authorizationMigrationKey: auth.migrationKey,
      modMigrationKey: run.modMigrationKey,
      workflowRunMigrationKey: run.migrationKey,
      Title: `${auth.Title}-Run${options.runNumber}-pm-approved`,
      stepKey: "pm",
      actionType: "approved",
      actionByEmail: cleanEmailOrFallback(get(row, "ProjectManager")),
      actionDate,
      role: "pm",
      comments: "Synthetic migrated PM approval action."
    });
    const middleApprovalActions = auth.contractType === "tm"
      ? [
        {
          stepKey: "hr",
          role: "hr",
          actionByEmail: cleanEmailOrFallback(get(row, "HR_Manager"), DEFAULT_HR_EMAIL),
          comments: `Synthetic migrated HR approval action. Legacy HR_Update: ${get(row, "HR_Update") || "(blank)"}.`
        },
        {
          stepKey: "ogPresident",
          role: "ogPresident",
          actionByEmail: cleanEmailOrFallback(get(row, "OG_President")),
          comments: `Synthetic migrated OGP approval action. Legacy OG_Approval: ${get(row, "OG_Approval") || "(blank)"}.`
        }
      ]
      : [
        {
          stepKey: "ogPresident",
          role: "ogPresident",
          actionByEmail: cleanEmailOrFallback(get(row, "OG_President")),
          comments: `Synthetic migrated OGP approval action. Legacy OG_Approval: ${get(row, "OG_Approval") || "(blank)"}.`
        }
      ];
    middleApprovalActions.forEach((approval) => {
      actions.push({
        migrationKey: `${run.migrationKey}:${approval.stepKey.toUpperCase()}_APPROVED`,
        authorizationMigrationKey: auth.migrationKey,
        modMigrationKey: run.modMigrationKey,
        workflowRunMigrationKey: run.migrationKey,
        Title: `${auth.Title}-Run${options.runNumber}-${approval.stepKey}-approved`,
        stepKey: approval.stepKey,
        actionType: "approved",
        actionByEmail: approval.actionByEmail,
        actionDate,
        role: approval.role,
        comments: approval.comments
      });
    });
    actions.push({
      migrationKey: `${run.migrationKey}:CFO_APPROVED`,
      authorizationMigrationKey: auth.migrationKey,
      modMigrationKey: run.modMigrationKey,
      workflowRunMigrationKey: run.migrationKey,
      Title: `${auth.Title}-Run${options.runNumber}-cfo-approved`,
      stepKey: "cfo",
      actionType: "approved",
      actionByEmail: DEFAULT_CFO_EMAIL,
      actionDate,
      role: "cfo",
      comments: "Synthetic migrated approval action. Legacy Entity A/B signatures were intentionally not recreated."
    });
  }
  if (runStatus === "rejected") {
    actions.push({
      migrationKey: `${run.migrationKey}:REJECTED`,
      authorizationMigrationKey: auth.migrationKey,
      modMigrationKey: run.modMigrationKey,
      workflowRunMigrationKey: run.migrationKey,
      Title: `${auth.Title}-Run${options.runNumber}-${currentStepKey}-rejected`,
      stepKey: currentStepKey,
      actionType: "rejected",
      actionByEmail: cleanEmailOrFallback(get(row, "Modified By")),
      actionDate,
      role: pendingRole || "admin",
      comments: "Migrated legacy rejected status."
    });
  }
  return { actions, run };
}

function buildWorkflows(auth, familyRows) {
  const sorted = sortFamily(familyRows);
  const base = baseFamilyRow(sorted);
  const workflows = [buildWorkflowForRow(auth, base, {
    runNumber: 1,
    runType: "base",
    modNumber: 0
  })];
  sortFamily(sorted).filter(isMod).forEach((row) => {
    const modNumber = parseNumber(get(row, "ModNumber"));
    workflows.push(buildWorkflowForRow(auth, row, {
      runNumber: workflows.length + 1,
      runType: "mod",
      modNumber,
      modMigrationKey: `${auth.migrationKey}:MOD:${modNumber || get(row, "ID")}`
    }));
  });
  return {
    runs: workflows.map((workflow) => workflow.run),
    actions: workflows.flatMap((workflow) => workflow.actions)
  };
}

function buildPlan(rawRows, resourceRows, ogRows) {
  const ogMap = loadOgMap(ogRows);
  const futureParentGuids = new Set(rawRows.filter(isFutureRow).map((row) => get(row, "Parent GUID")).filter(Boolean));
  const inScopeRows = rawRows.filter((row) => futureParentGuids.has(get(row, "Parent GUID")));
  const families = groupBy(inScopeRows, (row) => get(row, "Parent GUID"));
  const issues = [];
  const authorizations = [];
  const mods = [];
  const resources = [];
  const laborLines = [];
  const travelOdc = [];
  const workflowRuns = [];
  const workflowActions = [];
  const employeeMap = new Map();

  for (const familyRows of families.values()) {
    const auth = buildAuthorization(familyRows, ogMap, issues);
    authorizations.push(auth);
    mods.push(...buildMods(auth, familyRows, issues));
    const lines = buildLines(auth, familyRows, resourceRows, issues);
    resources.push(...lines.resources);
    laborLines.push(...lines.laborLines);
    lines.employees.forEach((employee) => {
      const key = employee.employeeDisplayName.toLowerCase();
      if (!employeeMap.has(key)) {
        employeeMap.set(key, { ...employee, sampleAuthNumbers: new Set() });
      }
      employeeMap.get(key).occurrenceCount += employee.occurrenceCount;
      employeeMap.get(key).sampleAuthNumbers.add(auth.migrationKey);
    });
    travelOdc.push(...buildTravel(auth, familyRows, issues));
    const workflows = buildWorkflows(auth, familyRows);
    workflowRuns.push(...workflows.runs);
    workflowActions.push(...workflows.actions);
  }

  const resourceEmployees = Array.from(employeeMap.values()).map((employee) => ({
    employeeDisplayName: employee.employeeDisplayName,
    employeeEmail: employee.employeeEmail,
    occurrenceCount: employee.occurrenceCount,
    sampleAuthNumbers: Array.from(employee.sampleAuthNumbers).slice(0, 5).join(";")
  })).sort((left, right) => left.employeeDisplayName.localeCompare(right.employeeDisplayName));

  return {
    summary: {
      generatedOn: new Date().toISOString(),
      rawRows: rawRows.length,
      futureRows: rawRows.filter(isFutureRow).length,
      targetAuthorizations: authorizations.length,
      targetMods: mods.length,
      targetResources: resources.length,
      targetLaborLines: laborLines.length,
      targetTravelOdc: travelOdc.length,
      targetWorkflowRuns: workflowRuns.length,
      targetWorkflowActions: workflowActions.length,
    uniqueResourceEmployees: resourceEmployees.length,
    fallbackUserEmail: FALLBACK_USER_EMAIL,
    defaultHrEmail: DEFAULT_HR_EMAIL,
    defaultCfoEmail: DEFAULT_CFO_EMAIL,
    issueCounts: issues.reduce((counts, issue) => {
        counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
        return counts;
      }, {})
    },
    authorizations,
    mods,
    resources,
    laborLines,
    travelOdc,
    workflowRuns,
    workflowActions,
    resourceEmployees,
    issues
  };
}

function mergePrimaryWithBackfill(primaryRows, backfillRows) {
  const rowsById = new Map();
  backfillRows.forEach((row) => {
    const id = get(row, "ID");
    if (id) {
      rowsById.set(id, row);
    }
  });
  primaryRows.forEach((row) => {
    const id = get(row, "ID");
    if (id) {
      rowsById.set(id, row);
    }
  });

  const futureParentGuids = new Set(primaryRows.filter(isFutureRow).map((row) => get(row, "Parent GUID")).filter(Boolean));
  return Array.from(rowsById.values()).filter((row) => futureParentGuids.has(get(row, "Parent GUID")));
}

function applyProjectDescriptions(rows, descriptionRows) {
  if (!descriptionRows.length) {
    return rows;
  }
  const byId = new Map();
  descriptionRows.forEach((row) => {
    const id = get(row, "ID");
    if (id) {
      byId.set(id, get(row, "ProjectDescription"));
    }
  });
  return rows.map((row) => {
    const description = byId.get(get(row, "ID"));
    return description !== undefined
      ? { ...row, ProjectDescription: description }
      : row;
  });
}

async function writeOutputs(plan, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const contractIdIssues = plan.issues.filter((issue) =>
    issue.issueType === "missing_legacy_project_id_with_family_fallback" ||
    issue.issueType === "missing_legacy_project_id" ||
    issue.issueType === "missing_planned_contract_id"
  );
  await Promise.all([
    fs.writeFile(path.join(outDir, "summary.json"), JSON.stringify(plan.summary, null, 2), "utf8"),
    fs.writeFile(path.join(outDir, "raw-migration-plan.json"), JSON.stringify(plan, null, 2), "utf8"),
    fs.writeFile(path.join(outDir, "authorizations.csv"), toCsv(plan.authorizations), "utf8"),
    fs.writeFile(path.join(outDir, "mods.csv"), toCsv(plan.mods), "utf8"),
    fs.writeFile(path.join(outDir, "resources.csv"), toCsv(plan.resources), "utf8"),
    fs.writeFile(path.join(outDir, "labor-lines.csv"), toCsv(plan.laborLines), "utf8"),
    fs.writeFile(path.join(outDir, "travel-odc.csv"), toCsv(plan.travelOdc), "utf8"),
    fs.writeFile(path.join(outDir, "workflow-runs.csv"), toCsv(plan.workflowRuns), "utf8"),
    fs.writeFile(path.join(outDir, "workflow-actions.csv"), toCsv(plan.workflowActions), "utf8"),
    fs.writeFile(path.join(outDir, "resource-employee-map.csv"), toCsv(plan.resourceEmployees), "utf8"),
    fs.writeFile(path.join(outDir, "contract-id-issues.csv"), toCsv(contractIdIssues), "utf8"),
    fs.writeFile(path.join(outDir, "issues.csv"), toCsv(plan.issues), "utf8")
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const [rawText, backfillText, resourceText, projectDescriptionText, ogText] = await Promise.all([
    fs.readFile(args.raw, "utf8"),
    args.backfillRaw ? fs.readFile(args.backfillRaw, "utf8").catch(() => "") : Promise.resolve(""),
    fs.readFile(args.resources, "utf8"),
    args.projectDescriptions ? fs.readFile(args.projectDescriptions, "utf8").catch(() => "") : Promise.resolve(""),
    fs.readFile(args.ogMap, "utf8")
  ]);
  const primaryRows = parseCsv(rawText);
  const backfillRows = backfillText ? parseCsv(backfillText) : [];
  const descriptionRows = projectDescriptionText ? parseCsv(projectDescriptionText) : [];
  const mergedRows = backfillRows.length ? mergePrimaryWithBackfill(primaryRows, backfillRows) : primaryRows;
  const planRows = applyProjectDescriptions(mergedRows, descriptionRows);
  const plan = buildPlan(planRows, parseCsv(resourceText), parseCsv(ogText));
  plan.summary.primaryRawRows = primaryRows.length;
  plan.summary.backfillRawRows = backfillRows.length;
  plan.summary.projectDescriptionRows = descriptionRows.length;
  plan.summary.familyRowsAfterBackfill = planRows.length;
  const outDir = path.resolve(args.out);
  await writeOutputs(plan, outDir);
  console.log(`Raw import plan written to ${outDir}`);
  console.log(JSON.stringify(plan.summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
