#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_RAW =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/Agreements_Export_2026-06-18.csv";
const DEFAULT_BACKFILL_RAW = "";
const DEFAULT_RESOURCES =
  "C:/Users/mddin/OneDrive/Documents/Koniag/IWA/Migration/ResourceDetail_Export_2026-06-18.csv";
const DEFAULT_OUTPUT = "tools/migration/raw-audit-output";
const MIGRATION_CUTOFF = new Date("2026-06-17T00:00:00-04:00");

function parseArgs(argv) {
  const args = {
    raw: DEFAULT_RAW,
    backfillRaw: DEFAULT_BACKFILL_RAW,
    resources: DEFAULT_RESOURCES,
    out: DEFAULT_OUTPUT,
    ogMap: "tools/migration/mappings/og-lob-map.csv",
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
    "  node tools/migration/audit-raw-export.mjs [options]",
    "",
    "Options:",
    "  --raw <path>          Raw Agreements_Export_2026-06-18.csv",
    "  --backfillRaw <path>  Optional older full export for expired family rows",
    "  --resources <path>    Raw ResourceDetail_Export_2026-06-18.csv",
    "  --out <dir>           Output folder for audit/template files",
    "  --ogMap <path>        Optional completed OG mapping CSV to audit against",
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

function parseNumber(value) {
  const text = String(value ?? "").replace(/[,$\s]/g, "");
  if (!text) {
    return 0;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function isFutureRow(row) {
  const endDate = parseDate(get(row, "End Date"));
  return !!endDate && endDate > MIGRATION_CUTOFF;
}

function isMod(row) {
  return /^true$/i.test(get(row, "Mod")) || parseNumber(get(row, "ModNumber")) > 0;
}

function extractAbbr(value) {
  const match = String(value ?? "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : "";
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
  const sorted = [...rows].sort((left, right) => parseNumber(get(left, "ModNumber")) - parseNumber(get(right, "ModNumber")));
  const latest = [...sorted].sort((left, right) => {
    const rightEnd = parseDate(get(right, "End Date"))?.getTime() ?? 0;
    const leftEnd = parseDate(get(left, "End Date"))?.getTime() ?? 0;
    return rightEnd - leftEnd;
  })[0];
  const base = sorted.find((row) => !isMod(row)) ?? latest;
  const parsed = parseSequenceParts(base) ?? parseSequenceParts(latest) ?? sorted.map(parseSequenceParts).find(Boolean);
  const firstAbbr = parsed?.firstAbbr || extractAbbr(get(latest, "EntityB")) || "UNK";
  const secondAbbr = parsed?.secondAbbr || extractAbbr(get(latest, "EntityA")) || "UNK";
  const year = parsed?.year || parseDate(get(latest, "Start Date"))?.getFullYear() || "YYYY";
  const sequenceNumber = parsed?.sequenceNumber || get(base, "ID") || get(latest, "ID");
  return `IWA-${firstAbbr}-${secondAbbr}-${year}-M-${sequenceNumber}`;
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

function frequencyRows(rows, field) {
  return Array.from(groupBy(rows, (row) => get(row, field)).entries())
    .map(([value, group]) => ({
      value,
      count: group.length,
      sampleLegacyIds: group.slice(0, 8).map((row) => get(row, "ID")).join(";")
    }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
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

function resourceMatchesFamily(resource, familyRows) {
  const ids = new Set(familyRows.map((row) => get(row, "ID")));
  const guids = new Set();
  familyRows.forEach((row) => {
    [get(row, "GUID"), get(row, "Parent GUID"), get(row, "Mod GUID")].filter(Boolean).forEach((guid) => guids.add(guid));
  });

  const resourceGuids = [get(resource, "ParGuid"), get(resource, "Parent_GUID"), get(resource, "ModGuid")].filter(Boolean);
  if (resourceGuids.length) {
    return resourceGuids.some((guid) => guids.has(guid));
  }

  return ids.has(get(resource, "ParentID"));
}

function buildAudit(rawRows, resourceRows, ogMapRows, primaryRows = rawRows, backfillRows = []) {
  const futureRows = primaryRows.filter(isFutureRow);
  const futureParentGuids = new Set(futureRows.map((row) => get(row, "Parent GUID")).filter(Boolean));
  const familyRows = rawRows.filter((row) => futureParentGuids.has(get(row, "Parent GUID")));
  const rowsByParent = groupBy(familyRows, (row) => get(row, "Parent GUID"));
  const ogMap = loadOgMap(ogMapRows);
  const mappedOgIssues = [];
  const contractIdIssues = [];

  const familyAudit = Array.from(rowsByParent.entries()).map(([parentGuid, rows]) => {
    const sorted = [...rows].sort((left, right) => parseNumber(get(left, "ModNumber")) - parseNumber(get(right, "ModNumber")));
    const baseRows = sorted.filter((row) => !isMod(row));
    const modRows = sorted.filter(isMod);
    const latest = [...sorted].sort((left, right) => {
      const rightEnd = parseDate(get(right, "End Date"))?.getTime() ?? 0;
      const leftEnd = parseDate(get(left, "End Date"))?.getTime() ?? 0;
      return rightEnd - leftEnd;
    })[0];
    const authNumber = plannedAuthNumber(sorted);
    const rawOperatingGroup = get(latest, "Operating Group");
    const mapped = ogMap.get(rawOperatingGroup);
    if (ogMapRows.length && (!mapped?.targetOperatingGroup || !mapped?.lob)) {
      mappedOgIssues.push({
        parentGuid,
        legacyIds: sorted.map((row) => get(row, "ID")).join(";"),
        rawOperatingGroup,
        issue: "Missing targetOperatingGroup or lob in supplied OG map."
      });
    }

    sorted
      .filter((row) => !get(row, "ProjectId"))
      .forEach((row) => {
        contractIdIssues.push({
          parentGuid,
          plannedAuthNumber: authNumber,
          legacyId: get(row, "ID"),
          sequence: get(row, "Sequence"),
          projectName: get(row, "Project Name"),
          contractNumber: get(row, "Contract Number"),
          taskOrder: get(row, "TaskOrder"),
          taskOrderProjectId: get(row, "Task Order Project ID"),
          issue: "Legacy ProjectId is blank."
        });
      });

    return {
      parentGuid,
      plannedAuthNumber: authNumber,
      rowCount: rows.length,
      futureRowCount: rows.filter(isFutureRow).length,
      expiredBackfillRowCount: rows.filter((row) => !isFutureRow(row)).length,
      baseRowCount: baseRows.length,
      modRowCount: modRows.length,
      maxModNumber: Math.max(0, ...modRows.map((row) => parseNumber(get(row, "ModNumber")))),
      earliestStart: new Date(Math.min(...sorted.map((row) => parseDate(get(row, "Start Date"))?.getTime()).filter(Boolean))).toISOString(),
      latestEnd: new Date(Math.max(...sorted.map((row) => parseDate(get(row, "End Date"))?.getTime()).filter(Boolean))).toISOString(),
      donorEntityRaw: get(latest, "EntityA"),
      donorEntityAbbr: extractAbbr(get(latest, "EntityA")),
      receivingEntityRaw: get(latest, "EntityB"),
      receivingEntityAbbr: extractAbbr(get(latest, "EntityB")),
      rawOperatingGroup,
      mappedOperatingGroup: mapped?.targetOperatingGroup ?? "",
      mappedLob: mapped?.lob ?? "",
      contractType: get(latest, "Contract Type"),
      status: get(latest, "Status"),
      workflowStatus: get(latest, "Workflow Status"),
      legacyIds: sorted.map((row) => get(row, "ID")).join(";")
    };
  }).sort((left, right) => left.plannedAuthNumber.localeCompare(right.plannedAuthNumber));

  const resourceParentIds = new Set(resourceRows.map((row) => get(row, "ParentID")).filter(Boolean));
  const familyLegacyIds = new Set(familyRows.map((row) => get(row, "ID")));
  const resourceRowsInScope = resourceRows.filter((row) =>
    Array.from(rowsByParent.values()).some((family) => resourceMatchesFamily(row, family))
  );

  const ogTemplate = frequencyRows(familyRows, "Operating Group").map((row) => ({
    rawOperatingGroup: row.value,
    targetOperatingGroup: ogMap.get(row.value)?.targetOperatingGroup ?? "",
    lob: ogMap.get(row.value)?.lob ?? "",
    rowCount: row.count,
    sampleLegacyIds: row.sampleLegacyIds
  }));

  const entityTemplate = [
    ...frequencyRows(familyRows, "EntityA").map((row) => ({
      rawEntity: row.value,
      suggestedAbbr: extractAbbr(row.value),
      targetEntity: "",
      targetAbbr: "",
      role: "donor",
      rowCount: row.count,
      sampleLegacyIds: row.sampleLegacyIds
    })),
    ...frequencyRows(familyRows, "EntityB").map((row) => ({
      rawEntity: row.value,
      suggestedAbbr: extractAbbr(row.value),
      targetEntity: "",
      targetAbbr: "",
      role: "receiving",
      rowCount: row.count,
      sampleLegacyIds: row.sampleLegacyIds
    }))
  ].sort((left, right) => left.rawEntity.localeCompare(right.rawEntity) || left.role.localeCompare(right.role));

  return {
    summary: {
      generatedOn: new Date().toISOString(),
      cutoff: MIGRATION_CUTOFF.toISOString(),
      rawRows: rawRows.length,
      primaryRawRows: primaryRows.length,
      backfillRawRows: backfillRows.length,
      futureRows: futureRows.length,
      inScopeFamilies: rowsByParent.size,
      inScopeFamilyRows: familyRows.length,
      expiredBackfillRows: familyRows.length - futureRows.length,
      inScopeResourceRowsByParentId: resourceRowsInScope.length,
      inScopeFamilyRowsWithResourceByParentId: familyRows.filter((row) => resourceParentIds.has(get(row, "ID"))).length,
      uniqueRawOperatingGroups: ogTemplate.length,
      uniqueRawEntities: new Set(entityTemplate.map((row) => row.rawEntity)).size,
      ogMapProvided: ogMapRows.length > 0,
      ogMapIssues: mappedOgIssues.length,
      missingProjectIdRows: contractIdIssues.length,
      missingProjectIdFamilies: new Set(contractIdIssues.map((issue) => issue.parentGuid)).size
    },
    familyAudit,
    ogTemplate,
    entityTemplate,
    mappedOgIssues,
    contractIdIssues,
    statusCounts: frequencyRows(familyRows, "Status"),
    workflowStatusCounts: frequencyRows(familyRows, "Workflow Status"),
    contractTypeCounts: frequencyRows(familyRows, "Contract Type")
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const [rawText, backfillText, resourceText, ogMapText] = await Promise.all([
    fs.readFile(args.raw, "utf8"),
    args.backfillRaw ? fs.readFile(args.backfillRaw, "utf8").catch(() => "") : Promise.resolve(""),
    fs.readFile(args.resources, "utf8"),
    args.ogMap ? fs.readFile(args.ogMap, "utf8") : Promise.resolve("")
  ]);
  const primaryRows = parseCsv(rawText);
  const backfillRows = backfillText ? parseCsv(backfillText) : [];
  const rawRows = backfillRows.length ? mergePrimaryWithBackfill(primaryRows, backfillRows) : primaryRows;
  const resourceRows = parseCsv(resourceText);
  const ogMapRows = ogMapText ? parseCsv(ogMapText) : [];
  const audit = buildAudit(rawRows, resourceRows, ogMapRows, primaryRows, backfillRows);
  const outDir = path.resolve(args.out);

  await fs.mkdir(outDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outDir, "summary.json"), JSON.stringify(audit.summary, null, 2), "utf8"),
    fs.writeFile(path.join(outDir, "family-audit.csv"), toCsv(audit.familyAudit), "utf8"),
    fs.writeFile(path.join(outDir, "og-lob-map-template.csv"), toCsv(audit.ogTemplate), "utf8"),
    fs.writeFile(path.join(outDir, "entity-map-template.csv"), toCsv(audit.entityTemplate), "utf8"),
    fs.writeFile(path.join(outDir, "og-map-issues.csv"), toCsv(audit.mappedOgIssues), "utf8"),
    fs.writeFile(path.join(outDir, "contract-id-issues.csv"), toCsv(audit.contractIdIssues), "utf8"),
    fs.writeFile(path.join(outDir, "status-counts.csv"), toCsv(audit.statusCounts), "utf8"),
    fs.writeFile(path.join(outDir, "workflow-status-counts.csv"), toCsv(audit.workflowStatusCounts), "utf8"),
    fs.writeFile(path.join(outDir, "contract-type-counts.csv"), toCsv(audit.contractTypeCounts), "utf8")
  ]);

  console.log(`Raw export audit written to ${outDir}`);
  console.log(JSON.stringify(audit.summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
