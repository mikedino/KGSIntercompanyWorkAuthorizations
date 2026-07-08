# Koniag Intercompany Work Authorization - Technical Documentation

Generated: July 6, 2026

This document is intended for an outside developer who needs to understand the technologies, structure, flow, data model, style, and major implementation decisions in the Intercompany Work Authorization (IWA) SharePoint Framework application.

## README Baseline

The following section is intentionally based closely on the current project README so this technical guide starts from the same project summary and operating assumptions.

### Summary

This SharePoint Framework solution manages Intercompany Work Authorizations (IWAs) for Koniag. It supports draft creation, review and approval workflow, resource and labor planning, travel/ODC capture, modification tracking, work queues, and finance-ready approved IWA output.

The app is built as a SharePoint-hosted SPFx web part using React, Material UI, Fluent UI/SPFx people picker controls, and SharePoint lists as the system of record.

### Used SharePoint Framework Version

SPFx 1.21.1

### Applies To

- SharePoint Framework 1.21.1
- Microsoft 365 / SharePoint Online
- React 17
- TypeScript 5.3

### Solution

| Solution | Author(s) |
| --- | --- |
| Intercompany Work Authorizations | Mike Landino, KGS |

### Version History

| Version | Date | Developer | Comments |
| --- | --- | --- | --- |
| 1.0.1.8 | June 15, 2026 | Landino | Initial production release |
| 1.0.2.0 | June 16, 2026 | Landino | Adjust how auto-stamped users are resolved. Site collections do not share the same user IDs, so users must be ensured before resolving. |
| 1.0.3.1 | June 18, 2026 | Landino | Fix Mod edit/reject flow, add guard for missing Mod, reset salary when employee changes, and add STO to displays. |
| 1.0.3.2 | June 22, 2026 | Landino | Adjust User Guide config item to be unique to IWA. |
| 1.0.4.0 | June 24, 2026 | Landino | Add NAICS Code, Job ID Title, add STD/OT rates to export, allow all OGPs to see financials, and add Admin page Add/Edit Mods. |
| 1.0.5.1 | June 24, 2026 | Landino | Update form validation to check for a Resource row or Travel/ODC row. Update HR approve behavior when no Resource lines. Minor UI changes. |
| 1.0.6.1 | June 30, 2026 | Landino | Implement DELETE and CANCEL processes. |

### Core Features

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
- Prepare finance-focused approved IWA PDF export templates.

### Workflow Notes

The workflow model is run-based. An IWA may have multiple workflow runs over its life:

- A new submitted IWA starts Run 1.
- If a workflow run has a decision and the IWA is edited after rejection, the existing run is completed/superseded and a new run is created on resubmission.
- Approved IWAs may later start a Mod process, which creates a Mod record and a new workflow run.
- The IWA header stores the current workflow run so list views and detail pages can resolve pending approvers quickly.
- HR review is required for T&M compensation entry and validation before approval.

### Primary App Areas

- Dashboard: high-level entry point.
- My Work: user-specific work queue for drafts, pending approvals, backup coverage, and prior activity.
- All Authorizations: searchable/filterable portfolio view with export and row actions.
- IWA Form: guided creation/edit flow for header, resources/travel, attachments, and review/submit.
- IWA Detail Page: summary, resources/labor, travel/ODC, workflow history, Mods, and history tabs.
- Admin: configuration screens for users, entities, operating groups, LOBs, approvers, and company defaults.

### Data Model

The app uses SharePoint lists represented in code by the interfaces in `src/webparts/iwa/components/data/props.ts`.

Important record groups:

- Authorizations
- Mods
- Resources
- Labor Lines
- Travel / ODC Lines
- Workflow Runs
- Workflow Actions
- Contracts, invoices, jobs, entities, operating groups, LOBs, app users, and configuration

Detail-page read models and PDF-oriented summary shapes live in `src/webparts/iwa/components/authorizations/viewModels.ts`.

### PDF Export Direction

Approved IWA PDF export design artifacts are in:

- `docs/pdf-templates/approved-iwa-finance-template.html`
- `docs/pdf-templates/approved-iwa-finance-template.md`
- `docs/pdf-templates/approved-iwa-finance-example.html`
- `docs/pdf-templates/approved-iwa-finance-example-preview.png`
- `docs/pdf-templates/approved-iwa-finance-example-preview.pdf`

