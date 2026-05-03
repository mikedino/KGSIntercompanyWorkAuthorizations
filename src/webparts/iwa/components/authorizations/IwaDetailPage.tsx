import * as React from "react";
import {
    Alert, BottomNavigation, BottomNavigationAction, Box, Button, Chip, Grid, Paper, Stack, Step, StepLabel, Stepper, useTheme,
    Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useHistory, useParams } from "react-router-dom";
import { IAuthorizationItem, ILaborLineItem, IModItem, IWorkflowActionItem, IWorkflowRunItem, workflowStepLabels } from "../data/props";
import { useIwa } from "../data/iwaContext";
import { formatCurrencyInputValue, formatDate, formatError, formatRelationship, normalizeDecimalInput, parseNumberOrUndefined } from "../common/utils";
import { authorizationStatusLabels, getStatusChipColor, workflowRunStatusLabels } from "../layout/allAuthorizationsUtils";
import { canEditCompensation, canViewCompensation } from "../resources/laborAccess";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { useShellUi } from "../ui/ShellUiContext";
import AlertDialog from "../ui/Alert";
import { AuthorizationService } from "./iwaService";
import { WorkflowDecisionService } from "../workflow/decisionService";
import { getWorkflowActionPermission } from "../workflow/workflowAccess";
import { formatIwaChangePayload } from "../workflow/changeFormatter";
import { ModService } from "../mods/modService";
import { IwaHistoryTab } from "./view/IwaHistoryTab";
import { IwaModsTab } from "./view/IwaModsTab";
import { IwaResourcesLaborTab } from "./view/IwaResourcesLaborTab";
import { IwaSummaryTab } from "./view/IwaSummaryTab";
import { IwaTravelOdcTab } from "./view/IwaTravelOdcTab";
import { IwaWorkflowTab } from "./view/IwaWorkflowTab";
import {
    baseWorkflowSteps,
    contractTypeLabels,
    DetailTab,
    detailTabs,
    getActiveModDraftSessionKey,
    getCompOverrideDraft,
    getCurrentStepIndex,
    getDerivedRatesFromSalary,
    getLaborDisplayName,
    getMissingCompensationMessage,
    getModScopeLabel,
    getStepAction,
    ICompDraft,
    ICompOverrideDraft,
    roundCurrency,
    toCompDraft
} from "./view/iwaViewUtils";

