#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_NORMALIZED =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_Normalized.csv";
const DEFAULT_RAW =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_Export_2026-06-18.csv";
const DEFAULT_RESOURCES =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/ResourceDetail_Export_2026-06-18.csv";
const DEFAULT_OUTPUT = "tools/migration/output";

const TARGET_LISTS = {
  authorizations: "IWAAgreements",
  mods: "IWAMods",
  resources: "IWAResources",
  laborLines: "IWALaborLine",
  travelOdc: "IWATravelODC",
  workflowRuns: "IWAWorkflowRuns",
  workflowActions: "IWAWorkflowActions"
};

const WORKFLOW_STATUS_MAP = {
  Completed: { runStatus: "completed", outcome: "approved", currentStepKey: "cfo", pendingRole: "" },
  "Rejected by AR": { runStatus: "rejected", outcome: "rejected", currentStepKey: "cfo", pendingRole: "" },
  "Waiting for OG Manager Approval": { runStatus: "active", outcome: "none", currentStepKey: "ogPresident", pendingRole: "ogPresident" },
  "Sent to AR  to process": { runStatus: "active", outcome: "none", currentStepKey: "cfo", pendingRole: "cfo" },
  Processing: { runStatus: "active", outcome: "none", currentStepKey: "hr", pendingRole: "hr" },
  Submitted: { runStatus: "active", outcome: "none", currentStepKey: "pm", pendingRole: "pm" },
  "Waiting for Entity A & B Signature": { runStatus: "active", outcome: "none", currentStepKey: "pm", pendingRole: "pm" }
};

const WORKFLOW_ROLE_EMAIL_FIELD = {
  pm: "ProjectManager",
  hr: "HR_Manager",
  ogPresident: "OG_President",
  cfo: ""
};

function parseArgs(argv) {
  const args = {
    normalized: DEFAULT_NORMALIZED,
    raw: DEFAULT_RAW,
    resources: DEFAULT_RESOURCES,
    out: DEFAULT_OUTPUT,
    execute: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--execute") {
      args.execute = true;
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
    "  node tools/migration/import-iwa-migration.mjs [options]",
    "",
    "Options:",
    "  --normalized <path>   Curated Agreements_Normalized.csv",
    "  --raw <path>          Raw Agreements_Export_2026-06-18.csv",
    "  --resources <path>    Raw ResourceDetail_Export_2026-06-18.csv",
    "  --out <dir>           Output folder for plan/report files",
    "  --execute             Reserved for live SPO writes after dry-run review",
    "  --help                Show this help",
    "",
    "Default mode is dry-run planning only. It does not write to SharePoint."
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

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows
    .slice(1)
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
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  });
  return `${lines.join("\n")}\n`;
}

function get(row, field) {
  return (row?.[field] ?? "").trim();
}

function isTrue(value) {
  return /^(true|yes|1)$/i.test(String(value ?? "").trim());
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) {
    return "";
  }
  return date.toISOString();
}