The proposed PDF format is finance-first: transaction totals and coding summary appear at the top, followed by header details, labor detail, travel/ODC detail, scope/justification, and approval record.

### Prerequisites

- Node.js 22.x matching `package.json` engines: `>=22.14.0 <23.0.0`
- SharePoint Framework toolchain compatible with SPFx 1.21.1
- Access to the target SharePoint site and required backing lists
- Permissions to deploy and run the SPFx package in the target tenant

### Local Development

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

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Runs `gulp bundle` for a debug bundle. |
| `npm run clean` | Runs `gulp clean`. |
| `npm run test` | Runs the SPFx test task. |
| `npm run package` | Cleans, builds, bundles, and packages the solution for shipping. |

### Implementation Notes

- UI styling is primarily Material UI with Koniag-specific dark/light themes.
- People fields use SPFx/PnP people picker patterns.
- Date and currency display should use shared helpers from `src/webparts/iwa/components/common/utils.ts`.
- Workflow permissions and backup coverage logic are centralized in `src/webparts/iwa/components/workflow/workflowAccess.ts`.
- Workflow decisions are handled through workflow services under `src/webparts/iwa/components/workflow`.
- IWA header persistence and SharePoint item mapping are handled by `src/webparts/iwa/components/authorizations/iwaService.ts`.

## Technology Stack

| Area | Technology |
| --- | --- |
| Host | SharePoint Online / Microsoft 365 |
| App model | SharePoint Framework web part |
| Language | TypeScript |
| UI framework | React 17 |
| Routing | `react-router-dom` v5 with hash routing |
| UI components | Material UI v7, MUI X Date Pickers, Fluent UI, PnP SPFx React controls |
| SharePoint API layer | `gd-sprest` plus SPFx context |
| PDF generation | `@react-pdf/renderer` |
| Dates | `dayjs` |
| Build | SPFx gulp toolchain |

The solution is a single SPFx web part. SharePoint lists are the primary persistence layer; there is no separate API service in this repository. The app also reads lookup data from separate SharePoint sites for JAMIS data and shared configuration.

## Runtime Flow

1. `src/webparts/iwa/IwaWebPart.ts` is the SPFx entry point. It sets the `gd-sprest` context, ensures the SharePoint web view query parameter is present, wraps the app in `HashRouter`, and renders React into the web part DOM.
2. `src/webparts/iwa/components/App.tsx` installs the outer shell, global shell UI provider, Material UI theme provider, and baseline CSS reset.
3. `src/webparts/iwa/components/AppBoot.tsx` performs the installation/configuration gate. Site owners/admins are checked with `dattatable`'s `InstallationRequired.requiresInstall`; non-admin users proceed directly.
4. `src/webparts/iwa/components/AppLoad.tsx` starts the IWA data provider and renders app-level alert, backdrop, and snackbar hosts.
5. `src/webparts/iwa/components/data/iwaContext.tsx` exposes loaded authorizations, drafts, app users, workflow runs, detail caches, and refresh helpers to the rest of the app.
6. `src/webparts/iwa/components/layout/AppFrame.tsx` renders the sticky navigation header and the route switch for My Work, All Authorizations, Dashboard, Admin, new/edit/view authorization, and export preview.

## Routes

| Route | Component | Purpose |
| --- | --- | --- |
| `/` | Redirect | Sends users to `/my-work/needsAction`. |
| `/my-work/:view` | `MyWorkPage` | User-specific queue for drafts, pending approvals, backup coverage, and history. |
| `/all-authorizations/:view` | `AllAuthorizationsPage` | Portfolio list with filters/actions. |
| `/authorizations/new` | `IwaForm` | Creates a new draft authorization and walks through the form. |
| `/authorizations/edit/:id` | `IwaForm` | Edits an existing authorization when `canUserEditAuthorization` allows it. |
| `/authorizations/view/:id` | `IwaDetailPage` | Detail, tabs, workflow actions, Mods, export, delete/cancel flows. |
| `/authorizations/export/:id` | `IwaExportPreviewPage` | PDF export preview/generation path. |
| `/dashboard` | `DashboardPage` | Higher-level workflow/activity dashboard. |
| `/admin` | `AdminPage` | Admin-only configuration and lookup maintenance. |

