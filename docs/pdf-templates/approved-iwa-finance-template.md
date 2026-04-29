# Approved IWA Finance PDF Template

This template is a proposed replacement for the old IWA PDF export. The goal is to make the approved IWA usable for finance transaction entry first, while still preserving approval context and the supporting detail needed for audit/review.

## Template Files

- `approved-iwa-finance-template.html` is the print-ready visual template.
- This note maps each section to data we already have in the IWA app.

## Design Intent

- Put the finance entry facts at the top: donor, recipient, contract, invoice, period, contract type, PM, OG/LOB, labor total, travel total, and grand total.
- Separate transaction coding from supporting detail. Finance should be able to start with the summary table, then validate against labor and travel lines.
- Use one labor detail section per contract type. T&M shows employee/hour/rate/amount detail. FFP shows job/category/employee group/period/lump sum detail.
- Keep workflow as an approval record, not the main story. It belongs near the end unless finance specifically needs approver history.
- Avoid the legacy "Original / Mod 1 / Mod 2 / ..." wide matrix. The current app already tracks base, mod, effective totals, and workflow runs more cleanly.

## Data Mapping

Header:
- `authorization.Title`
- `authorization.authorizationStatus`
- `authorization.approvedOn`
- `workflowRuns` filtered to the effective approved run
- PDF generated date from the export process

Finance summary band:
- `financialSummary.effectiveLaborAmount`
- `financialSummary.effectiveTravelAmount`
- `financialSummary.effectiveGrandTotal`
- labor hour totals from `laborLines` or `tmSummaryRows`
- `authorization.contractType`
- `authorization.modCount`

Transaction header:
- `authorization.donorEntity`, `authorization.donorEntityAbbr`
- `authorization.receivingEntity`, `authorization.receivingEntityAbbr`
- `authorization.contractId`
- `authorization.contractName`
- `authorization.invoice`
- `authorization.periodStart`, `authorization.periodEnd`
- `authorization.pm.Title`
- `authorization.og`, `authorization.lob`
- submitter from the submitted workflow action or `authorization.Author`

Finance coding summary:
- Group labor lines and travel/ODC lines by `jobId`.
- Labor amount from labor line totals.
- Travel/ODC amount from travel line totals.
- Grand total from `financialSummary.effectiveGrandTotal`.

T&M labor detail:
- Prefer `tmSummaryRows` for employee-level rows.
- If rates are needed, enrich rows from matching `laborLines`.
- Columns: employee, state, job ID, labor category, standard hours, overtime hours, standard rate, overtime rate, total amount.

FFP labor detail:
- Prefer `ffpSummaryRows`.
- Columns: job ID, labor category, employees, charging period, period quantity, amount.

Travel / ODC detail:
- Prefer `travelSummaryRows`.
- Columns: line type, job ID, description, amount.

Scope and notes:
- `authorization.scopeOfWork`
- `authorization.justification`
- `authorization.notes`

Approval record:
- `workflowActions` for the effective approved run.
- Show action date, action by, and comments.
- If action was performed on behalf of the assigned approver, render "Action By on behalf of Assigned Approver".

## Generation Notes

- Suppress the unused labor section. T&M IWAs should not include the FFP labor table; FFP IWAs should not include the T&M labor table.
- Use the existing `formatDate` helper for all dates and `formatCurrency` for money.
- If compensation visibility matters for generated PDFs, the export process should run only after approval and should include the finance-visible rate/amount fields needed for entry.
- When Mods are approved, regenerate using the effective approved totals and include the current Mod number in the header.
- Store the final PDF URL and generated timestamp back to the IWA header fields already present: `pdfUrl` and `pdfGeneratedOn`.
