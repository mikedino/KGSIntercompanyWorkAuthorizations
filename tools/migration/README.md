# IWA Migration Tool

This folder contains the one-time migration helper for importing legacy IWAs into the new SharePoint list schema.

The current raw-first dry-run planner reads:

- `Agreements_Export_2026-06-02.csv` as the header and lineage/family source.
- `Agreements_Export_2026-06-01.csv` as optional expired-family backfill when the 06-02 export only contains future rows.
- `Agreements_ProjectDescription.csv` as the preferred plain-text ProjectDescription source.
- `ResourceDetail_Export_2026-06-02.csv` as the resource/labor source, with employee emails in the `Employee` column.
- `mappings/og-lob-map.csv` for Operating Group and LOB cleanup.

It writes a proposed import plan to `tools/migration/raw-plan-output/` and does not write to SharePoint.

## Run

Raw export audit:

```powershell
npm run migration:audit-raw
```

This writes `tools/migration/raw-audit-output/`, including:

- `family-audit.csv`: one planned migrated authorization per legacy family.
- `og-lob-map-template.csv`: raw Operating Group values that need target OG and LOB mapping.
- `entity-map-template.csv`: raw Entity A/B values and suggested abbreviations.
- `status-counts.csv`, `workflow-status-counts.csv`, `contract-type-counts.csv`: source distributions.

After filling `og-lob-map-template.csv`, rerun with:

```powershell
node tools/migration/audit-raw-export.mjs --ogMap "C:\path\og-lob-map-template.csv"
```

Dry-run import planner:

```powershell
npm run migration:plan-raw
```

Optional paths:

```powershell
node tools/migration/plan-raw-import.mjs `
  --raw "C:\path\Agreements_Export_2026-06-02.csv" `
  --backfillRaw "C:\path\Agreements_Export_2026-06-01.csv" `
  --resources "C:\path\ResourceDetail_Export_2026-06-02.csv" `
  --projectDescriptions "C:\path\Agreements_ProjectDescription.csv" `
  --ogMap "tools\migration\mappings\og-lob-map.csv" `
  --laborJobMap "tools\migration\mappings\Labor_Missing_JobID_map.csv" `
  --travelJobMap "tools\migration\mappings\Travel_ODC_Missing_JobID_map.csv" `
  --out "tools\migration\raw-plan-output"
```

## Outputs

- `summary.json`: counts and high-level health.
- `raw-migration-plan.json`: full structured plan.
- `authorizations.csv`: planned `IWAAgreements` rows.
- `mods.csv`: planned `IWAMods` rows.
- `resources.csv`: planned `IWAResources` rows.
- `resource-employee-map.csv`: unique resource employees/emails found in the resource export.
- `contract-id-issues.csv`: rows/families where legacy `ProjectId` is blank.
- `labor-lines.csv`: planned `IWALaborLine` rows.
- `travel-odc.csv`: planned `IWATravelODC` rows.
- `workflow-runs.csv`: planned `IWAWorkflowRuns` rows.
- `workflow-actions.csv`: planned `IWAWorkflowActions` rows.
- `issues.csv`: warnings and decisions to review before live import.

## Current Decisions

- Target authorization number is generated from the legacy `Sequence`, for example `IWA-KAD-KPS-2023-M-1247`.
- Raw `Parent GUID` is the family key.
- If a migrated future record belongs to a raw family with expired base/mod rows, the full raw family is used for period envelope and mod backfill.
- `periodStart` is the earliest start across the raw family.
- `periodEnd` is the latest end across the raw family.
- `periodStart` and `periodEnd` are emitted as `YYYY-MM-DD` date-only values to avoid UTC day-shift during SharePoint writes.
- Rich text `ProjectDescription` is stripped to plain text.
- `Agreements_ProjectDescription.csv` is preferred when present because it already contains plain-text descriptions.
- Base-row `ProjectDescription` maps to Authorization Scope of Work and Justification.
- Mod-row `ProjectDescription` maps to Mod Reason.
- Legacy `ProjectId` maps to target `contractId`; blanks are reported in `contract-id-issues.csv`.
- Header approved totals are calculated as base plus approved mods.
- Resource `Work State` abbreviations are expanded to the app's `State Name (XX)` format.
- Authorization and Mod Notes are generated one-to-one as: `Migrated from Legacy IWA list. Legacy Sequence: <Sequence>, Legacy ID: <ID>`.
- Missing/unresolved users default to `SharePointApps@koniag-gs.com`.
- Missing/unresolved HR approvers default to `bmack@koniag-gs.com`.
- CFO approvers default to `jmorris@koniag-gs.com`.
- Invoice values come only from `Task Order Project ID`; nonblank values outside the `######-####` pattern are reported in `issues.csv`.
- Blank raw Labor and Travel/ODC Job IDs are filled from their mapping CSVs by stable line `migrationKey` before missing-Job-ID warnings are generated. Nonblank raw Job IDs are never overwritten.
- Blank authorization `IWA Project ID` values are filled from the Labor mapping CSV's `JAMIS Project ID` column when all populated values for that authorization agree. Nonblank raw values are never overwritten, and conflicting map values are reported in `issues.csv`.
- Migrated workflow actions use `submit > PM > HR > OGP > CFO` for T&M rows and `submit > PM > OGP > CFO` for FFP rows. `OG_President` supplies the OGP actor and `OG_Approval` is preserved in the OGP action comments.
- Legacy Entity A/B signatures are not recreated as workflow steps.
- Existing PDF URLs and export records are intentionally skipped.
- Resource employee rows use the email now exported in the `Employee` column; non-email values are reported in `issues.csv`.
- When a resource employee cannot be resolved in SharePoint, the importer uses the fallback account and appends the legacy employee email to the resource comments for audit.

## Next Pass

After the dry-run plan is reviewed, the live importer should:

1. Resolve header people by email using SharePoint `ensureUser`.
2. Resolve resource employees by email using SharePoint `ensureUser`.
3. Create list items in dependency order.
4. Store created SharePoint IDs in a local mapping file.
5. Patch lookup fields that depend on newly-created IDs.
6. Use the separate admin migration action to test stamping `Author`, `Editor`, `Created`, and `Modified` with `ValidateUpdateListItem` for one authorization key at a time before deciding whether to run it broadly.