## SharePoint Data Model

List installation/configuration is defined in `src/webparts/iwa/components/data/cfg.ts` using `Helper.SPConfig`. The major lists are:

| List | Purpose |
| --- | --- |
| `IWAAgreements` | Header/master records for base authorizations. |
| `IWAMods` | Modification header records for approved IWAs. |
| `IWAResources` | Employee/resource roster rows for base IWAs and Mods. |
| `IWALaborLine` | Billable labor charge rows. |
| `IWATravelODC` | Travel, ODC, and other non-labor cost rows. |
| `IWAWorkflowRuns` | Run-based workflow instances for base and Mod workflows. |
| `IWAWorkflowActions` | Workflow action/history rows. |
| `IWAExports` | Generated finance PDF documents and metadata. |
| `IWAAppUsers` | App user profile, role, theme preference, visit tracking, and backups. |
| `IWACounters` | Yearly sequence counters for IWA numbers. |

Lookup lists outside the current web are named in `strings.ts` and loaded through `DataSource`: JAMIS contracts, invoices, jobs, shared config, entities, OGs, and LOBs.

## App State and Data Loading

`DataSource` in `data/ds.ts` is the low-level SharePoint data access cache for app-wide reference data. It loads authorizations, config, entities, LOBs, OGs, and contracts during initialization. It also exposes static flags such as `DataSource.isAdmin` and `DataSource.isOGP`.

`useIwaData` in `data/iwaDataCall.ts` is the primary boot data hook. It initializes `DataSource`, loads current user state, authorizations, draft authorizations, draft Mods, and current workflow runs.

`IwaProvider` in `data/iwaContext.tsx` wraps that boot data and adds lazy detail caches. Detail-page data is intentionally loaded on demand by authorization ID: Mods, workflow runs/actions, resources, labor lines, and travel/ODC lines are fetched together by `loadAuthorizationDetail`. Individual sections can be reloaded after localized updates with `reloadAuthorizationDetailSections`.

## Workflow Model

The workflow is run-based rather than status-only. A workflow run stores the current step, pending role, pending approver, HR/OGP/CFO approvers, decision state, restart metadata, and an approved snapshot.

Typical base flow:

1. Submitter creates and submits an IWA.
2. `WorkflowRunService.createFirstRun` creates Run 1.
3. PM reviews unless the submitter is also PM or no PM is available.
4. T&M IWAs route to HR for compensation review.
5. OG President reviews.
6. CFO reviews.
7. On final approval, authorization status and approved amounts are stamped.

Rejected flows return to the submitter by moving the active run to `currentStepKey: "submitter"` with `outcome: "rejected"`. If the submitter edits after a decision, the previous run is superseded and a new run is created on resubmission.

Mods use the same workflow-run list but are tied to a Mod lookup. `WorkflowRunService.createModRun` fails if the Mod ID is missing to prevent a Mod workflow from being treated as a base workflow.

## Permissions and Access Controls

The app keeps access checks in small modules and then composes them in route guards, buttons, and tabs.

| File | Responsibility |
| --- | --- |
| `authorizations/authorizationEditAccess.ts` | Edit permission for author, backup requestor, PM, creator backups, and admins. |
| `authorizations/authorizationDeleteAccess.ts` | Delete/discard IWA and cancel Mod permission. Fully approved IWAs cannot be deleted. Admins can act, otherwise requestor/PM/backup participants are checked against active or returned workflows. |
| `authorizations/financialAccess.ts` | Financial visibility. Admins and OG Presidents can view amounts; PMs, HR, CFO, pending approvers, and their backups can view relevant amounts. Others see masked currency text. |
| `workflow/workflowAccess.ts` | Workflow action permission. Direct pending approvers, their configured backups, and admins can approve/reject. |
| `resources/laborAccess.ts` | Compensation edit access, primarily for HR/admin style labor compensation entry. |