function parseMoney(value) {
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  if (!text) {
    return 0;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function parseNumber(value) {
  const text = String(value ?? "").replace(/[,\s]/g, "");
  if (!text) {
    return 0;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function cleanEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function displayNameToKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeContractType(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "ffp") {
    return "ffp";
  }
  return "tm";
}

function plannedAuthNumber(row) {
  const value = get(row, "Auth Number");
  if (/^IWA-[A-Z0-9]+-[A-Z0-9]+-\d{4}-M-[A-Z0-9-]+$/i.test(value)) {
    return value;
  }

  const donor = get(row, "Entity A - Donor Abbr") || "UNK";
  const receiving = get(row, "EntityB Rec Abbr") || "UNK";
  const year = String(parseDate(get(row, "Start Date"))?.getFullYear() ?? new Date().getFullYear());
  const legacyId = get(row, "ID") || "UNKNOWN";
  return `IWA-${donor}-${receiving}-${year}-M-${legacyId}`;
}

function rawIsMod(row) {
  return isTrue(get(row, "Mod")) || parseNumber(get(row, "ModNumber")) > 0;
}

function sortRawFamilyRows(rows) {
  return [...rows].sort((left, right) => {
    const leftMod = parseNumber(get(left, "ModNumber"));
    const rightMod = parseNumber(get(right, "ModNumber"));
    if (leftMod !== rightMod) {
      return leftMod - rightMod;
    }
    return parseNumber(get(left, "ID")) - parseNumber(get(right, "ID"));
  });
}

function pickLatestNormalized(rows, rawById) {
  return [...rows].sort((left, right) => {
    const leftRaw = rawById.get(get(left, "ID"));
    const rightRaw = rawById.get(get(right, "ID"));
    const leftMod = parseNumber(get(leftRaw, "ModNumber"));
    const rightMod = parseNumber(get(rightRaw, "ModNumber"));
    if (leftMod !== rightMod) {
      return rightMod - leftMod;
    }
    const leftModified = parseDate(get(left, "Modified"))?.getTime() ?? 0;
    const rightModified = parseDate(get(right, "Modified"))?.getTime() ?? 0;
    return rightModified - leftModified;
  })[0];
}

function chooseStatus(rows) {
  const ordered = ["underReview", "submitted", "rejected", "approved", "closed", "canceled"];
  const statuses = new Set(rows.map((row) => get(row, "Auth Status")).filter(Boolean));
  for (const status of ordered) {
    if (statuses.has(status)) {
      return status;
    }
  }
  return get(rows[0], "Auth Status") || "underReview";
}

function chooseWorkflowStatus(rows) {
  const activePriority = [
    "Sent to AR  to process",
    "Waiting for OG Manager Approval",
    "Processing",
    "Submitted",
    "Waiting for Entity A & B Signature"
  ];
  const statuses = new Set(rows.map((row) => get(row, "Workflow Status")).filter(Boolean));
  for (const status of activePriority) {
    if (statuses.has(status)) {
      return status;
    }
  }
  if (statuses.has("Rejected by AR")) {
    return "Rejected by AR";
  }
  return "Completed";
}

function minDate(dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) {
    return undefined;
  }
  return new Date(Math.min(...valid.map((date) => date.getTime())));
}

function maxDate(dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) {
    return undefined;
  }
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function buildIndexes(normalizedRows, rawRows, resourceRows) {
  const rawById = new Map();
  const rawByGuid = new Map();
  const rawByParentGuid = new Map();
  const normalizedByAuth = new Map();

  rawRows.forEach((row) => {
    rawById.set(get(row, "ID"), row);
    [get(row, "GUID"), get(row, "Mod GUID")].filter(Boolean).forEach((guid) => rawByGuid.set(guid, row));
    const parentGuid = get(row, "Parent GUID");
    if (parentGuid) {
      if (!rawByParentGuid.has(parentGuid)) {
        rawByParentGuid.set(parentGuid, []);
      }
      rawByParentGuid.get(parentGuid).push(row);
    }
  });

  normalizedRows.forEach((row) => {
    const authNumber = plannedAuthNumber(row);
    if (!normalizedByAuth.has(authNumber)) {
      normalizedByAuth.set(authNumber, []);
    }
    normalizedByAuth.get(authNumber).push(row);
  });

  const resourcesByParentId = new Map();
  resourceRows.forEach((row) => {
    const parentId = get(row, "ParentID");
    if (!resourcesByParentId.has(parentId)) {
      resourcesByParentId.set(parentId, []);
    }
    resourcesByParentId.get(parentId).push(row);
  });

  return {
    normalizedByAuth,
    rawByGuid,
    rawById,
    rawByParentGuid,
    resourcesByParentId
  };
}

function resourceRowsForFamily(familyRows, resourceRows, rawByGuid) {
  const familyIds = new Set(familyRows.map((row) => get(row, "ID")));
  const familyGuids = new Set();
  familyRows.forEach((row) => {
    [get(row, "GUID"), get(row, "Parent GUID"), get(row, "Mod GUID")]
      .filter(Boolean)
      .forEach((guid) => familyGuids.add(guid));
  });

  return resourceRows.filter((resource) => {
    if (familyIds.has(get(resource, "ParentID"))) {
      return true;
    }
    return [get(resource, "ParGuid"), get(resource, "Parent_GUID"), get(resource, "ModGuid")]
      .some((guid) => guid && familyGuids.has(guid) && rawByGuid.has(guid));
  });
}

function associateResourceToRaw(resource, familyRows, rawById, rawByGuid) {
  const byParentId = rawById.get(get(resource, "ParentID"));
  if (byParentId) {
    return byParentId;
  }
  const modGuid = get(resource, "ModGuid");
  if (modGuid && rawByGuid.has(modGuid)) {
    return rawByGuid.get(modGuid);
  }
  const parGuid = get(resource, "ParGuid");
  if (parGuid && rawByGuid.has(parGuid)) {
    return rawByGuid.get(parGuid);
  }
  return familyRows.find((row) => !rawIsMod(row)) ?? familyRows[0];
}

function buildAuthorizationPlan(authNumber, normalizedGroup, indexes, resourceRows, issues) {
  const representativeRaw = indexes.rawById.get(get(normalizedGroup[0], "ID"));
  if (!representativeRaw) {
    issues.push({
      issueType: "missing_raw_row",
      severity: "error",
      authNumber,
      legacyId: get(normalizedGroup[0], "ID"),
      message: "Normalized row could not be matched to the raw export by ID."
    });
    return undefined;
  }

  const parentGuid = get(representativeRaw, "Parent GUID");
  const rawFamily = sortRawFamilyRows(indexes.rawByParentGuid.get(parentGuid) ?? [representativeRaw]);
  const curated = pickLatestNormalized(normalizedGroup, indexes.rawById);
  const status = chooseStatus(normalizedGroup);
  const workflowStatus = chooseWorkflowStatus(normalizedGroup);
  const familyStart = minDate([
    ...rawFamily.map((row) => parseDate(get(row, "Start Date"))),
    ...normalizedGroup.map((row) => parseDate(get(row, "Start Date")))
  ]);
  const familyEnd = maxDate([
    ...rawFamily.map((row) => parseDate(get(row, "End Date"))),
    ...normalizedGroup.map((row) => parseDate(get(row, "End Date")))
  ]);
  const familyResources = resourceRowsForFamily(rawFamily, resourceRows, indexes.rawByGuid);
  const modRows = rawFamily.filter(rawIsMod);
  const baseRows = rawFamily.filter((row) => !rawIsMod(row));
  const sourceLegacyIds = rawFamily.map((row) => get(row, "ID")).join(";");
  const normalizedLegacyIds = normalizedGroup.map((row) => get(row, "ID")).join(";");
  const baseLaborAmount = parseMoney(get(curated, "Amount Authorized"));
  const baseTravelAmount = parseMoney(get(curated, "ODC Amount"));
  const baseGrandTotal = parseMoney(get(curated, "GrandTotal_Amount")) || baseLaborAmount + baseTravelAmount;
  const approvedAmounts = status === "approved"
    ? { labor: baseLaborAmount, travel: baseTravelAmount, grand: baseGrandTotal }
    : { labor: 0, travel: 0, grand: 0 };

  if (!get(curated, "Operating Group")) {
    issues.push({
      issueType: "blank_operating_group",
      severity: "warning",
      authNumber,
      legacyId: get(curated, "ID"),
      message: "Operating Group is blank in the normalized file."
    });
  }

  if (rawFamily.length > normalizedGroup.length) {
    issues.push({
      issueType: "family_backfill",
      severity: "info",
      authNumber,
      parentGuid,
      legacyId: sourceLegacyIds,
      message: `Raw family has ${rawFamily.length} rows; normalized file has ${normalizedGroup.length}. Expired related rows will be used for family envelope/mod backfill.`
    });
  }

  return {
    authorization: {
      migrationKey: authNumber,
      legacyParentGuid: parentGuid,
      legacySourceIds: sourceLegacyIds,
      normalizedLegacyIds,
      Title: authNumber,
      authorizationStatus: status,
      pmEmail: cleanEmail(get(curated, "ProjectManager")),
      donorEntity: get(curated, "EntityA - Donor"),
      donorEntityAbbr: get(curated, "Entity A - Donor Abbr"),
      donorGmEmail: cleanEmail(get(curated, "EntityAManager - Donor GM")),
      receivingEntity: get(curated, "EntityB - Receiving"),
      receivingEntityAbbr: get(curated, "EntityB Rec Abbr"),
      receivingGmEmail: cleanEmail(get(curated, "EntityBManager - Rec GM")),
      og: get(curated, "Operating Group"),
      lob: get(curated, "LOB"),
      contractName: get(curated, "Contract Name"),
      contractId: get(curated, "Contract ID"),
      iwaJamisProjectId: get(curated, "IWA JAMIS Project ID") || get(curated, "IWA Project ID"),
      customerContractCode: get(curated, "Customer Contract Code"),
      invoice: get(curated, "Invoice"),
      contractType: normalizeContractType(get(curated, "Contract Type")),
      periodStart: toIsoDate(familyStart),
      periodEnd: toIsoDate(familyEnd),
      scopeOfWork: get(curated, "Scope of work"),
      justification: get(curated, "Justification"),
      notes: get(curated, "Notes"),
      baseLaborAmount,
      baseTravelAmount,
      baseGrandTotal,
      approvedLaborAmount: approvedAmounts.labor,
      approvedTravelAmount: approvedAmounts.travel,
      approvedGrandTotal: approvedAmounts.grand,
      modCount: Math.max(parseNumber(get(curated, "Mod Count")), ...modRows.map((row) => parseNumber(get(row, "ModNumber"))), 0),
      approvedOn: status === "approved" ? toIsoDate(get(curated, "Approved On") || get(curated, "Modified")) : "",
      rejectedOn: status === "rejected" ? toIsoDate(get(curated, "Rejected On") || get(curated, "Modified")) : "",
      canceledOn: status === "canceled" ? toIsoDate(get(curated, "Canceled On") || get(curated, "Modified")) : "",
      closedOn: status === "closed" ? toIsoDate(get(curated, "Closed On") || get(curated, "Modified")) : "",
      created: toIsoDate(get(curated, "Created")),
      createdByEmail: cleanEmail(get(curated, "Created By")),
      modified: toIsoDate(get(curated, "Modified")),
      modifiedByEmail: cleanEmail(get(curated, "Modified By")),
      rawFamilyRowCount: rawFamily.length,
      normalizedRowCount: normalizedGroup.length,
      resourceRowCount: familyResources.length,
      baseRowCount: baseRows.length,
      modRowCount: modRows.length,
      workflowStatus
    },
    rawFamily,
    familyResources,
    curated,
    modRows,
    status,
    workflowStatus
  };
}

function buildModPlans(authPlan) {
  return authPlan.modRows.map((row) => {
    const modNumber = parseNumber(get(row, "ModNumber"));
    const isApproved = get(row, "Approval_Status") === "Approved" || isTrue(get(row, "SignedA")) || isTrue(get(row, "SignedB"));
    const isRejected = /rejected/i.test(get(row, "Status")) || /rejected/i.test(get(row, "Workflow Status")) || /rejected/i.test(get(row, "Approval_Status"));
    const laborAmount = parseMoney(get(row, "Amount Authorized"));
    const travelAmount = parseMoney(get(row, "ODC Amount")) || parseMoney(get(row, "GrandODC"));
    const grandTotal = parseMoney(get(row, "GrandTotal_Amount")) || laborAmount + travelAmount;
    return {
      migrationKey: `${authPlan.authorization.migrationKey}:MOD:${modNumber || get(row, "ID")}`,
      authorizationMigrationKey: authPlan.authorization.migrationKey,
      legacyId: get(row, "ID"),
      legacyGuid: get(row, "GUID"),
      legacyParentGuid: get(row, "Parent GUID"),
      legacyModGuid: get(row, "Mod GUID"),
      Title: `${authPlan.authorization.Title}-MOD-${String(modNumber || 0).padStart(2, "0")}`,
      modNumber,
      modStatus: isRejected ? "rejected" : isApproved ? "approved" : "underReview",
      reason: "Migrated legacy modification",
      changeSummary: get(row, "Sequence"),
      notes: "",
      laborAmount,
      travelAmount,
      grandTotal,
      approvedOn: isApproved ? toIsoDate(get(row, "Modified")) : "",
      rejectedOn: isRejected ? toIsoDate(get(row, "Modified")) : "",
      created: toIsoDate(get(row, "Created")),
      createdByEmail: cleanEmail(get(row, "Created By")),
      modified: toIsoDate(get(row, "Modified")),
      modifiedByEmail: cleanEmail(get(row, "Modified By"))
    };
  });
}

function buildResourceAndLaborPlans(authPlan, indexes, issues) {
  const resourcePlans = [];
  const laborPlans = [];
  const seenResourceKeys = new Set();

  authPlan.familyResources.forEach((resource, index) => {
    const raw = associateResourceToRaw(resource, authPlan.rawFamily, indexes.rawById, indexes.rawByGuid);
    const isModLine = rawIsMod(raw);
    const modNumber = isModLine ? parseNumber(get(raw, "ModNumber")) : 0;
    const lineScope = isModLine ? "mod" : "base";
    const employeeName = get(resource, "Employee");
    const employeeKey = displayNameToKey(employeeName);
    const lineNumber = index + 1;
    const resourceKey = [
      authPlan.authorization.migrationKey,
      lineScope,
      modNumber,
      get(resource, "ID") || lineNumber,
      employeeKey
    ].join(":");

    if (seenResourceKeys.has(resourceKey)) {
      return;
    }
    seenResourceKeys.add(resourceKey);

    if (!employeeName) {
      issues.push({
        issueType: "missing_resource_employee",
        severity: "warning",
        authNumber: authPlan.authorization.migrationKey,
        legacyId: get(resource, "ParentID"),
        message: "Resource row has no employee display name."
      });
    } else {
      issues.push({
        issueType: "resource_employee_needs_resolution",
        severity: "info",
        authNumber: authPlan.authorization.migrationKey,
        legacyId: get(resource, "ParentID"),
        message: `Resource employee '${employeeName}' must be resolved to a SharePoint user before live import.`
      });
    }

    const totalAmount = parseMoney(get(resource, "Total")) || parseMoney(get(resource, "Original Total"));
    const standardRate = parseMoney(get(resource, "Bill Rate")) || parseMoney(get(resource, "Original Cost"));
    const standardHours = parseNumber(get(resource, "Units Quantity")) || parseNumber(get(resource, "Total Hours")) || parseNumber(get(resource, "Original"));
    const pricingType = normalizeContractType(get(resource, "Contract_Type") || authPlan.authorization.contractType);

    resourcePlans.push({
      migrationKey: resourceKey,
      authorizationMigrationKey: authPlan.authorization.migrationKey,
      modNumber,
      legacyResourceId: get(resource, "ID"),
      legacyParentId: get(resource, "ParentID"),
      lineScope,
      lineNumber,
      displayOrder: lineNumber,
      Title: employeeName || `Resource ${lineNumber}`,
      employeeDisplayName: employeeName,
      employeeEmail: "",
      state: get(resource, "Work State"),
      laborCategory: get(resource, "Role_Position"),
      comments: ""
    });

    laborPlans.push({
      migrationKey: `${resourceKey}:LABOR`,
      authorizationMigrationKey: authPlan.authorization.migrationKey,
      resourceMigrationKey: resourceKey,
      modNumber,
      legacyResourceId: get(resource, "ID"),
      lineScope,
      lineNumber,
      displayOrder: lineNumber,
      Title: `${employeeName || `Labor ${lineNumber}`} Labor`,
      pricingType,
      jobId: get(resource, "JobID"),
      annualSalary: 0,
      standardRate: pricingType === "tm" ? standardRate : 0,
      overtimeRate: 0,
      standardHours: pricingType === "tm" ? standardHours : 0,
      overtimeHours: 0,
      standardAmount: pricingType === "tm" ? totalAmount : 0,
      overtimeAmount: 0,
      chargingPeriod: pricingType === "ffp" ? "monthly" : "monthly",
      periodQty: pricingType === "ffp" ? 1 : 1,
      lumpSumAmount: pricingType === "ffp" ? totalAmount : 0,
      totalAmount,
      comments: ""
    });
  });

  return { laborPlans, resourcePlans };
}

function buildTravelPlans(authPlan) {
  const plans = [];
  authPlan.rawFamily.forEach((row) => {
    const amount = parseMoney(get(row, "ODC Amount")) || parseMoney(get(row, "GrandODC"));
    const jobId = get(row, "ODC Job_ID");
    if (!amount && !jobId && !isTrue(get(row, "Travel"))) {
      return;
    }
    const isModLine = rawIsMod(row);
    const modNumber = isModLine ? parseNumber(get(row, "ModNumber")) : 0;
    plans.push({
      migrationKey: `${authPlan.authorization.migrationKey}:TRAVEL:${get(row, "ID")}`,
      authorizationMigrationKey: authPlan.authorization.migrationKey,
      modNumber,
      legacyId: get(row, "ID"),
      lineScope: isModLine ? "mod" : "base",
      lineNumber: plans.length + 1,
      displayOrder: plans.length + 1,
      Title: get(row, "ODC Job_Name") || "Migrated Travel/ODC",
      lineType: isTrue(get(row, "Travel")) ? "travel" : "odc",
      jobId,
      description: get(row, "ODC Job_Name") || "Migrated legacy ODC amount",
      amount,
      comments: ""
    });
  });
  return plans;
}

function pendingApproverEmail(authPlan, workflowStatus) {
  const mapping = WORKFLOW_STATUS_MAP[workflowStatus] ?? WORKFLOW_STATUS_MAP.Completed;
  const sourceField = WORKFLOW_ROLE_EMAIL_FIELD[mapping.pendingRole] ?? "";
  return sourceField ? cleanEmail(get(authPlan.curated, sourceField)) : "";
}

function buildWorkflowPlans(authPlan) {
  const auth = authPlan.authorization;
  const workflowStatus = authPlan.workflowStatus;
  const mapping = WORKFLOW_STATUS_MAP[workflowStatus] ?? WORKFLOW_STATUS_MAP.Completed;
  const runStatus = auth.authorizationStatus === "approved"
    ? "completed"
    : auth.authorizationStatus === "rejected"
      ? "rejected"
      : mapping.runStatus;
  const outcome = auth.authorizationStatus === "approved"
    ? "approved"
    : auth.authorizationStatus === "rejected"
      ? "rejected"
      : mapping.outcome;
  const currentStepKey = runStatus === "completed"
    ? "cfo"
    : mapping.currentStepKey;
  const pendingRole = runStatus === "active" ? mapping.pendingRole : "";
  const actionDate = auth.modified || auth.created || new Date().toISOString();

  const run = {
    migrationKey: `${auth.migrationKey}:RUN:1`,
    authorizationMigrationKey: auth.migrationKey,
    modNumber: 0,
    Title: `${auth.Title}-RUN-1`,
    runNumber: 1,
    runType: "base",
    runStatus,
    hasDecision: runStatus !== "active",
    outcome,
    currentStepKey,
    pendingRole,
    pendingApproverEmail: pendingApproverEmail(authPlan, workflowStatus),
    stepAssignedDate: runStatus === "active" ? actionDate : "",
    completedOn: runStatus === "active" ? "" : actionDate,
    skipPmStep: false,
    restartReason: "",
    restartComment: "",
    hrEmail: cleanEmail(get(authPlan.curated, "HR_Manager")),
    ogPresidentEmail: cleanEmail(get(authPlan.curated, "OG_President")),
    cfoEmail: "",
    approvedSnapshotJson: ""
  };

  const actions = [{
    migrationKey: `${run.migrationKey}:SUBMIT`,
    authorizationMigrationKey: auth.migrationKey,
    workflowRunMigrationKey: run.migrationKey,
    modNumber: 0,
    Title: `${auth.Title}-Run1-submitted`,
    stepKey: "submit",
    actionType: "submitted",
    actionByEmail: auth.createdByEmail,
    actionDate: auth.created || actionDate,
    role: "requestor",
    comments: "Migrated legacy IWA submission.",
    fromStepKey: "submit",
    toStepKey: currentStepKey,
    wasSkipped: false,
    skipReason: "",
    changeSummary: "",
    changePayloadJson: ""
  }];

  if (runStatus === "completed") {
    actions.push({
      migrationKey: `${run.migrationKey}:APPROVED`,
      authorizationMigrationKey: auth.migrationKey,
      workflowRunMigrationKey: run.migrationKey,
      modNumber: 0,
      Title: `${auth.Title}-Run1-cfo-approved`,
      stepKey: "cfo",
      actionType: "approved",
      actionByEmail: cleanEmail(get(authPlan.curated, "OG_President")) || auth.modifiedByEmail,
      actionDate,
      role: "cfo",
      comments: "Synthetic migrated approval action. Legacy Entity A/B signatures were intentionally not recreated.",
      fromStepKey: "cfo",
      toStepKey: "cfo",
      wasSkipped: false,
      skipReason: "",
      changeSummary: "",
      changePayloadJson: ""
    });
  }

  if (runStatus === "rejected") {
    actions.push({
      migrationKey: `${run.migrationKey}:REJECTED`,
      authorizationMigrationKey: auth.migrationKey,
      workflowRunMigrationKey: run.migrationKey,
      modNumber: 0,
      Title: `${auth.Title}-Run1-${currentStepKey}-rejected`,
      stepKey: currentStepKey,
      actionType: "rejected",
      actionByEmail: auth.modifiedByEmail,
      actionDate,
      role: pendingRole || "admin",
      comments: "Migrated legacy rejected status.",
      fromStepKey: currentStepKey,
      toStepKey: "submitter",
      wasSkipped: false,
      skipReason: "",
      changeSummary: "",
      changePayloadJson: ""
    });
  }

  return { actions, run };
}

function buildPlan(normalizedRows, rawRows, resourceRows) {
  const issues = [];
  const indexes = buildIndexes(normalizedRows, rawRows, resourceRows);
  const authorizations = [];
  const mods = [];
  const resources = [];
  const laborLines = [];
  const travelOdc = [];
  const workflowRuns = [];
  const workflowActions = [];
  const resourceEmployeeMap = new Map();

  for (const [authNumber, normalizedGroup] of indexes.normalizedByAuth.entries()) {
    normalizedGroup
      .filter((row) => plannedAuthNumber(row) !== get(row, "Auth Number"))
      .forEach((row) => {
        issues.push({
          issueType: "invalid_auth_number",
          severity: "warning",
          authNumber,
          legacyId: get(row, "ID"),
          message: `Normalized Auth Number '${get(row, "Auth Number")}' is invalid. Dry-run used fallback '${authNumber}'.`
        });
      });

    const authPlan = buildAuthorizationPlan(authNumber, normalizedGroup, indexes, resourceRows, issues);
    if (!authPlan) {
      continue;
    }

    authorizations.push(authPlan.authorization);
    mods.push(...buildModPlans(authPlan));
    const linePlans = buildResourceAndLaborPlans(authPlan, indexes, issues);
    resources.push(...linePlans.resourcePlans);
    laborLines.push(...linePlans.laborPlans);
    linePlans.resourcePlans.forEach((resource) => {
      const key = displayNameToKey(resource.employeeDisplayName);
      if (!key) {
        return;
      }
      if (!resourceEmployeeMap.has(key)) {
        resourceEmployeeMap.set(key, {
          employeeDisplayName: resource.employeeDisplayName,
          employeeEmail: "",
          occurrenceCount: 0,
          sampleAuthNumbers: new Set()
        });
      }
      const entry = resourceEmployeeMap.get(key);
      entry.occurrenceCount += 1;
      entry.sampleAuthNumbers.add(resource.authorizationMigrationKey);
    });
    travelOdc.push(...buildTravelPlans(authPlan));
    const workflowPlans = buildWorkflowPlans(authPlan);
    workflowRuns.push(workflowPlans.run);
    workflowActions.push(...workflowPlans.actions);
  }

  const multiRowAuthNumbers = normalizedRows
    .reduce((map, row) => {
      const key = plannedAuthNumber(row);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map());
  const resourceEmployees = Array.from(resourceEmployeeMap.values())
    .map((entry) => ({
      employeeDisplayName: entry.employeeDisplayName,
      employeeEmail: entry.employeeEmail,
      occurrenceCount: entry.occurrenceCount,
      sampleAuthNumbers: Array.from(entry.sampleAuthNumbers).slice(0, 5).join(";")
    }))
    .sort((left, right) => left.employeeDisplayName.localeCompare(right.employeeDisplayName));

  const summary = {
    generatedOn: new Date().toISOString(),
    normalizedRows: normalizedRows.length,
    rawRows: rawRows.length,
    resourceRows: resourceRows.length,
    targetAuthorizations: authorizations.length,
    targetMods: mods.length,
    targetResources: resources.length,
    targetLaborLines: laborLines.length,
    targetTravelOdc: travelOdc.length,
    targetWorkflowRuns: workflowRuns.length,
    targetWorkflowActions: workflowActions.length,
    multiRowAuthFamilies: Array.from(multiRowAuthNumbers.values()).filter((count) => count > 1).length,
    uniqueResourceEmployeesNeedingMapping: resourceEmployees.length,
    issueCounts: issues.reduce((counts, issue) => {
      counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
      return counts;
    }, {}),
    lists: TARGET_LISTS
  };

  return {
    authorizations,
    laborLines,
    mods,
    resources,
    resourceEmployees,
    summary,
    travelOdc,
    workflowActions,
    workflowRuns,
    issues
  };
}

async function writeOutputs(plan, outDir) {
  await fs.mkdir(outDir, { recursive: true });

  const files = [
    ["summary.json", JSON.stringify(plan.summary, null, 2)],
    ["migration-plan.json", JSON.stringify(plan, null, 2)],
    ["authorizations.csv", toCsv(plan.authorizations)],
    ["mods.csv", toCsv(plan.mods)],
    ["resources.csv", toCsv(plan.resources)],
    ["resource-employee-map.csv", toCsv(plan.resourceEmployees)],
    ["labor-lines.csv", toCsv(plan.laborLines)],
    ["travel-odc.csv", toCsv(plan.travelOdc)],
    ["workflow-runs.csv", toCsv(plan.workflowRuns)],
    ["workflow-actions.csv", toCsv(plan.workflowActions)],
    ["issues.csv", toCsv(plan.issues)]
  ];

  await Promise.all(files.map(([fileName, content]) => fs.writeFile(path.join(outDir, fileName), content, "utf8")));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.execute) {
    throw new Error("--execute is intentionally not enabled yet. Review the dry-run plan first, then wire live SharePoint writes in the next pass.");
  }

  const [normalizedText, rawText, resourceText] = await Promise.all([
    fs.readFile(args.normalized, "utf8"),
    fs.readFile(args.raw, "utf8"),
    fs.readFile(args.resources, "utf8")
  ]);

  const normalizedRows = parseCsv(normalizedText);
  const rawRows = parseCsv(rawText);
  const resourceRows = parseCsv(resourceText);
  const plan = buildPlan(normalizedRows, rawRows, resourceRows);
  const outDir = path.resolve(args.out);

  await writeOutputs(plan, outDir);

  console.log(`Migration dry-run plan written to ${outDir}`);
  console.log(JSON.stringify(plan.summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
