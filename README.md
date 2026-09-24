# Koniag Intercompany Work Authorization

## Summary

This SharePoint Framework solution manages Intercompany Work Authorizations (IWAs) for Koniag. It supports draft creation, review and approval workflow, resource and labor planning, travel/ODC capture, modification tracking, work queues, and finance-ready approved IWA output.

The app is built as a SharePoint-hosted SPFx web part using React, Material UI, Fluent UI/SPFx people picker controls, and SharePoint lists as the system of record.

## Used SharePoint Framework Version

![version](https://img.shields.io/badge/version-1.21.1-green.svg)

## Applies To

- SharePoint Framework 1.21.1
- Microsoft 365 / SharePoint Online
- React 17
- TypeScript 5.3

## Solution

| Solution | Author(s) |
| -------- | --------- |
| Intercompany Work Authorizations | Mike Landino, KGS |

## Version History

| Version | Date | Developer | Comments |
| ------- | ------ | ------------- | ---------- |
| 0.0.1 | April 28, 2026 | — | Active development baseline for IWA workflow, Mods, work queues, and PDF template design. |
| 1.0.1.8 | June 15, 2026 | Landino | Initial production release |
| 1.0.2.0 | June 16, 2026 | Landino | Adjust how we resolve auto-stamped users. Site collections don't share same userID's, so we must ensureUser before resolving. |
| 1.0.3.1 | June 18, 2026 | Landino | Fix Mod edit/reject flow - add guard for missing Mod. Reset salary when employee changes. Add STO to displays. |
| 1.0.3.2 | June 22, 2026 | Landino | Adjust User Guide config item to be unique to IWA |
| 1.0.4.0 | June 24, 2026 | Landino | Add NAICS Code, Job ID Title, add STD/OT rates to export, All OGPs can see financials, Admin page Add/Edit mods |
| 1.0.5.1 | June 24, 2026 | Landino | Update form validation to check for Resource row *OR* Travel/ODC row. Update HR approve when no Resource lines. Minor UI changes. |
| 1.0.6.1 | June 30, 2026 | Landino | Implement DELETE and CANCEL processes |
| 1.0.6.2 | July 8, 2026 | Landino | Add fake indirect Contract and Invoice. Add info/warning modals on Add Resource. Fix resource total hours helper box (add all rows) |
| 1.0.7.0 | July 17, 2026 | Landino | Fetch latest Entity GM's on every new WF Run. Adjust user record fetch after AppUser initial creation. |
| 1.0.8.3 | Sept 24, 2026 | Landino | Recognize Mod authors for edit/cancel access and rejection routing; add active IWA/Mod edit actions to My Work; improve rejected Mod cancellation, exclude rejected/canceled Mod lines from detail totals, and clarify export status and rejected proposal labels. |

---

## Core Features

- Create, save, resume, submit, and discard IWA drafts.
- Validate unique IWA combinations by donor entity, recipient entity, contract, and invoice.
- Support T&M and FFP contract types with different labor entry patterns.
- Capture resources, labor lines, travel, ODC, scope, justification, notes, and attachments.
- Route submitted IWAs through PM, HR, OG President, and CFO workflow steps.
- Support approver backups and admin approval actions.
- Restart workflow after rejected IWAs are edited and resubmitted.
- Initiate and track Mods after a fully approved IWA.
- Capture change summaries and payloads for workflow restarts and modifications.
- Provide My Work and All Authorizations views for action queues and portfolio tracking.
- Store current workflow run linkage on the IWA header.
- Preview base IWA and Mod exports, print approved versions, and save approved PDFs to the IWAExports library.

## Workflow Notes

The workflow model is run-based. An IWA may have multiple workflow runs over its life:

- A new submitted IWA starts Run 1.
- If a workflow run has a decision and the IWA is edited after rejection, the existing run is completed/superseded and a new run is created on resubmission.
- Approved IWAs may later start a Mod process, which creates a Mod record and a new workflow run.
- Rejected Mod runs return to the Mod author. Mod authors are included in edit and active-Mod cancellation access, even when they did not create the base IWA.
- The detail page repairs older rejected Mod runs assigned to the wrong submitter without resetting the step assignment date.
- Cancel Mod on a rejected Mod removes its workflow and linked Mod data and restores the IWA to its previously approved state. Discard Mod removes an unsubmitted Mod draft and its linked data.
- The IWA header stores the current workflow run so list views and detail pages can resolve pending approvers quickly.
- HR review is required for T&M compensation entry and validation before approval.

Labor hours, labor amounts, and travel/ODC totals on the detail page exclude lines linked to rejected or canceled Mods. When those records remain present, their lines and resource labels are shown with status warnings for historical reference; excluded amounts are struck through. These detail totals can still include pending Mods and should not be treated as approved-only totals.

## Primary App Areas

- Dashboard: high-level entry point.
- My Work: user-specific work queue for drafts, pending approvals, backup coverage, and prior activity, with Edit IWA / Edit Mod actions for active runs when the user has edit access.
- All Authorizations: searchable/filterable portfolio view with export and row actions, including editing active runs and resuming Mod drafts when permitted.
- IWA Form: guided creation/edit flow for header, resources/travel, attachments, and review/submit.
- IWA Detail Page: summary, resources/labor, travel/ODC, workflow history, Mods, and history tabs.
- Admin: configuration screens for users, entities, operating groups, LOBs, approvers, and company defaults.

## Data Model

The app uses SharePoint lists represented in code by the interfaces in:

- `src/webparts/iwa/components/data/props.ts`

Important record groups:

- Authorizations
- Mods
- Resources
- Labor Lines
- Travel / ODC Lines
- Workflow Runs
- Workflow Actions
- Contracts, invoices, jobs, entities, operating groups, LOBs, app users, and configuration

Detail-page read models and PDF-oriented summary shapes live in:

- `src/webparts/iwa/components/authorizations/viewModels.ts`

## PDF Export

The export preview supports base IWA and Mod selection with explicit Mod status labels. Access requires financial-view permission. Printing and saving a PDF are available only after the selected base IWA or Mod is fully approved. Approved PDFs are saved to the IWAExports SharePoint library, and existing saved PDFs can be opened from the preview.

Rejected Mod previews label amounts as rejected proposals and display a warning that they must not be used for billing or authorization. Print and Save PDF remain unavailable for rejected Mods.

The implementation lives in `src/webparts/iwa/components/authorizations/export/`. Supporting PDF design artifacts are in:

- `docs/pdf-templates/approved-iwa-finance-template.html`
- `docs/pdf-templates/approved-iwa-finance-template.md`
- `docs/pdf-templates/approved-iwa-finance-example.html`
- `docs/pdf-templates/approved-iwa-finance-example-preview.png`
- `docs/pdf-templates/approved-iwa-finance-example-preview.pdf`

The export format is finance-first: transaction totals and coding summary appear at the top, followed by header details, labor detail, travel/ODC detail, scope/justification, and approval record.

## Prerequisites

- Node.js 22.x matching `package.json` engines: `>=22.14.0 <23.0.0`
- SharePoint Framework toolchain compatible with SPFx 1.21.1
- Access to the target SharePoint site and required backing lists
- Permissions to deploy and run the SPFx package in the target tenant

## Local Development

Install dependencies:

```powershell
npm install
```

Build the debug bundle:

```powershell
npm run build
```

Clean generated output:

```powershell
npm run clean
```

Create a production package:

```powershell
npm run package
```

For local SharePoint workbench testing, use the normal SPFx serve flow for your environment:

```powershell
gulp serve
```

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run build` | Runs `gulp bundle` for a debug bundle. |
| `npm run clean` | Runs `gulp clean`. |
| `npm run test` | Runs the SPFx test task. |
| `npm run package` | Cleans, builds, bundles, and packages the solution for shipping. |

## Implementation Notes

- UI styling is primarily Material UI with Koniag-specific dark/light themes.
- People fields use SPFx/PnP people picker patterns.
- Date and currency display should use shared helpers from `src/webparts/iwa/components/common/utils.ts`.
- Workflow permissions and backup coverage logic are centralized in `src/webparts/iwa/components/workflow/workflowAccess.ts`.
- Workflow decisions are handled through workflow services under `src/webparts/iwa/components/workflow`.
- IWA header persistence and SharePoint item mapping are handled by `src/webparts/iwa/components/authorizations/iwaService.ts`.

## Disclaimer

This code is provided as an internal business solution for the Koniag Intercompany Work Authorization process. It is provided as-is without warranty of any kind, either express or implied, including any implied warranties of fitness for a particular purpose, merchantability, or non-infringement.

## References

- [SharePoint Framework documentation](https://learn.microsoft.com/sharepoint/dev/spfx/sharepoint-framework-overview)
- [Set up your SharePoint Framework development environment](https://learn.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment)
- [Material UI documentation](https://mui.com/material-ui/)
- [PnP SPFx React controls](https://pnp.github.io/sp-dev-fx-controls-react/)