`AppFrame` protects edit routes with `canUserEditAuthorization`. `IwaDetailPage` computes permissions for edit, delete, cancel Mod, workflow actions, compensation edits, financial visibility, and PDF export actions.

## Financial and Money Handling

Money values are split between base totals and approved totals:

- Base totals come from active non-Mod labor/travel rows.
- Approved totals include the base plus approved Mod lines.
- Mod totals are stored on the Mod record and also reflected in approved authorization totals when the Mod is approved.

Important calculation points:

- `resources/laborMath.ts` derives standard rate from annual salary with `(annualSalary / 2080) * 1.65` when no standard rate is supplied, derives overtime as `standardRate * 1.5` when no overtime rate is supplied, and rounds currency to two decimals.
- `authorizations/iwaService.ts` recalculates base amounts, approved amounts, combined authorization amounts, and Mod count.
- `IwaDetailPage` masks or displays financial values based on `canViewFinancialAmounts`.
- `IwaDetailPage` requires the IWA JAMIS Project ID before approving a base IWA at the final approval point.

## Important Components

### IWA Form

`src/webparts/iwa/components/authorizations/iwaForm.tsx` is the guided create/edit form. It is one of the largest and most important files in the project.

The form uses four steps:

1. Basic Information
2. Resources & Travel
3. Details & Attachments
4. Review & Submit

Key responsibilities:

- Creates a temporary draft immediately for new IWAs so attachments and child rows can attach to a known authorization ID.
- Loads contract, invoice, job, entity, OG, state, and labor category options.
- Supports both base IWA editing and Mod editing.
- Tracks local editable rows for resources, travel/ODC, and FFP labor.
- Validates required header fields and at least one Resource row or Travel/ODC row before submit.
- Builds/persists SharePoint header, resource, labor, travel/ODC, and Mod records.
- Calculates and persists base or Mod totals.
- Creates or restarts workflow runs on submit.
- Captures change sets for workflow restarts through `workflow/changeCapture.ts`.
- Handles draft discard and Mod discard/cancel UX.

Important implementation points:

- New authorizations call `AuthorizationService.createDraft` before the user finishes the form.
- Initial submit calls `AuthorizationService.submitNew`, which reserves the next yearly sequence from `IWACounters` and stamps the formal IWA number.
- Edits call `AuthorizationService.edit`.
- Approvers are resolved through `ApproverResolver.resolve`.
- Workflow runs are created through `WorkflowRunService`.
- Workflow history rows are created through `WorkflowActionService`.
- Mod edit state is tracked with a session storage key so returning from detail/edit flows can preserve the active Mod draft.

### IWA Detail Page

`src/webparts/iwa/components/authorizations/IwaDetailPage.tsx` is the main read/action page for an authorization.

Key responsibilities:

- Loads authorization detail data on demand through `IwaProvider`.
- Organizes content into Summary, Resources/Labor, Travel/ODC, Workflow, Mods, and History tabs.
- Shows workflow step state and current/past runs.
- Computes action buttons from permission modules.
- Allows authorized users to edit, delete/discard, approve/reject workflow steps, initiate Mods, cancel Mods, and export PDFs.
- Supports HR/admin compensation edits directly from the detail view.
- Applies financial visibility masking.
- Generates export PDFs using `@react-pdf/renderer`, `buildIwaExportViewModel`, `IwaExportPdfDocument`, and `IwaExportService`.
- Displays change payloads from workflow restart actions and links Mod-run changes back to the Mods tab.

Important implementation points:

- `getWorkflowActionPermission` determines whether the current user can approve/reject the active run and whether the user is acting as a backup.
- `canUserEditAuthorization` determines whether the edit button should route to the form.
- `canDeleteAuthorization` and `canCancelMod` protect destructive flows.
- `canViewFinancialAmounts` controls visible vs masked amounts.
- Approval/rejection goes through `WorkflowDecisionService.submitDecision`.
- After workflow changes, detail caches and list caches are refreshed or marked stale so My Work/All Authorizations see current status.

## Styling and Themes

Styling is primarily Material UI. Theme files are in `src/webparts/iwa/components/styles`:

