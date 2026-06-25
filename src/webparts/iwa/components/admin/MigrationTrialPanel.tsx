import * as React from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IMigrationBatchResult, IMigrationDeleteResult, IMigrationEnsureUsersFile, IMigrationJobTitleBackfillResult, IMigrationNaicsBackfillResult, IMigrationPlan, IMigrationStampResult, IMigrationTrialProgress, IMigrationTrialResult, MigrationTrialService } from "./migrationTrialService";
import { formatError } from "../common/utils";

interface IMigrationTrialPanelProps {
  context: WebPartContext;
  runBusy: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
  onSuccess: (message: string) => void;
}

const getSafeQuantity = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const MigrationTrialPanel: React.FC<IMigrationTrialPanelProps> = ({ context, runBusy, onSuccess }) => {
  const [plan, setPlan] = React.useState<IMigrationPlan | undefined>();
  const [ensureUsersFile, setEnsureUsersFile] = React.useState<IMigrationEnsureUsersFile | undefined>();
  const [fileName, setFileName] = React.useState<string>("");
  const [authNumber, setAuthNumber] = React.useState<string>("");
  const [batchQuantity, setBatchQuantity] = React.useState<string>("");
  const [naicsLimit, setNaicsLimit] = React.useState<string>("");
  const [allowWarnings, setAllowWarnings] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [result, setResult] = React.useState<IMigrationTrialResult | undefined>();
  const [stampResult, setStampResult] = React.useState<IMigrationStampResult | undefined>();
  const [batchResult, setBatchResult] = React.useState<IMigrationBatchResult | undefined>();
  const [deleteResult, setDeleteResult] = React.useState<IMigrationDeleteResult | undefined>();
  const [jobTitleResult, setJobTitleResult] = React.useState<IMigrationJobTitleBackfillResult | undefined>();
  const [naicsResult, setNaicsResult] = React.useState<IMigrationNaicsBackfillResult | undefined>();
  const [progress, setProgress] = React.useState<IMigrationTrialProgress | undefined>();
  const [isImporting, setIsImporting] = React.useState<boolean>(false);
  const [isStamping, setIsStamping] = React.useState<boolean>(false);
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [isEnsuringUsers, setIsEnsuringUsers] = React.useState<boolean>(false);
  const [isBackfillingJobTitles, setIsBackfillingJobTitles] = React.useState<boolean>(false);
  const [isBackfillingNaics, setIsBackfillingNaics] = React.useState<boolean>(false);

  React.useEffect(() => {
    MigrationTrialService.configure(context);
  }, [context]);

  const issuesForAuth = React.useMemo(() => {
    if (!plan || !authNumber.trim()) {
      return [];
    }
    return MigrationTrialService.getIssuesForAuthorization(plan, authNumber.trim());
  }, [authNumber, plan]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress(undefined);
    setPlan(undefined);
    setEnsureUsersFile(undefined);
    setFileName("");

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<IMigrationPlan & IMigrationEnsureUsersFile>;
      if (Array.isArray(parsed.ensureUsers)) {
        const nextEnsureUsersFile = MigrationTrialService.validateEnsureUsersFile(parsed);
        setEnsureUsersFile(nextEnsureUsersFile);
        setFileName(file.name);
        setAuthNumber("");
        return;
      }
      const nextPlan = MigrationTrialService.validatePlan(parsed);
      setPlan(nextPlan);
      setFileName(file.name);
      const firstClean = nextPlan.authorizations.find((auth) =>
        !MigrationTrialService.getIssuesForAuthorization(nextPlan, String(auth.migrationKey ?? "")).length
      );
      setAuthNumber(String(firstClean?.migrationKey ?? nextPlan.authorizations[0]?.migrationKey ?? ""));
    } catch (e) {
      setError(`Could not load migration plan: ${formatError(e)}`);
    }
  };

  const handleImportClick = async (): Promise<void> => {
    if (!plan) {
      setError("Upload raw-migration-plan.json first.");
      return;
    }
    const migrationKey = authNumber.trim();
    if (!migrationKey) {
      setError("Enter an authorization migration key.");
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing import...", completed: 0, total: 1 });
    setIsImporting(true);
    try {
      const nextResult = await runBusy(`Importing ${migrationKey} trial...`, () =>
        MigrationTrialService.importOne(plan, migrationKey, allowWarnings, setProgress)
      );
      setResult(nextResult);
      onSuccess(`Imported ${migrationKey} as SharePoint item ${nextResult.authorizationId}.`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsImporting(false);
    }
  };

  const getBatchQuantity = (): number | undefined => {
    const trimmed = batchQuantity.trim();
    if (!trimmed) {
      return undefined;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("Batch quantity must be a positive whole number, or blank for all.");
    }
    return value;
  };

  const handleImportBatchClick = async (): Promise<void> => {
    if (!plan) {
      setError("Upload raw-migration-plan.json first.");
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing batch import...", completed: 0, total: 1 });
    setIsImporting(true);
    try {
      const quantity = getBatchQuantity();
      const nextResult = await runBusy("Importing migration batch...", () =>
        MigrationTrialService.importBatch(plan, quantity, allowWarnings, setProgress)
      );
      setBatchResult(nextResult);
      onSuccess(`Batch import processed ${nextResult.processed} authorization(s).`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsImporting(false);
    }
  };

  const handleStampClick = async (): Promise<void> => {
    if (!plan) {
      setError("Upload raw-migration-plan.json first.");
      return;
    }
    const migrationKey = authNumber.trim();
    if (!migrationKey) {
      setError("Enter an authorization migration key.");
      return;
    }

    setError("");
    setStampResult(undefined);
    setIsStamping(true);
    try {
      const nextResult = await runBusy(`Stamping legacy system fields for ${migrationKey}...`, () =>
        MigrationTrialService.stampOne(plan, migrationKey)
      );
      setStampResult(nextResult);
      onSuccess(`Stamped ${nextResult.stamped.length} item(s) for ${migrationKey}.`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsStamping(false);
    }
  };

  const handleStampBatchClick = async (): Promise<void> => {
    if (!plan) {
      setError("Upload raw-migration-plan.json first.");
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing batch stamp...", completed: 0, total: 1 });
    setIsStamping(true);
    try {
      const quantity = getBatchQuantity();
      const nextResult = await runBusy("Stamping migration batch...", () =>
        MigrationTrialService.stampBatch(plan, quantity, setProgress)
      );
      setBatchResult(nextResult);
      onSuccess(`Batch stamp processed ${nextResult.processed} authorization(s).`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsStamping(false);
    }
  };

  const handleDeleteAllClick = async (): Promise<void> => {
    const confirmed = window.confirm(
      "This permanently deletes all items from the transactional IWA lists, excluding the IWAExports PDF library, and does not send them to the recycle bin. Continue?"
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing permanent delete...", completed: 0, total: 1 });
    setIsDeleting(true);
    try {
      const nextResult = await runBusy("Permanently deleting IWA data...", () =>
        MigrationTrialService.deleteAllIwaData(setProgress)
      );
      setDeleteResult(nextResult);
      onSuccess(`Permanently deleted ${nextResult.totalDeleted} item(s) from IWA transactional lists.`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEnsureUsersClick = async (): Promise<void> => {
    if (!plan && !ensureUsersFile) {
      setError("Upload raw-migration-plan.json or an ensure-users JSON file first.");
      return;
    }

    setError("");
    setProgress({ label: "Preparing user ensure...", completed: 0, total: 1 });
    setIsEnsuringUsers(true);
    try {
      const nextResult = await runBusy("Ensuring migration users...", () =>
        ensureUsersFile
          ? MigrationTrialService.ensureUserEmails(ensureUsersFile.ensureUsers.map((user) => user.email), setProgress)
          : MigrationTrialService.ensurePlanUsers(plan!, getBatchQuantity(), setProgress)
      );
      onSuccess(`Ensured ${nextResult.resolved} of ${nextResult.total} unique migration user(s). Failed: ${nextResult.failed.length}.`);
      if (nextResult.failed.length) {
        setError(`Could not ensure ${nextResult.failed.length} user(s). See browser console for details.`);
      }
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsEnsuringUsers(false);
    }
  };

  const handleBackfillJobTitlesClick = async (): Promise<void> => {
    const confirmed = window.confirm(
      "This will update jobTitle on existing Travel/ODC and LaborLine records by matching jobId against JAMIS JobEndPoint. Continue?"
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing job title backfill...", completed: 0, total: 1 });
    setIsBackfillingJobTitles(true);
    try {
      const nextResult = await runBusy("Backfilling job titles...", () =>
        MigrationTrialService.backfillLaborAndTravelJobTitles(setProgress)
      );
      console.info("[IWA Migration] Job title backfill result", nextResult);
      if (nextResult.skipped.length) {
        console.warn("[IWA Migration] Job title backfill skipped items", nextResult.skipped);
      }
      if (nextResult.failed.length) {
        console.error("[IWA Migration] Job title backfill failed items", nextResult.failed);
      }
      setJobTitleResult(nextResult);
      onSuccess(`Backfilled ${nextResult.totalUpdated} job title value(s).`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsBackfillingJobTitles(false);
    }
  };

  const handleBackfillNaicsClick = async (): Promise<void> => {
    const limit = getSafeQuantity(naicsLimit);
    if (naicsLimit.trim() && !limit) {
      setError("NAICS test limit must be a positive whole number, or blank for all.");
      return;
    }

    const confirmed = window.confirm(
      `This will update empty naicsCode values on ${limit ? `up to ${limit}` : "all matching"} existing IWA${limit === 1 ? "" : "s"} by matching contractId against JAMIS ContractEndPoint. Continue?`
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setResult(undefined);
    setStampResult(undefined);
    setBatchResult(undefined);
    setDeleteResult(undefined);
    setJobTitleResult(undefined);
    setNaicsResult(undefined);
    setProgress({ label: "Preparing NAICS backfill...", completed: 0, total: 1 });
    setIsBackfillingNaics(true);
    try {
      console.log("[IWA Migration] Starting NAICS backfill", { limit });
      const nextResult = await runBusy("Backfilling NAICS codes...", () =>
        MigrationTrialService.backfillAuthorizationNaicsCodes(limit, setProgress)
      );
      console.log("[IWA Migration] NAICS backfill result", nextResult);
      if (nextResult.skipped.length) {
        console.warn("[IWA Migration] NAICS backfill skipped items", nextResult.skipped);
      }
      if (nextResult.failed.length) {
        console.error("[IWA Migration] NAICS backfill failed items", nextResult.failed);
      }
      setNaicsResult(nextResult);
      onSuccess(`Backfilled ${nextResult.updated} NAICS code value(s).`);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsBackfillingNaics(false);
    }
  };

  const progressValue = progress?.total ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;
  const isBusy = isImporting || isStamping || isDeleting || isEnsuringUsers || isBackfillingJobTitles || isBackfillingNaics;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" fontWeight={700}>Migration Trial</Typography>
        <Typography variant="body2" color="text.secondary">
          Upload `raw-migration-plan.json`, then import one authorization for validation.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} aria-label="Upload migration plan" title="Upload migration plan">
          Upload Plan
          <input hidden type="file" accept="application/json,.json" onChange={handleFileChange} disabled={isBusy} />
        </Button>
        <Typography variant="body2" color="text.secondary">
          {fileName || "No plan loaded"}
        </Typography>
      </Stack>

      {plan && (
        <Alert severity="info">
          Loaded {plan.authorizations.length} authorizations, {plan.mods.length} mods, {plan.resources.length} resources,{" "}
          {plan.laborLines.length} labor lines, {plan.travelOdc.length} travel/ODC lines.
        </Alert>
      )}

      {ensureUsersFile && (
        <Alert severity="info">
          Loaded {ensureUsersFile.ensureUsers.length} user(s) from ensure-users JSON. Import and stamp actions are disabled for user-only files.
        </Alert>
      )}

      <TextField
        label="Authorization migration key"
        value={authNumber}
        onChange={(event) => setAuthNumber(event.target.value)}
        placeholder="IWA-KPS-ATS-2025-M-2268"
        fullWidth
        size="small"
        disabled={isBusy}
      />

      <TextField
        label="Batch quantity"
        value={batchQuantity}
        onChange={(event) => setBatchQuantity(event.target.value)}
        placeholder="Blank imports/stamps all"
        fullWidth
        size="small"
        disabled={isBusy}
        helperText={plan ? `${MigrationTrialService.getBatchKeys(plan, getSafeQuantity(batchQuantity)).length} authorization(s) selected for batch actions.` : ensureUsersFile ? "Batch quantity is ignored for user-only ensure files." : "Upload a plan to calculate batch size."}
      />

      {issuesForAuth.length > 0 && (
        <Alert severity="warning">
          This authorization has {issuesForAuth.length} issue warning(s). Blank labor/travel job IDs will be imported with searchable placeholder values.
        </Alert>
      )}

      <FormControlLabel
        control={<Checkbox checked={allowWarnings} disabled={isBusy} onChange={(event) => setAllowWarnings(event.target.checked)} />}
        label="Allow import when this authorization has warnings"
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={handleImportClick}
          disabled={!plan || !authNumber.trim() || isBusy}
          aria-label="Import one authorization"
          title="Import one authorization"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Import One Authorization
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<PlaylistAddCheckIcon />}
          onClick={handleImportBatchClick}
          disabled={!plan || isBusy}
          aria-label="Import batch"
          title="Import batch"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Import Batch
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ManageHistoryIcon />}
          onClick={handleStampClick}
          disabled={!plan || !authNumber.trim() || isBusy}
          aria-label="Stamp legacy fields"
          title="Stamp legacy fields"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Stamp Legacy Fields
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ManageHistoryIcon />}
          onClick={handleStampBatchClick}
          disabled={!plan || isBusy}
          aria-label="Stamp batch"
          title="Stamp batch"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Stamp Batch
        </Button>
        <Button
          variant="outlined"
          startIcon={<PersonSearchIcon />}
          onClick={handleEnsureUsersClick}
          disabled={(!plan && !ensureUsersFile) || isBusy}
          aria-label="Ensure plan users"
          title="Ensure plan users"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Ensure Plan Users
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={handleDeleteAllClick}
          disabled={isBusy}
          aria-label="Permanent delete IWA data"
          title="Permanent delete IWA data"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Permanent Delete IWA Data
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ManageHistoryIcon />}
          onClick={handleBackfillJobTitlesClick}
          disabled={isBusy}
          aria-label="Backfill job titles"
          title="Backfill job titles"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Backfill Job Titles
        </Button>
        <Typography variant="body2" color="text.secondary">
          Updates Travel/ODC and LaborLine jobTitle from JAMIS JobEndPoint.
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ManageHistoryIcon />}
          onClick={handleBackfillNaicsClick}
          disabled={isBusy}
          aria-label="Backfill NAICS codes"
          title="Backfill NAICS codes"
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          Backfill NAICS Codes
        </Button>
        <Typography variant="body2" color="text.secondary">
          Updates empty IWA naicsCode values from JAMIS ContractEndPoint.
        </Typography>
      </Stack>

      <TextField
        label="NAICS test limit"
        value={naicsLimit}
        onChange={(event) => setNaicsLimit(event.target.value)}
        placeholder="Blank updates all"
        fullWidth
        size="small"
        disabled={isBusy}
        helperText="Use 2 or 3 for a small PROD test run; leave blank to process all empty NAICS values."
      />

      {progress && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary">{progress.label}</Typography>
            <Typography variant="caption" color="text.secondary">{progress.completed}/{progress.total}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progressValue} sx={{ mt: 0.75 }} />
        </Box>
      )}

      {result && (
        <Alert severity="success">
          Created item {result.authorizationId}. Created: {Object.entries(result.created).map(([key, value]) => `${key}: ${value}`).join(", ")}
          {result.skipped.length ? ` Skipped: ${result.skipped.length}.` : ""}
          {result.warnings.length ? ` Warnings: ${result.warnings.length}.` : ""}
        </Alert>
      )}

      {result?.warnings.length ? (
        <Alert severity="warning">
          {result.warnings.slice(0, 8).map((warning) => (
            <Box key={warning}>{warning}</Box>
          ))}
          {result.warnings.length > 8 ? <Box>...and {result.warnings.length - 8} more.</Box> : undefined}
        </Alert>
      ) : undefined}

      {stampResult && (
        <Alert severity={stampResult.warnings.length ? "warning" : "success"}>
          Stamped {stampResult.stamped.length} item(s): {stampResult.stamped.map((item) => `${item.listName} #${item.itemId}`).join(", ")}
          {stampResult.warnings.length ? ` Warnings: ${stampResult.warnings.length}.` : ""}
        </Alert>
      )}

      {stampResult?.warnings.length ? (
        <Alert severity="warning">
          {stampResult.warnings.slice(0, 8).map((warning) => (
            <Box key={warning}>{warning}</Box>
          ))}
          {stampResult.warnings.length > 8 ? <Box>...and {stampResult.warnings.length - 8} more.</Box> : undefined}
        </Alert>
      ) : undefined}

      {batchResult && (
        <Alert severity={batchResult.failed.length ? "warning" : "success"}>
          Processed {batchResult.processed}. Succeeded: {batchResult.succeeded.length}. Skipped: {batchResult.skipped.length}. Failed: {batchResult.failed.length}.
          {batchResult.stamped ? ` Stamped items: ${batchResult.stamped}.` : ""}
          {Object.values(batchResult.created).some(Boolean) ? ` Created: ${Object.entries(batchResult.created).map(([key, value]) => `${key}: ${value}`).join(", ")}.` : ""}
        </Alert>
      )}

      {batchResult && (batchResult.failed.length > 0 || batchResult.warnings.length > 0 || batchResult.skipped.length > 0) && (
        <Alert severity={batchResult.failed.length ? "error" : "warning"}>
          {[...batchResult.failed.map((failure) => `${failure.migrationKey}: ${failure.error}`), ...batchResult.warnings, ...batchResult.skipped].slice(0, 12).map((message) => (
            <Box key={message}>{message}</Box>
          ))}
          {batchResult.failed.length + batchResult.warnings.length + batchResult.skipped.length > 12 ? (
            <Box>...and {batchResult.failed.length + batchResult.warnings.length + batchResult.skipped.length - 12} more.</Box>
          ) : undefined}
        </Alert>
      )}

      {deleteResult && (
        <Alert severity={deleteResult.failed.length ? "warning" : "success"}>
          Permanently deleted {deleteResult.totalDeleted} item(s): {deleteResult.deleted.map((item) => `${item.listName}: ${item.count}`).join(", ")}.
          {deleteResult.failed.length ? ` Failed deletes: ${deleteResult.failed.length}.` : ""}
        </Alert>
      )}

      {deleteResult?.failed.length ? (
        <Alert severity="error">
          {deleteResult.failed.slice(0, 12).map((failure) => (
            <Box key={`${failure.listName}-${failure.itemId ?? "list"}-${failure.error}`}>
              {failure.listName}{failure.itemId ? ` #${failure.itemId}` : ""}: {failure.error}
            </Box>
          ))}
          {deleteResult.failed.length > 12 ? <Box>...and {deleteResult.failed.length - 12} more.</Box> : undefined}
        </Alert>
      ) : undefined}

      {jobTitleResult && (
        <Alert severity={jobTitleResult.failed.length ? "warning" : "success"}>
          Processed {jobTitleResult.totalProcessed} item(s). Updated {jobTitleResult.totalUpdated}:{" "}
          {jobTitleResult.updated.map((item) => `${item.listName}: ${item.count}`).join(", ")}.
          {jobTitleResult.skipped.length ? ` Skipped: ${jobTitleResult.skipped.length}.` : ""}
          {jobTitleResult.failed.length ? ` Failed: ${jobTitleResult.failed.length}.` : ""}
        </Alert>
      )}

      {jobTitleResult && (jobTitleResult.failed.length > 0 || jobTitleResult.skipped.length > 0) && (
        <Alert severity={jobTitleResult.failed.length ? "error" : "warning"}>
          {[
            ...jobTitleResult.failed.map((failure) => `${failure.listName}${failure.itemId ? ` #${failure.itemId}` : ""}${failure.jobId ? ` (${failure.jobId})` : ""}: ${failure.error}`),
            ...jobTitleResult.skipped.map((skip) => `${skip.listName} #${skip.itemId}: ${skip.reason}`)
          ].slice(0, 12).map((message) => (
            <Box key={message}>{message}</Box>
          ))}
          {jobTitleResult.failed.length + jobTitleResult.skipped.length > 12 ? (
            <Box>...and {jobTitleResult.failed.length + jobTitleResult.skipped.length - 12} more.</Box>
          ) : undefined}
        </Alert>
      )}

      {naicsResult && (
        <Alert severity={naicsResult.failed.length ? "warning" : "success"}>
          Processed {naicsResult.processed} IWA item(s). Updated {naicsResult.updated}.
          {naicsResult.skipped.length ? ` Skipped: ${naicsResult.skipped.length}.` : ""}
          {naicsResult.failed.length ? ` Failed: ${naicsResult.failed.length}.` : ""}
        </Alert>
      )}

      {naicsResult && (naicsResult.failed.length > 0 || naicsResult.skipped.length > 0) && (
        <Alert severity={naicsResult.failed.length ? "error" : "warning"}>
          {[
            ...naicsResult.failed.map((failure) => `IWA #${failure.itemId ?? "(unknown)"}${failure.contractId ? ` (${failure.contractId})` : ""}: ${failure.error}`),
            ...naicsResult.skipped.map((skip) => `IWA #${skip.itemId}: ${skip.reason}`)
          ].slice(0, 12).map((message) => (
            <Box key={message}>{message}</Box>
          ))}
          {naicsResult.failed.length + naicsResult.skipped.length > 12 ? (
            <Box>...and {naicsResult.failed.length + naicsResult.skipped.length - 12} more.</Box>
          ) : undefined}
        </Alert>
      )}
    </Stack>
  );
};