export const IwaDetailPage: React.FC = (): JSX.Element => {
    const history = useHistory();
    const { id } = useParams<{ id: string; }>();
    const authorizationId = Number(id);
    const { showBusy, hideBusy, showSuccess, hideSuccess, showSnackbar } = useShellUi();
    const {
        actionsByAuthorizationId,
        appUsers,
        authorizations,
        currentUser,
        draftAuthorizations,
        draftModsByAuthorizationId,
        laborLinesByAuthorizationId,
        lastRefreshed,
        loadAuthorizationDetail,
        modsByAuthorizationId,
        refresh,
        resourcesByAuthorizationId,
        runByAuthorizationId,
        runsByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();

    const [selectedTab, setSelectedTab] = React.useState<DetailTab>("summary");
    const [compDrafts, setCompDrafts] = React.useState<Record<number, ICompDraft>>({});
    const [compOverrideDrafts, setCompOverrideDrafts] = React.useState<Record<number, ICompOverrideDraft>>({});
    const [editingCompLineIds, setEditingCompLineIds] = React.useState<Record<number, boolean>>({});
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
    const [workflowDecision, setWorkflowDecision] = React.useState<"approved" | "rejected" | undefined>(undefined);
    const [workflowDialogMode, setWorkflowDialogMode] = React.useState<"approved" | "rejected">("approved");
    const [workflowComments, setWorkflowComments] = React.useState<string>("");
    const [workflowCommentError, setWorkflowCommentError] = React.useState<string>("");
    const [commentDialog, setCommentDialog] = React.useState<{ title: string; comments: string } | undefined>(undefined);
    const [changeDialog, setChangeDialog] = React.useState<IWorkflowActionItem | undefined>(undefined);
    const [modifyPromptOpen, setModifyPromptOpen] = React.useState<boolean>(false);
    const [modPromptOpen, setModPromptOpen] = React.useState<boolean>(false);
    const [expandedRunId, setExpandedRunId] = React.useState<number | false>(false);
    const theme = useTheme();

    const authorization = React.useMemo<IAuthorizationItem | undefined>(() => {
        return [...authorizations, ...draftAuthorizations].find((item) => item.Id === authorizationId);
    }, [authorizationId, authorizations, draftAuthorizations]);

    const currentRun = runByAuthorizationId.get(authorizationId);
    const workflowRuns = React.useMemo<IWorkflowRunItem[]>(() => {
        const runs = runsByAuthorizationId.get(authorizationId) ?? (currentRun ? [currentRun] : []);
        return [...runs].sort((left, right) => (left.runNumber ?? 0) - (right.runNumber ?? 0));
    }, [authorizationId, currentRun, runsByAuthorizationId]);
    const actions = actionsByAuthorizationId.get(authorizationId) ?? [];
    const currentRunActions = React.useMemo<IWorkflowActionItem[]>(() => {
        if (!currentRun?.Id) {
            return [];
        }

        return actions.filter((action) => action.workflowRun?.Id === currentRun.Id);
    }, [actions, currentRun?.Id]);
    const resources = resourcesByAuthorizationId.get(authorizationId) ?? [];
    const laborLines = React.useMemo(() => {
        return (laborLinesByAuthorizationId.get(authorizationId) ?? [])
            .filter((line) => line.isActive !== false)
            .filter((line) => {
                if (line.pricingType === "ffp") {
                    return true;
                }

                return (line.resources?.results?.length ?? 0) > 0;
            })
            .sort((left, right) => {
                const leftName = getLaborDisplayName(left, resources);
                const rightName = getLaborDisplayName(right, resources);
                const nameSort = leftName.localeCompare(rightName, undefined, { sensitivity: "base" });

                if (nameSort !== 0) {
                    return nameSort;
                }

                const scopeSort = getModScopeLabel(left).localeCompare(getModScopeLabel(right), undefined, { numeric: true, sensitivity: "base" });

                if (scopeSort !== 0) {
                    return scopeSort;
                }

                return (left.jobId ?? "").localeCompare(right.jobId ?? "", undefined, { numeric: true, sensitivity: "base" });
            });
    }, [authorizationId, laborLinesByAuthorizationId, resources]);
    const travelOdcs = React.useMemo(() => {
        return (travelOdcsByAuthorizationId.get(authorizationId) ?? [])
            .filter((line) => line.isActive !== false)
            .sort((left, right) => {
                const scopeSort = getModScopeLabel(left).localeCompare(getModScopeLabel(right), undefined, { numeric: true, sensitivity: "base" });

                if (scopeSort !== 0) {
                    return scopeSort;
                }

                return (left.jobId ?? "").localeCompare(right.jobId ?? "", undefined, { numeric: true, sensitivity: "base" });
            });
    }, [authorizationId, travelOdcsByAuthorizationId]);
    const mods = modsByAuthorizationId.get(authorizationId) ?? [];
    const draftMod = React.useMemo<IModItem | undefined>(() => {
        return mods.find((mod) => mod.modStatus === "draft") ?? draftModsByAuthorizationId.get(authorizationId);
    }, [authorizationId, draftModsByAuthorizationId, mods]);
    const draftModOwnerName = draftMod?.Author?.Title ?? "another user";
    const currentUserId = currentUser?.user?.Id;
    const canEditDraftMod = !!draftMod && !!currentUserId && draftMod.Author?.Id === currentUserId;
    const mayViewComp = canViewCompensation(currentUser, authorization);
    const mayEditComp = canEditCompensation(currentUser);
    const isFfpAuthorization = authorization?.contractType === "ffp";
    const canEditCompInHrReview = mayEditComp && currentRun?.runStatus === "active" && currentRun.currentStepKey === "hr";
    const canEditCompLine = React.useCallback((line: ILaborLineItem): boolean => {
        if (!canEditCompInHrReview || !currentRun) {
            return false;
        }

        if (currentRun.runType === "mod") {
            return line.lineScope === "mod" && !!currentRun.mod?.Id && line.mod?.Id === currentRun.mod.Id;
        }

        return line.lineScope !== "mod";
    }, [canEditCompInHrReview, currentRun]);
    const workflowDialogDecision = workflowDecision ?? workflowDialogMode;
    const activeStep = getCurrentStepIndex(currentRun);
    const stepperActiveStep = currentRun?.runStatus === "completed" ? -1 : activeStep;
    const workflowPermission = React.useMemo(() => {
        return getWorkflowActionPermission(currentRun, currentUser, appUsers);
    }, [appUsers, currentRun, currentUser]);
    const hasActiveWorkflowRun = React.useMemo(() => {
        return workflowRuns.some((run) => run.runStatus === "active");
    }, [workflowRuns]);
    const canInitiateMod = !!authorization && authorization.authorizationStatus === "approved" && !hasActiveWorkflowRun && !draftMod;
    const laborTotals = React.useMemo(() => {
        return laborLines.reduce((totals, line) => ({
            standardHours: totals.standardHours + Number(line.standardHours ?? 0),
            overtimeHours: totals.overtimeHours + Number(line.overtimeHours ?? 0),
            totalAmount: totals.totalAmount + Number(line.totalAmount ?? 0)
        }), { standardHours: 0, overtimeHours: 0, totalAmount: 0 });
    }, [laborLines]);
    const laborDeltaTotal = React.useMemo(() => {
        return laborLines
            .filter((line) => line.lineScope === "mod")
            .reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
    }, [laborLines]);
    const resourceRosterRows = React.useMemo(() => {
        const employeeMap = new Map<number, {
            key: number;
            title: string;
            email: string;
            labels: string[];
        }>();

        resources
            .filter((resource) => resource.isActive !== false && !!resource.employee?.Id)
            .forEach((resource) => {
                const employeeId = resource.employee!.Id;
                const existing = employeeMap.get(employeeId) ?? {
                    key: employeeId,
                    title: resource.employee!.Title,
                    email: resource.employee!.EMail,
                    labels: []
                };
                const label = getModScopeLabel(resource);

                if (!existing.labels.includes(label)) {
                    existing.labels.push(label);
                    existing.labels.sort((left, right) => {
                        if (left === "BASE") {
                            return -1;
                        }

                        if (right === "BASE") {
                            return 1;
                        }

                        return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
                    });
                }

                employeeMap.set(employeeId, existing);
            });

        return Array.from(employeeMap.values()).sort((left, right) => left.title.localeCompare(right.title));
    }, [resources]);
    const travelTotal = React.useMemo(() => {
        return travelOdcs.reduce((total, line) => total + Number(line.amount ?? 0), 0);
    }, [travelOdcs]);
    const travelDeltaTotal = React.useMemo(() => {
        return travelOdcs
            .filter((line) => line.lineScope === "mod")
            .reduce((total, line) => total + Number(line.amount ?? 0), 0);
    }, [travelOdcs]);
    const formattedChangeSections = React.useMemo(() => {
        return formatIwaChangePayload(changeDialog?.changePayloadJson, changeDialog?.changeSummary);
    }, [changeDialog]);
    const changeDialogRun = React.useMemo(() => {
        if (!changeDialog?.workflowRun?.Id) {
            return undefined;
        }

        return workflowRuns.find((run) => run.Id === changeDialog.workflowRun?.Id);
    }, [changeDialog?.workflowRun?.Id, workflowRuns]);
    const changeDialogMod = React.useMemo(() => {
        const modId = changeDialogRun?.mod?.Id;

        if (!modId) {
            return undefined;
        }

        return mods.find((mod) => mod.Id === modId);
    }, [changeDialogRun?.mod?.Id, mods]);

    React.useEffect((): void => {
        if (workflowRuns.length === 0) {
            setExpandedRunId(false);
            return;
        }

        const activeRun = workflowRuns.find((run) => run.runStatus === "active") ?? workflowRuns[workflowRuns.length - 1];
        setExpandedRunId((prev) => prev || activeRun.Id);
    }, [workflowRuns]);

    React.useEffect((): void => {
        if (!authorizationId || Number.isNaN(authorizationId)) {
            return;
        }

        loadAuthorizationDetail(authorizationId, true).catch((error) => {
            setDialogTitle("Detail Load Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        });
    }, [authorizationId, lastRefreshed, loadAuthorizationDetail]);

    React.useEffect((): void => {
        const nextDrafts: Record<number, ICompDraft> = {};
        const nextOverrideDrafts: Record<number, ICompOverrideDraft> = {};

        laborLines.forEach((line) => {
            nextDrafts[line.Id] = toCompDraft(line);
            nextOverrideDrafts[line.Id] = getCompOverrideDraft(line);
        });

        setCompDrafts(nextDrafts);
        setCompOverrideDrafts(nextOverrideDrafts);
    }, [laborLines]);

    const handleBack = React.useCallback((): void => {
        const fallback = sessionStorage.getItem("iwa:lastReturnLocation") || "/all-authorizations/all";
        history.push(fallback);
    }, [history]);

    const handleEdit = React.useCallback((): void => {
        if (!authorization) {
            return;
        }

        if (draftMod) {
            return;
        }

        if (currentRun?.hasDecision) {
            setModifyPromptOpen(true);
            return;
        }

        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: `/authorizations/view/${authorization.Id}`
        });
    }, [authorization, currentRun?.hasDecision, draftMod, history]);

    const handleEditMod = React.useCallback((): void => {
        if (!authorization || !draftMod?.Id || !canEditDraftMod) {
            return;
        }

        sessionStorage.setItem(getActiveModDraftSessionKey(authorization.Id), String(draftMod.Id));
        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: `/authorizations/view/${authorization.Id}`,
            modId: draftMod.Id
        });
    }, [authorization, canEditDraftMod, draftMod, history]);

    const handleConfirmModify = React.useCallback((): void => {
        if (!authorization) {
            return;
        }

        setModifyPromptOpen(false);
        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: `/authorizations/view/${authorization.Id}`
        });
    }, [authorization, history]);

    const handleOpenInitiateMod = React.useCallback((): void => {
        setModPromptOpen(true);
    }, []);

    const handleInitiateMod = React.useCallback(async (): Promise<void> => {
        if (!authorization) {
            return;
        }

        setModPromptOpen(false);
        const nextModNumber = Math.max(0, ...mods.map((mod) => mod.modNumber ?? 0)) + 1;
        const summary = `Modification ${nextModNumber} initiated.`;

        try {
            showBusy("Creating modification draft...");
            const mod = await ModService.create({
                authorizationId: authorization.Id,
                authorizationTitle: authorization.Title,
                modNumber: nextModNumber,
                modStatus: "draft",
                reason: "",
                changeSummary: summary,
                laborAmount: 0,
                travelAmount: 0,
                grandTotal: 0
            });

            showBusy("Updating authorization...");
            await AuthorizationService.updateModCount(authorization.Id, nextModNumber);

            showBusy("Refreshing authorization...");
            await Promise.all([
                refresh(true),
                loadAuthorizationDetail(authorization.Id, true)
            ]);

            sessionStorage.setItem(getActiveModDraftSessionKey(authorization.Id), String(mod.Id));
            hideBusy();
            history.push(`/authorizations/edit/${authorization.Id}`, {
                returnTo: `/authorizations/view/${authorization.Id}`,
                modId: mod.Id
            });
        } catch (error) {
            hideBusy();
            setDialogTitle("Initiate Mod Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, hideBusy, history, loadAuthorizationDetail, mods, refresh, showBusy]);

    const handleOpenWorkflowDecision = React.useCallback((decision: "approved" | "rejected"): void => {
        if (decision === "approved") {
            const message = getMissingCompensationMessage(authorization, currentRun, laborLines);

            if (message) {
                showSnackbar(message, "warning");
                return;
            }
        }

        setWorkflowDecision(decision);
        setWorkflowDialogMode(decision);
        setWorkflowComments("");
        setWorkflowCommentError("");
    }, [authorization, currentRun, laborLines, showSnackbar]);

    const handleCloseWorkflowDecision = React.useCallback((): void => {
        setWorkflowDecision(undefined);
        setWorkflowComments("");
        setWorkflowCommentError("");
    }, []);

    const handleSubmitWorkflowDecision = React.useCallback(async (): Promise<void> => {
        if (!authorization || !currentRun || !workflowDecision) {
            return;
        }

        const decision = workflowDecision;
        const trimmedComments = workflowComments.trim();

        if (decision === "rejected" && !trimmedComments) {
            setWorkflowCommentError("Reject comments are required.");
            return;
        }

        try {
            handleCloseWorkflowDecision();
            showBusy(decision === "approved" ? "Approving workflow step..." : "Rejecting workflow step...");
            await WorkflowDecisionService.submitDecision(authorization, currentRun, decision, trimmedComments);
            await Promise.all([
                refresh(true),
                loadAuthorizationDetail(authorizationId, true)
            ]);
            showSuccess(decision === "approved" ? "Workflow step approved." : "Workflow step rejected and returned to the submitter.");
            window.setTimeout(() => hideSuccess(), 1600);
        } catch (error) {
            hideBusy();
            setDialogTitle("Workflow Action Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, authorizationId, currentRun, handleCloseWorkflowDecision, hideBusy, hideSuccess, loadAuthorizationDetail, refresh, showBusy, showSuccess, workflowComments, workflowDecision]);

    const handleUpdateDraft = React.useCallback((lineId: number, patch: Partial<ICompDraft>): void => {
        setCompDrafts((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                ...patch
            }
        }));
    }, []);

    const handleStartCompEdit = React.useCallback((line: ILaborLineItem): void => {
        setCompDrafts((prev) => ({
            ...prev,
            [line.Id]: toCompDraft(line)
        }));
        setCompOverrideDrafts((prev) => ({
            ...prev,
            [line.Id]: {
                standardRate: false,
                overtimeRate: false
            }
        }));
        setEditingCompLineIds((prev) => ({
            ...prev,
            [line.Id]: true
        }));
    }, []);

    const handleCancelCompEdit = React.useCallback((line: ILaborLineItem): void => {
        setCompDrafts((prev) => ({
            ...prev,
            [line.Id]: toCompDraft(line)
        }));
        setCompOverrideDrafts((prev) => ({
            ...prev,
            [line.Id]: getCompOverrideDraft(line)
        }));
        setEditingCompLineIds((prev) => ({
            ...prev,
            [line.Id]: false
        }));
    }, []);

    const handleRecalculateCompRates = React.useCallback((lineId: number): void => {
        setCompDrafts((prev) => {
            const annualSalary = parseNumberOrUndefined(prev[lineId]?.annualSalary);
            const derivedRates = getDerivedRatesFromSalary(annualSalary);

            return {
                ...prev,
                [lineId]: {
                    ...prev[lineId],
                    standardRate: formatCurrencyInputValue(derivedRates.standardRate),
                    overtimeRate: formatCurrencyInputValue(derivedRates.overtimeRate)
                }
            };
        });

        setCompOverrideDrafts((prev) => ({
            ...prev,
            [lineId]: {
                standardRate: false,
                overtimeRate: false
            }
        }));
    }, []);

    const handleAnnualSalaryChange = React.useCallback((lineId: number, rawValue: string): void => {
        const annualSalary = parseNumberOrUndefined(rawValue);
        const derivedRates = getDerivedRatesFromSalary(annualSalary);

        setCompDrafts((prev) => {
            const overrides = compOverrideDrafts[lineId] ?? { standardRate: false, overtimeRate: false };
            const effectiveStandardRate = overrides.standardRate
                ? parseNumberOrUndefined(prev[lineId]?.standardRate) ?? 0
                : derivedRates.standardRate;
            const nextDraft = {
                ...prev[lineId],
                annualSalary: normalizeDecimalInput(rawValue)
            };

            if (!overrides.standardRate) {
                nextDraft.standardRate = formatCurrencyInputValue(derivedRates.standardRate);
            }

            if (!overrides.overtimeRate) {
                nextDraft.overtimeRate = formatCurrencyInputValue(roundCurrency(effectiveStandardRate * 1.5));
            }

            return {
                ...prev,
                [lineId]: nextDraft
            };
        });
    }, [compOverrideDrafts]);

    const handleStandardRateChange = React.useCallback((lineId: number, rawValue: string): void => {
        const standardRate = parseNumberOrUndefined(rawValue);
        const overtimeRate = standardRate && standardRate > 0 ? roundCurrency(standardRate * 1.5) : 0;

        setCompOverrideDrafts((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                standardRate: true
            }
        }));

        setCompDrafts((prev) => {
            const overrides = compOverrideDrafts[lineId] ?? { standardRate: false, overtimeRate: false };
            const nextDraft = {
                ...prev[lineId],
                standardRate: normalizeDecimalInput(rawValue)
            };

            if (!overrides.overtimeRate) {
                nextDraft.overtimeRate = formatCurrencyInputValue(overtimeRate);
            }

            return {
                ...prev,
                [lineId]: nextDraft
            };
        });
    }, [compOverrideDrafts]);

    const handleOvertimeRateChange = React.useCallback((lineId: number, rawValue: string): void => {
        setCompOverrideDrafts((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                overtimeRate: true
            }
        }));

        handleUpdateDraft(lineId, { overtimeRate: normalizeDecimalInput(rawValue) });
    }, [handleUpdateDraft]);

    const handleCurrencyDraftBlur = React.useCallback((lineId: number, field: "annualSalary" | "standardRate" | "overtimeRate"): void => {
        setCompDrafts((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                [field]: formatCurrencyInputValue(prev[lineId]?.[field] ?? "")
            }
        }));
    }, []);

    const handleSaveComp = React.useCallback(async (line: ILaborLineItem): Promise<void> => {
        const draft = compDrafts[line.Id] ?? toCompDraft(line);

        try {
            showBusy("Saving labor compensation...");
            await LaborLineItemService.updateCompensation(line.Id, {
                annualSalary: parseNumberOrUndefined(draft.annualSalary),
                standardRate: parseNumberOrUndefined(draft.standardRate),
                overtimeRate: parseNumberOrUndefined(draft.overtimeRate),
                standardHours: parseNumberOrUndefined(draft.standardHours),
                overtimeHours: parseNumberOrUndefined(draft.overtimeHours)
            });
            await AuthorizationService.recalculateBaseAmounts(authorizationId);
            await Promise.all([
                refresh(true),
                loadAuthorizationDetail(authorizationId, true)
            ]);
            setEditingCompLineIds((prev) => ({
                ...prev,
                [line.Id]: false
            }));
            showSuccess("Labor compensation saved.");
            window.setTimeout(() => hideSuccess(), 1200);
        } catch (error) {
            hideBusy();
            setDialogTitle("Labor Save Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorizationId, compDrafts, hideBusy, hideSuccess, loadAuthorizationDetail, refresh, showBusy, showSuccess]);

    if (!authorization) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700}>Authorization not found</Typography>
                <Typography color="text.secondary">Refresh the app or return to the list and try again.</Typography>
            </Paper>
        );
    }

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.75}>
                    <Button startIcon={<ArrowBackOutlinedIcon />} onClick={handleBack} sx={{ alignSelf: "flex-start" }}>
                        Back
                    </Button>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        <Typography variant="h4" fontWeight={600}>{authorization.Title}</Typography>
                        <Chip label={authorizationStatusLabels[authorization.authorizationStatus]} color={getStatusChipColor(authorization.authorizationStatus)} />
                        {draftMod && <Chip label={`Mod ${draftMod.modNumber ?? ""} Draft`} color="secondary" />}
                        <Chip label={contractTypeLabels[authorization.contractType]} color="secondary" variant="outlined" />
                        {currentRun && <Chip label={`Workflow ${workflowRunStatusLabels[currentRun.runStatus]}`} color="info" variant="outlined" />}
                    </Stack>
                    <Typography color="text.secondary">
                        {authorization.contractName || "No contract title"} | {formatRelationship(authorization.donorEntity, authorization.receivingEntity)}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                    {canEditDraftMod ? (
                        <Button variant="contained" color="secondary" startIcon={<EditOutlinedIcon />} onClick={handleEditMod}>
                            Edit Mod
                        </Button>
                    ) : canInitiateMod ? (
                        <Button variant="contained" color="secondary" startIcon={<AccountTreeOutlinedIcon />} onClick={handleOpenInitiateMod}>
                            Initiate Mod
                        </Button>
                    ) : !draftMod ? (
                        <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={handleEdit}>
                            Edit
                        </Button>
                    ) : null}
                </Stack>
            </Stack>

            {draftMod && (
                <Alert severity="info">
                    {canEditDraftMod
                        ? `This authorization has Mod ${draftMod.modNumber ?? ""} in draft. Use Edit Mod to continue the modification before starting any other changes.`
                        : `This authorization has Mod ${draftMod.modNumber ?? ""} in draft, started by ${draftModOwnerName}. Base authorization editing is unavailable until that draft mod is submitted or discarded.`}
                </Alert>
            )}

            <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 8 }} sx={{ display: "flex", alignItems: "center" }}>
                        <Stepper
                            activeStep={stepperActiveStep}
                            alternativeLabel
                            sx={{
                                width: "100%",
                                "& .MuiStepLabel-label.Mui-active": { color: "secondary.main", fontWeight: 600 },
                                "& .MuiStepIcon-root.Mui-active": { color: "secondary.main" },
                                "& .MuiStepLabel-label.Mui-completed": { color: "text.primary", fontWeight: 600 },
                                "& .MuiStepIcon-root.Mui-completed": { color: "success.main" },
                                "& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line": { borderColor: "success.main" }
                            }}
                        >
                            {baseWorkflowSteps.map((step) => (
                                <Step key={step} completed={!!getStepAction(currentRunActions, step)}>
                                    <StepLabel>{workflowStepLabels[step]}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: "100%", borderColor: theme.palette.success.main }}>
                            <Stack direction={{ xs: "column", xl: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "stretch", xl: "flex-start" }}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="caption" color="text.secondary">Pending With</Typography>
                                    <Typography fontWeight={600}>{currentRun?.pendingApprover?.Title ?? "No active assignee"}</Typography>
                                    {/* <Typography variant="body2" color="text.secondary">
                                        {currentRun?.pendingRole ? workflowRoleLabels[currentRun.pendingRole] : "Workflow not active"}
                                    </Typography> */}
                                    {currentRun?.stepAssignedDate && currentRun.runStatus === "active" && (
                                        <Typography variant="caption" color="text.secondary">
                                            Pending since {formatDate(currentRun.stepAssignedDate, true)}
                                        </Typography>
                                    )}
                                </Box>
                                <Stack spacing={0.5} alignItems={{ xs: "stretch", xl: "flex-end" }} sx={{ minWidth: 0, maxWidth: "100%" }}>
                                    {workflowPermission.canAct && currentRun?.currentStepKey !== "submitter" && (
                                        <Stack direction={{ xs: "column", xl: "row" }} spacing={1} useFlexGap sx={{ width: { xs: "100%", xl: "auto" } }}>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                color="success"
                                                startIcon={<CheckCircleOutlineOutlinedIcon />}
                                                onClick={() => handleOpenWorkflowDecision("approved")}
                                                sx={{ width: { xs: "100%", xl: "auto" } }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={<CancelOutlinedIcon />}
                                                onClick={() => handleOpenWorkflowDecision("rejected")}
                                                sx={{ width: { xs: "100%", xl: "auto" } }}
                                            >
                                                Reject
                                            </Button>
                                        </Stack>
                                    )}
                                    {workflowPermission.actingFor && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            textAlign={{ xs: "left", xl: "right" }}
                                            sx={{ maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" }}
                                        >
                                            Acting on behalf of {workflowPermission.actingFor.Title}
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ px: 1, borderRadius: 3 }}>
                <BottomNavigation
                    showLabels
                    value={selectedTab}
                    onChange={(_event, value: DetailTab) => setSelectedTab(value)}
                    sx={(theme) => ({
                        gap: 0.75,
                        px: 1,
                        py: 1,
                        height: "auto",
                        justifyContent: "flex-start",
                        alignItems: "stretch",
                        flexWrap: "wrap",
                        backgroundColor: "transparent",
                        "& .MuiBottomNavigationAction-root": {
                            flex: "0 0 auto",
                            minWidth: "auto",
                            width: "auto",
                            maxWidth: 220,
                            px: 2,
                            py: 1.25,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                            color: theme.palette.text.secondary,
                            transition: "background-color 180ms ease, border-color 180ms ease, color 180ms ease",
                            "& .MuiBottomNavigationAction-label": {
                                fontSize: "0.82rem",
                                fontWeight: 500,
                                backgroundColor: "transparent",
                                opacity: 1
                            },
                            "& .MuiBottomNavigationAction-label.Mui-selected": {
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                backgroundColor: "transparent"
                            }
                        },
                        "& .MuiBottomNavigationAction-root.Mui-selected": {
                            color: theme.palette.text.primary,
                            borderColor: theme.palette.mode === "dark"
                                ? theme.palette.primary.main
                                : theme.palette.primary.light ?? theme.palette.primary.main,
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(0,183,255,0.18)"
                                : "rgba(10,49,77,0.1)",
                            boxShadow: theme.palette.mode === "dark"
                                ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
                                : "inset 0 0 0 1px rgba(255,255,255,0.35)"
                        }
                    })}
                >
                    {detailTabs.map((tab) => (
                        <BottomNavigationAction key={tab.value} value={tab.value} label={tab.label} />
                    ))}
                </BottomNavigation>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                {selectedTab === "summary" && <IwaSummaryTab authorization={authorization} />}
                {selectedTab === "resources" && (
                    <IwaResourcesLaborTab
                        canEditCompInHrReview={canEditCompInHrReview}
                        canEditCompLine={canEditCompLine}
                        compDrafts={compDrafts}
                        editingCompLineIds={editingCompLineIds}
                        handleAnnualSalaryChange={handleAnnualSalaryChange}
                        handleCancelCompEdit={handleCancelCompEdit}
                        handleCurrencyDraftBlur={handleCurrencyDraftBlur}
                        handleOvertimeRateChange={handleOvertimeRateChange}
                        handleRecalculateCompRates={handleRecalculateCompRates}
                        handleSaveComp={handleSaveComp}
                        handleStandardRateChange={handleStandardRateChange}
                        handleStartCompEdit={handleStartCompEdit}
                        handleUpdateDraft={handleUpdateDraft}
                        isFfpAuthorization={isFfpAuthorization}
                        laborDeltaTotal={laborDeltaTotal}
                        laborLines={laborLines}
                        laborTotals={laborTotals}
                        mayViewComp={mayViewComp}
                        resourceRosterRows={resourceRosterRows}
                        resources={resources}
                    />
                )}
                {selectedTab === "travel" && (
                    <IwaTravelOdcTab
                        travelDeltaTotal={travelDeltaTotal}
                        travelOdcs={travelOdcs}
                        travelTotal={travelTotal}
                    />
                )}
                {selectedTab === "workflow" && (
                    <IwaWorkflowTab
                        actions={actions}
                        authorization={authorization}
                        expandedRunId={expandedRunId}
                        isFfpAuthorization={isFfpAuthorization}
                        onExpandedRunChange={setExpandedRunId}
                        onOpenChangeDialog={setChangeDialog}
                        onOpenCommentDialog={setCommentDialog}
                        workflowRuns={workflowRuns}
                    />
                )}
                {selectedTab === "mods" && (
                    <IwaModsTab
                        laborLines={laborLines}
                        mods={mods}
                        resources={resources}
                        travelOdcs={travelOdcs}
                    />
                )}
                {selectedTab === "history" && <IwaHistoryTab actions={actions} />}
            </Paper>

            <AlertDialog open={dialogOpen} title={dialogTitle} message={dialogMessage} onClose={() => setDialogOpen(false)} />
            <Dialog open={!!workflowDecision} onClose={handleCloseWorkflowDecision} fullWidth maxWidth="sm">
                <DialogTitle>{workflowDialogDecision === "approved" ? "Approve Workflow Step" : "Reject Workflow Step"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {workflowDialogDecision === "approved"
                                ? "Approval comments are optional."
                                : "Reject comments are required and will be shown to the submitter."}
                        </Typography>
                        <TextField
                            label="Comments"
                            value={workflowComments}
                            onChange={(event) => {
                                setWorkflowComments(event.target.value);
                                if (workflowCommentError) {
                                    setWorkflowCommentError("");
                                }
                            }}
                            multiline
                            minRows={4}
                            error={!!workflowCommentError}
                            helperText={workflowCommentError || " "}
                            autoFocus
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseWorkflowDecision}>Cancel</Button>
                    <Button
                        variant="contained"
                        color={workflowDialogDecision === "approved" ? "success" : "error"}
                        onClick={handleSubmitWorkflowDecision}
                    >
                        {workflowDialogDecision === "approved" ? "Approve" : "Reject"}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={!!commentDialog} onClose={() => setCommentDialog(undefined)} fullWidth maxWidth="sm">
                <DialogTitle>{commentDialog?.title ?? "Workflow Comments"}</DialogTitle>
                <DialogContent>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{commentDialog?.comments ?? ""}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCommentDialog(undefined)}>Close</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={modifyPromptOpen} onClose={() => setModifyPromptOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Modify Authorization?</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        <Typography fontWeight={600}>Are you sure you want to modify this authorization?</Typography>
                        <Typography color="text.secondary">
                            At least one approver has already made a decision. If you continue, the approval workflow will be restarted when you submit your changes.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModifyPromptOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleConfirmModify}>Yes, continue</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={modPromptOpen} onClose={() => setModPromptOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Initiate Modification?</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        <Typography fontWeight={600}>Are you sure you want to initiate a modification?</Typography>
                        <Typography color="text.secondary">
                            This will create a new Mod record, start a new approval workflow, and take you directly to the edit form so you can make the proposed changes.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setModPromptOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="secondary" onClick={handleInitiateMod}>Yes, initiate Mod</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={!!changeDialog} onClose={() => setChangeDialog(undefined)} fullWidth maxWidth="md">
                <DialogTitle>Workflow Changes</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {changeDialogRun?.runType === "mod" ? (
                            <Alert severity="info">
                                {`An authorization Mod${changeDialogMod?.modNumber ? ` ${changeDialogMod.modNumber}` : ""} initiated this workflow run. To see the official modification details, open the Mods tab.`}
                            </Alert>
                        ) : formattedChangeSections.length === 0 ? (
                            <Typography color="text.secondary">No change details were captured.</Typography>
                        ) : formattedChangeSections.map((section) => (
                            <Box key={section.title}>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75 }}>{section.title}</Typography>
                                <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                                    {section.lines.map((line, index) => (
                                        <Typography key={`${section.title}-${index}`} component="li" color="text.secondary">
                                            {line.text}
                                            {line.delta && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ml: 0.75,
                                                        color: line.deltaDirection === "positive" ? "success.main" : "error.main",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    ({line.delta})
                                                </Box>
                                            )}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {changeDialogRun?.runType === "mod" && (
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AccountTreeOutlinedIcon />}
                            onClick={() => {
                                setChangeDialog(undefined);
                                setSelectedTab("mods");
                            }}
                        >
                            View Mods
                        </Button>
                    )}
                    <Button onClick={() => setChangeDialog(undefined)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