- `theme.base.ts` defines typography, input sizing, global CSS baseline, SharePoint canvas background integration, MUI component defaults, and common card/paper styling.
- `lightTheme.ts` defines the light palette.
- `darkTheme.ts` defines the dark palette.
- `theme.d.ts` augments the MUI palette with an `accent` color.
- `styles.module.scss` contains SPFx/CSS module styles.

Theme preference flow:

1. `App.tsx` reads cached theme preference from browser storage before the app fully boots.
2. `AppLoad.tsx` synchronizes the theme to the current app user's `modePreference` after boot data loads.
3. `NavHeader.tsx` lets the user switch themes and persists the choice through `AppUserService.updateMyModePreference`.

## Folder and File Guide

### Root and Configuration

| Path | Purpose |
| --- | --- |
| `README.md` | High-level project summary, features, version history, scripts, and references. |
| `package.json` | Node engine, build scripts, and runtime/dev dependencies. |
| `package-lock.json` | Locked dependency tree. |
| `gulpfile.js` | SPFx build rig initialization. |
| `tsconfig.json` | TypeScript compiler settings for the SPFx solution. |
| `.eslintrc.js` | SPFx/TypeScript lint rules. |
| `.yo-rc.json` | Yeoman/SPFx generator metadata. |
| `.npmignore` | NPM package exclusion rules. |
| `.gitignore` | Git exclusion rules. |

### `config`

| Path | Purpose |
| --- | --- |
| `config/config.json` | SPFx build configuration. |
| `config/package-solution.json` | SPFx package metadata, solution ID, version, and feature/package settings. |
| `config/serve.json` | Local serve/workbench settings. |
| `config/sass.json` | Sass build settings. |
| `config/write-manifests.json` | Manifest output settings. |
| `config/deploy-azure-storage.json` | Azure CDN/storage deployment settings if used. |

### `src/webparts/iwa`

| Path | Purpose |
| --- | --- |
| `IwaWebPart.ts` | SPFx web part entry point, SharePoint context setup, hash router installation, and React render. |
| `IwaWebPart.manifest.json` | Web part manifest metadata. |
| `loc/en-us.js` | Localized web part property pane strings. |
| `loc/mystrings.d.ts` | Type declarations for localized strings. |
| `assets/KGS-Logo.png` | Standard logo asset. |
| `assets/KGS-Logo-Reverse-White.png` | Reverse/white logo asset. |
| `assets/What is the IWA Tool.txt` | Text asset describing the tool. |

### App Shell Files

| Path | Purpose |
| --- | --- |
| `components/App.tsx` | Outer React shell, theme provider, CSS baseline, shell UI provider, and AppBoot handoff. |
| `components/AppBoot.tsx` | Install/configuration check and startup loading/error states. |
| `components/AppLoad.tsx` | Data provider startup, theme sync, global alert/backdrop/snackbar hosts, and AppFrame handoff. |

### `components/data`

| Path | Purpose |
| --- | --- |
| `props.ts` | Central TypeScript model definitions for app users, lookups, authorizations, Mods, resources, labor lines, travel/ODC, workflow runs/actions, exports, statuses, and labels. |
| `cfg.ts` | SharePoint list/library provisioning schema used by `InstallationRequired`. |
| `ds.ts` | Static data source/cache for app-wide SharePoint data, current user setup, admin/OGP flags, reference lookups, JAMIS contracts/invoices/jobs, and app users. |
| `iwaDataCall.ts` | Boot data hook for initializing `DataSource`, loading current user, authorizations, drafts, draft Mods, and current runs. |
| `iwaContext.tsx` | React context exposing app data, refresh helpers, lazy detail caches, dashboard actions, and My Work actions. |
| `indirectCharges.ts` | Manual/indirect contract/invoice charge data hook; currently imported but commented out in `ds.ts`. |

### `components/common`

| Path | Purpose |
| --- | --- |
| `strings.ts` | Global project name, version, SharePoint site/list names, logo data, and `gd-sprest` page context setup. |
| `utils.ts` | Shared date, currency, error, theme storage, list-name encoding, workflow stale marker, avatar, file icon, and formatting utilities. |
| `sharePointUserResolver.ts` | Ensures/resolves people fields into the current SharePoint web before writing person fields across site collections. |
| `optionArrays.ts` | Shared option arrays for select controls. |

### `components/layout`

| Path | Purpose |
| --- | --- |
| `AppFrame.tsx` | Main routed layout, navigation header, route definitions, scroll reset, edit route guard, and app version footer. |
| `MyWorkPage.tsx` | User work queue for needs-action items, drafts, backup coverage, and prior activity. |
| `myWorkUtils.ts` | Helper logic for My Work grouping, labels, and queue derivation. |
| `AllAuthorizationsPage.tsx` | Portfolio/list view for authorizations with filters, view modes, and row actions. |
| `allAuthorizationsUtils.ts` | Status labels, chip colors, filter helpers, and list formatting utilities. |
| `DashboardPage.tsx` | Dashboard container for app activity and workflow summaries. |
| `dashboard/DashboardCards.tsx` | Dashboard summary metric cards. |
| `dashboard/DashboardPanels.tsx` | Dashboard panels for recent activity/workflow slices. |
| `dashboard/dashboardUtils.ts` | Dashboard aggregation and formatting helpers. |

### `components/ui`

| Path | Purpose |
| --- | --- |
| `NavHeader.tsx` | Sticky app header, navigation, new authorization button, refresh, help, theme switch, user profile, and backup management. |
| `ShellUiContext.tsx` | Global shell UI state and helpers for alerts, busy backdrop, success overlays, and snackbars. |
| `AppAlertHost.tsx` | Renders shell alert dialogs. |
| `AppBackdrop.tsx` | Renders global busy/backdrop state. |
| `AppSnackbarHost.tsx` | Renders global snackbar notifications. |
| `Alert.tsx` | Reusable alert dialog component. |
| `BrandedLoadingState.tsx` | Branded loading screen used during boot/config/data loading. |
| `CompactDateField.tsx` | Compact date field wrapper for consistent form dates. |
| `CustomPeoplePicker.tsx` | MUI-styled people picker wrapper around SPFx/PnP people picker behavior. |
| `NotFoundPage.tsx` | Route/item not found display. |
| `PageHeader.tsx` | Reusable page header layout. |
| `ThemeSwitcher.tsx` | Theme toggle UI component. |

### `components/styles`

| Path | Purpose |
| --- | --- |
| `theme.base.ts` | Shared Material UI theme options and component overrides. |
| `lightTheme.ts` | Light theme palette. |
| `darkTheme.ts` | Dark theme palette. |
| `theme.d.ts` | MUI palette type augmentation for custom accent color. |
| `styles.module.scss` | SPFx CSS module styles. |
| `styles.module.scss.ts` | Generated/typed CSS module mapping if present in the workspace. |

### `components/authorizations`

| Path | Purpose |
| --- | --- |
| `iwaForm.tsx` | Primary create/edit form and workflow submit path for base IWAs and Mods. |
| `IwaDetailPage.tsx` | Primary detail/action page with tabs, workflow actions, financial masking, compensation edits, PDF export, delete, and cancel Mod flows. |
| `iwaService.ts` | Authorization persistence, numbering, status updates, amount recalculation, cascade delete, and submitted Mod cancellation. |
| `authorizationEditAccess.ts` | Edit permission helper. |
| `authorizationDeleteAccess.ts` | Delete/discard/cancel permission helpers. |
| `financialAccess.ts` | Financial visibility and masked currency rules. |
| `IwaWorkPackageStep.tsx` | Form step for resources, labor, FFP lines, travel, and ODC entry. |
| `IwaReviewSection.tsx` | Review/submit summary used in the final form step. |
| `IwaAttachmentsPanel.tsx` | Attachment upload/list/remove UI for the authorization. |
| `viewModels.ts` | Detail/export view model shapes and data preparation types. |

### `components/authorizations/view`

| Path | Purpose |
| --- | --- |
| `IwaSummaryTab.tsx` | Header, relationship, scope, justification, notes, status, and financial summary tab. |
| `IwaResourcesLaborTab.tsx` | Resource roster, labor lines, compensation display/editing, and labor totals. |
| `IwaTravelOdcTab.tsx` | Travel/ODC detail and totals. |
| `IwaWorkflowTab.tsx` | Workflow run/action history display. |
| `IwaModsTab.tsx` | Mod list, Mod totals, Mod workflow/action references, and Mod-related detail. |
| `IwaHistoryTab.tsx` | Historical activity/audit-oriented tab. |
| `iwaViewUtils.ts` | Shared detail tab helpers, labels, derived rates, missing compensation messages, workflow display helpers, and Mod labels. |

### `components/authorizations/export`

| Path | Purpose |
| --- | --- |
| `exportViewModel.ts` | Builds finance-oriented export view model from authorization detail data. |
| `IwaExportPdfDocument.tsx` | React PDF document definition for generated IWA export PDFs. |
| `iwaExportService.ts` | Writes/stores export files and metadata in SharePoint. |
| `IwaExportPreviewPage.tsx` | Preview/generation route for IWA export PDFs. |

### `components/authorizations/workPackage`

| Path | Purpose |
| --- | --- |
| `IwaPriorResourcesPanel.tsx` | Shows prior/approved resources while editing Mods. |
| `workPackageTypes.ts` | Types used by the work package/resource/labor/travel editing UI. |

### `components/workflow`

| Path | Purpose |
| --- | --- |
| `workflowService.ts` | Reads workflow runs/actions for detail, dashboard, and My Work views. |
| `runService.ts` | Creates workflow runs, restarts/supersedes runs, updates pending approvers, and applies step transitions. |
| `decisionService.ts` | Orchestrates approve/reject actions, workflow action history, status updates, snapshots, and amount recalculation. |
| `actionService.ts` | Creates workflow action/history records. |
| `workflowAccess.ts` | Determines whether current user can act as direct approver, backup approver, or admin. |
| `defaultApprovers.ts` | Resolves default HR, OG President, and CFO approvers. |
| `changeCapture.ts` | Captures changes between original and edited authorization/work-package data for restart workflows. |
| `changeFormatter.ts` | Formats captured workflow change payloads for display. |

### `components/resources`, `laborlineitems`, `travelodc`, and `mods`

| Path | Purpose |
| --- | --- |
| `resources/resourceService.ts` | CRUD/read helpers for resource roster rows. |
| `resources/laborMath.ts` | Labor compensation calculations, derived standard/overtime rates, and total amount rounding. |
| `resources/laborAccess.ts` | Compensation edit permission helpers. |
| `laborlineitems/laborLineItemService.ts` | CRUD/read helpers for labor charge lines. |
| `travelodc/travelOdcService.ts` | CRUD/read helpers for travel/ODC rows. |
| `mods/modService.ts` | Mod creation, updates, status transitions, totals, and Mod lookup operations. |

### `components/admin`

| Path | Purpose |
| --- | --- |
| `AdminPage.tsx` | Admin landing page and tabs/panels for configuration maintenance. |
| `ApproversPanel.tsx` | Admin UI for HR/CFO/default approver configuration. |
| `CompanyPanel.tsx` | Admin UI for company/entity-related defaults. |
| `EntityPanel.tsx` | Entity maintenance UI. |
| `OgPanel.tsx` | Operating Group maintenance UI. |
| `LobPanel.tsx` | LOB maintenance UI. |
| `UserPanel.tsx` | App user role/backup/admin management UI. |
| `MigrationTrialPanel.tsx` | Migration trial/admin support UI. |
| `ConfigEditDialog.tsx` | Shared config edit dialog. |
| `ConfirmDeleteDialog.tsx` | Shared destructive-action confirmation dialog. |
| `configService.ts` | Config list read/write helpers. |
| `adminLookupWriteService.ts` | Shared lookup write helper logic for admin panels. |
| `entityService.ts` | Entity lookup service. |
| `ogService.ts` | Operating Group lookup service. |
| `lobService.ts` | LOB lookup service. |
| `migrationTrialService.ts` | Migration trial support service. |

### `components/users`

| Path | Purpose |
| --- | --- |
| `userService.ts` | App user creation/touch, role updates, theme preference updates, and backup assignment. |

### `tools/migration`

| Path | Purpose |
| --- | --- |
| `tools/migration/README.md` | Migration tool notes. |
| `tools/migration/column-mapping.csv` | Field mapping reference for migration. |
| `tools/migration/audit-raw-export.mjs` | Audits raw migration export data. |
| `tools/migration/import-iwa-migration.mjs` | Plans/imports IWA migration data. |
| `tools/migration/plan-raw-import.mjs` | Plans raw import from source data. |
| `tools/migration/mappings/*.csv` | Supplemental mapping files for missing Job IDs and OG/LOB mapping. |

### `docs`, `sharepoint`, and `teams`

| Path | Purpose |
| --- | --- |
| `docs/IWA_User_Guide_First_Draft.docx` | User guide draft. |
| `docs/IWA_Notification_Workflow_Build_Sheet.docx` | Notification workflow build/reference document. |
| `docs/pdf-templates/*` | Finance PDF template/reference artifacts. |
| `sharepoint/assets/KGS-Logo-Stacked_96x96.jpg` | SharePoint package asset. |
| `teams/*_color.png`, `teams/*_outline.png` | Teams app icon assets. |

## Development Guidance for New Contributors

- Start with `IwaWebPart.ts`, `App.tsx`, `AppBoot.tsx`, `AppLoad.tsx`, `AppFrame.tsx`, and `iwaContext.tsx` to understand the app boot path.
- Use `props.ts` as the source of truth for data shapes and status strings.
- Use `cfg.ts` to understand the installed SharePoint lists and fields.
- Use service classes for SharePoint writes. Avoid writing directly from UI components unless an existing pattern does so for that exact area.
- Keep permission logic in the access modules instead of embedding one-off checks in buttons.
- Use `SharePointUserResolver` before writing user/person fields that may come from another site collection.
- Use `utils.ts` for currency/date/error formatting.
- Be careful with workflow run state. The app relies on `currentWorkflowRun`, run status, run type, and Mod lookup being correct.
- Be careful with totals. Base amounts, approved amounts, Mod totals, and export totals are intentionally separate.
- When adding a new action that changes workflow or detail data, refresh or invalidate the relevant context caches.

## Common Change Areas

| Change Type | Likely Files |
| --- | --- |
| Add or rename a SharePoint field | `props.ts`, `cfg.ts`, relevant service mapping, relevant UI/view/export file. |
| Change form validation | `iwaForm.tsx`, possibly `IwaWorkPackageStep.tsx`. |
| Change workflow steps | `runService.ts`, `decisionService.ts`, `props.ts`, `IwaDetailPage.tsx`, workflow tab/view utilities. |
| Change approval permissions | `workflowAccess.ts`, possibly `authorizationEditAccess.ts` or `authorizationDeleteAccess.ts`. |
| Change financial visibility | `financialAccess.ts`, `IwaDetailPage.tsx`, detail tab components. |
| Change totals/calculations | `laborMath.ts`, `iwaService.ts`, labor/travel/mod services, export view model. |
| Change theme/style | `theme.base.ts`, `lightTheme.ts`, `darkTheme.ts`, relevant component `sx` styles. |
| Change navigation/routes | `AppFrame.tsx`, `NavHeader.tsx`. |
| Change PDF export | `exportViewModel.ts`, `IwaExportPdfDocument.tsx`, `iwaExportService.ts`, `IwaExportPreviewPage.tsx`. |

## Testing and Verification Notes

This project uses the SPFx build/test pipeline. At minimum, run:

```powershell
npm run build
```

For workflow, permissions, and financial changes, manual validation in SharePoint is important because behavior depends on SharePoint people fields, cross-site user resolution, list permissions, and live lookup data. Recommended smoke scenarios:

- New draft creation, attachment upload, save draft, resume draft, discard draft.
- Submit T&M IWA with resource/labor rows and confirm PM/HR/OGP/CFO routing.
- Submit FFP IWA and confirm PM/OGP/CFO routing.
- Reject and resubmit an IWA; verify previous run is superseded and changes are captured.
- Approve final run; verify approved totals and snapshot.
- Initiate, submit, approve, reject, and cancel a Mod.
- Validate edit/delete/cancel buttons as submitter, PM, backup, approver, admin, and unrelated user.
- Validate financial masking for unauthorized users and visibility for admin, OGP, PM, HR, CFO, pending approver, and backups.
- Generate a finance PDF export for an approved base IWA and an approved Mod.
