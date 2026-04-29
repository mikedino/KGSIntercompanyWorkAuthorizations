import * as React from "react";
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, BottomNavigation, BottomNavigationAction, Box, Button, Chip, Grid, Paper, Stack, Step, StepLabel, Stepper, useTheme,
    Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import InputAdornment from "@mui/material/InputAdornment";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import { useHistory, useParams } from "react-router-dom";
import { IAuthorizationItem, ILaborLineItem, IPeoplePicker, IResourceItem, ITravelOdcItem, IWorkflowActionItem, IWorkflowRunItem, WorkflowStepKey, workflowStepLabels } from "../data/props";
import { useIwa } from "../data/iwaContext";
import { formatCurrency, formatCurrencyInputValue, formatDate, formatError, formatRelationship, normalizeDecimalInput, parseNumberOrUndefined, RELATIONSHIP_SEPARATOR } from "../common/utils";
import { authorizationStatusLabels, getStatusChipColor, workflowRunStatusLabels } from "../layout/allAuthorizationsUtils";
import { canEditCompensation, canViewCompensation } from "../resources/laborAccess";
import { resolveLaborCompensation } from "../resources/laborMath";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { useShellUi } from "../ui/ShellUiContext";
import AlertDialog from "../ui/Alert";
import { AuthorizationService } from "./iwaService";
import { WorkflowDecisionService } from "../workflow/decisionService";
import { getWorkflowActionPermission } from "../workflow/workflowAccess";
import { formatIwaChangePayload } from "../workflow/changeFormatter";
import { ModService } from "../mods/modService";

type DetailTab = "summary" | "resources" | "travel" | "workflow" | "mods" | "history";

const detailTabs: Array<{ value: DetailTab; label: string; }> = [
    { value: "summary", label: "Summary" },
    { value: "resources", label: "Resources & Labor" },
    { value: "travel", label: "Travel / ODC" },
    { value: "workflow", label: "Workflow" },
    { value: "mods", label: "Mods" },
    { value: "history", label: "History" }
];

const baseWorkflowSteps: WorkflowStepKey[] = ["submit", "pm", "hr", "ogPresident", "cfo"];

const contractTypeLabels: Record<IAuthorizationItem["contractType"], string> = {
    tm: "T&M",
    ffp: "FFP"
};

const getActiveModDraftSessionKey = (authorizationId: number): string => `iwa:activeModDraft:${authorizationId}`;

interface ICompDraft {
    annualSalary: string;
    standardRate: string;
    overtimeRate: string;
    standardHours: string;
    overtimeHours: string;
}

interface ICompOverrideDraft {
    standardRate: boolean;
    overtimeRate: boolean;
}

const toCompDraft = (line: ILaborLineItem): ICompDraft => ({
    annualSalary: formatCurrencyInputValue(line.annualSalary),
    standardRate: formatCurrencyInputValue(line.standardRate),
    overtimeRate: formatCurrencyInputValue(line.overtimeRate),
    standardHours: line.standardHours ? String(line.standardHours) : "",
    overtimeHours: line.overtimeHours ? String(line.overtimeHours) : ""
});

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const isSameCurrency = (left?: number, right?: number): boolean => {
    return Math.abs(Number(left ?? 0) - Number(right ?? 0)) < 0.01;
};

const getCompOverrideDraft = (line: ILaborLineItem): ICompOverrideDraft => {
    const annualSalary = Number(line.annualSalary ?? 0);
    const standardRate = Number(line.standardRate ?? 0);
    const overtimeRate = Number(line.overtimeRate ?? 0);
    const derivedStandardRate = annualSalary > 0 ? roundCurrency(annualSalary / 2080) : 0;
    const effectiveStandardRate = standardRate > 0 ? standardRate : derivedStandardRate;
    const derivedOvertimeRate = effectiveStandardRate > 0 ? roundCurrency(effectiveStandardRate * 1.5) : 0;

    return {
        standardRate: standardRate > 0 && !isSameCurrency(standardRate, derivedStandardRate),
        overtimeRate: overtimeRate > 0 && !isSameCurrency(overtimeRate, derivedOvertimeRate)
    };
};

const getDerivedRatesFromSalary = (annualSalary: number | undefined): { standardRate: number; overtimeRate: number } => {
    const standardRate = annualSalary && annualSalary > 0 ? roundCurrency(annualSalary / 2080) : 0;

    return {
        standardRate,
        overtimeRate: roundCurrency(standardRate * 1.5)
    };
};

const compactNumberInputSx = {
    width: 68,
    "& input": {
        textAlign: "right"
    }
};

const compactCurrencyInputSx = {
    width: 102,
    "& input": {
        textAlign: "right"
    }
};

const quietTableSx = {
    "& thead tr": {
        bgcolor: "background.default"
    },
    "& th": {
        fontWeight: 600,
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& td": {
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& tbody tr:last-child td": {
        borderBottom: 0
    }
};

const totalsRowSx = {
    "& td": {
        fontWeight: 600,
        fontStyle: "italic"
    }
};

const getCurrentStepIndex = (run?: IWorkflowRunItem): number => {
    if (!run) {
        return 0;
    }

    const index = baseWorkflowSteps.indexOf(run.currentStepKey);
    return index >= 0 ? index : 0;
};

const getStepAction = (actions: IWorkflowActionItem[], step: WorkflowStepKey): IWorkflowActionItem | undefined => {
    if (step === "submit") {
        return actions.find((action) => action.stepKey === step && (action.actionType === "submitted" || action.actionType === "modified"));
    }

    if (step === "submitter") {
        return actions.find((action) => action.stepKey === step && (action.actionType === "returned" || action.actionType === "restarted"));
    }

    return actions.find((action) => action.stepKey === step && (action.actionType === "approved" || action.actionType === "rejected"));
};

const getResourceNamesForLabor = (line: ILaborLineItem, resources: IResourceItem[]): string => {
    const ids = line.resources?.results?.map((resource) => resource.Id) ?? [];
    const names = ids
        .map((id) => resources.find((resource) => resource.Id === id)?.employee?.Title)
        .filter(Boolean) as string[];

    return names.length ? names.join(", ") : "—";
};

const getLaborForResource = (resource: IResourceItem, laborLines: ILaborLineItem[]): ILaborLineItem | undefined => {
    return laborLines.find((line) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id));
};

const getWorkflowStepApprover = (
    step: WorkflowStepKey,
    authorization: IAuthorizationItem,
    run?: IWorkflowRunItem
): IPeoplePicker | undefined => {
    switch (step) {
        case "pm":
            return authorization.pm;
        case "hr":
            return run?.hr;
        case "ogPresident":
            return run?.ogPresident;
        case "cfo":
            return run?.cfo;
        case "submit":
        case "submitter":
        default:
            return authorization.Author;
    }
};

const getWorkflowActionChipColor = (
    action?: IWorkflowActionItem,
    isCurrent?: boolean,
    skipped?: boolean
): "default" | "success" | "warning" | "error" | "info" => {
    if (skipped) {
        return "default";
    }

    if (isCurrent) {
        return "warning";
    }

    if (action?.actionType === "approved" || action?.actionType === "submitted" || action?.actionType === "modified") {
        return "success";
    }

    if (action?.actionType === "rejected") {
        return "error";
    }

    if (action?.actionType === "returned") {
        return "warning";
    }

    return "info";
};

const getMissingCompensationMessage = (
    authorization: IAuthorizationItem | undefined,
    run: IWorkflowRunItem | undefined,
    laborLines: ILaborLineItem[]
): string | undefined => {
    if (!authorization || !run) {
        return undefined;
    }

    const requiresCompensationCheck =
        (authorization.contractType === "tm" && run.currentStepKey === "hr") ||
        (authorization.contractType === "ffp" && run.currentStepKey === "pm");

    if (!requiresCompensationCheck) {
        return undefined;
    }

    const hasMissingTotal = laborLines.length === 0 || laborLines.some((line) => Number(line.totalAmount ?? 0) <= 0);

    if (!hasMissingTotal) {
        return undefined;
    }

    return authorization.contractType === "tm"
        ? "HR must enter compensation before approving this T&M authorization. Each labor line needs a Total Amount greater than $0."
        : "The lump sum amount must be entered before approving this FFP authorization. Each labor line needs a Total Amount greater than $0.";
};

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
    const laborLines = laborLinesByAuthorizationId.get(authorizationId) ?? [];
    const travelOdcs = travelOdcsByAuthorizationId.get(authorizationId) ?? [];
    const mods = modsByAuthorizationId.get(authorizationId) ?? [];
    const mayViewComp = canViewCompensation(currentUser, authorization);
    const mayEditComp = canEditCompensation(currentUser);
    const isFfpAuthorization = authorization?.contractType === "ffp";
    const canEditCompInHrReview = mayEditComp && currentRun?.runStatus === "active" && currentRun.currentStepKey === "hr";
    const workflowDialogDecision = workflowDecision ?? workflowDialogMode;
    const activeStep = getCurrentStepIndex(currentRun);
    const stepperActiveStep = currentRun?.runStatus === "completed" ? -1 : activeStep;
    const workflowPermission = React.useMemo(() => {
        return getWorkflowActionPermission(currentRun, currentUser, appUsers);
    }, [appUsers, currentRun, currentUser]);
    const hasActiveWorkflowRun = React.useMemo(() => {
        return workflowRuns.some((run) => run.runStatus === "active");
    }, [workflowRuns]);
    const canInitiateMod = !!authorization && authorization.authorizationStatus === "approved" && !hasActiveWorkflowRun;
    const laborTotals = React.useMemo(() => {
        return laborLines.reduce((totals, line) => ({
            standardHours: totals.standardHours + Number(line.standardHours ?? 0),
            overtimeHours: totals.overtimeHours + Number(line.overtimeHours ?? 0),
            totalAmount: totals.totalAmount + Number(line.totalAmount ?? 0)
        }), { standardHours: 0, overtimeHours: 0, totalAmount: 0 });
    }, [laborLines]);
    const travelTotal = React.useMemo(() => {
        return travelOdcs.reduce((total, line) => total + Number(line.amount ?? 0), 0);
    }, [travelOdcs]);
    const formattedChangeSections = React.useMemo(() => {
        return formatIwaChangePayload(changeDialog?.changePayloadJson, changeDialog?.changeSummary);
    }, [changeDialog]);

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

        if (currentRun?.hasDecision) {
            setModifyPromptOpen(true);
            return;
        }

        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: `/authorizations/view/${authorization.Id}`
        });
    }, [authorization, currentRun?.hasDecision, history]);

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

    const summaryTab = (
        <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                    <Typography variant="subtitle2" fontWeight={600}>Contract</Typography>
                    <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                        {[
                            ["Contract ID", authorization.contractId || "—"],
                            ["Contract Name", authorization.contractName || "—"],
                            ["Invoice / Task Order", authorization.invoice || "Not specified"],
                            ["Project Manager", authorization.pm?.Title || "—"],
                            ["Period", `${formatDate(authorization.periodStart, false)} - ${formatDate(authorization.periodEnd, false)}`]
                        ].map(([label, value]) => (
                            <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                                <Typography fontWeight={500}>{value}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                    <Typography variant="subtitle2" fontWeight={600}>Entities / Organization</Typography>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Entities</Typography>
                            <Typography fontWeight={500}>
                                {authorization.donorEntity || "—"} <Box component="span" sx={{ color: "secondary.main" }}>{RELATIONSHIP_SEPARATOR}</Box> {authorization.receivingEntity || "—"}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Operating Group / LOB</Typography>
                            <Typography fontWeight={500}>{authorization.og || "—"} | {authorization.lob || "—"}</Typography>
                        </Box>
                    </Stack>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                    <Typography variant="subtitle2" fontWeight={600}>Labor Costs</Typography>
                    <Grid container spacing={1.25} sx={{ mt: 0.25 }}>
                        {[
                            ["Base Labor", authorization.baseLaborAmount],
                            ["Base Travel / ODC", authorization.baseTravelAmount],
                            ["Base Grand Total", authorization.baseGrandTotal],
                            ["Approved Labor", authorization.approvedLaborAmount],
                            ["Approved Travel / ODC", authorization.approvedTravelAmount],
                            ["Approved Grand Total", authorization.approvedGrandTotal]
                        ].map(([label, value]) => (
                            <Grid key={String(label)} size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                                <Typography fontWeight={600}>{formatCurrency(Number(value ?? 0))}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Scope of Work</Typography>
                    <Typography color="text.secondary">{authorization.scopeOfWork || "—"}</Typography>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>Justification</Typography>
                    <Typography color="text.secondary">{authorization.justification || "—"}</Typography>
                </Paper>
            </Grid>
        </Grid>
    );

    const resourcesTab = (
        <Stack spacing={2}>
            {canEditCompInHrReview && !isFfpAuthorization && (
                <Alert severity="info">
                    Only HR, current PM and Admins can view salary information. Std rate is derived from salary ÷ 2080 unless HR/Admin overrides the rate fields.
                </Alert>
            )}
            <TableContainer>
                <Table size="small" sx={quietTableSx}>
                    <TableHead>
                        <TableRow>
                            {isFfpAuthorization ? (
                                <>
                                    <TableCell>Job ID</TableCell>
                                    <TableCell>Charging Period</TableCell>
                                    <TableCell align="right">Periods</TableCell>
                                    <TableCell>Resources</TableCell>
                                </>
                            ) : (
                                <>
                                    <TableCell>Employee / Resource</TableCell>
                                    <TableCell>State</TableCell>
                                    <TableCell>Job ID</TableCell>
                                    <TableCell>Labor Category</TableCell>
                                    <TableCell align="right">Std Hrs</TableCell>
                                    <TableCell align="right">OT Hrs</TableCell>
                                    {mayViewComp && <TableCell align="right">Salary</TableCell>}
                                    {mayViewComp && <TableCell align="right">Std Rate</TableCell>}
                                    {mayViewComp && <TableCell align="right">OT Rate</TableCell>}
                                </>
                            )}
                            <TableCell align="right">{isFfpAuthorization ? "Total Amount" : "Total"}</TableCell>
                            {canEditCompInHrReview && !isFfpAuthorization && <TableCell align="right">Action</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {laborLines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isFfpAuthorization ? 5 : canEditCompInHrReview ? 11 : mayViewComp ? 10 : 7}>No labor lines found.</TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {laborLines.map((line) => {
                                    if (isFfpAuthorization) {
                                        return (
                                            <TableRow key={line.Id} hover>
                                                <TableCell>{line.jobId || "—"}</TableCell>
                                                <TableCell>{line.chargingPeriod || "—"}</TableCell>
                                                <TableCell align="right">{line.periodQty ?? "—"}</TableCell>
                                                <TableCell>{getResourceNamesForLabor(line, resources)}</TableCell>
                                                <TableCell align="right">{formatCurrency(line.totalAmount)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    const lineResource = resources.find((resource) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id));
                                    const draft = compDrafts[line.Id] ?? toCompDraft(line);
                                    const isEditingComp = canEditCompInHrReview && !!editingCompLineIds[line.Id];
                                    const preview = resolveLaborCompensation({
                                        annualSalary: parseNumberOrUndefined(draft.annualSalary),
                                        standardRate: parseNumberOrUndefined(draft.standardRate),
                                        overtimeRate: parseNumberOrUndefined(draft.overtimeRate),
                                        standardHours: parseNumberOrUndefined(draft.standardHours),
                                        overtimeHours: parseNumberOrUndefined(draft.overtimeHours)
                                    });

                                    return (
                                        <TableRow key={line.Id} hover>
                                            <TableCell>{getResourceNamesForLabor(line, resources)}</TableCell>
                                            <TableCell>{line.pricingType === "tm" ? lineResource?.state ?? "—" : "Multiple"}</TableCell>
                                            <TableCell>{line.jobId || "—"}</TableCell>
                                            <TableCell>{lineResource?.laborCategory || "—"}</TableCell>
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <TextField size="small" value={draft.standardHours} onChange={(event) => handleUpdateDraft(line.Id, { standardHours: normalizeDecimalInput(event.target.value) })} sx={compactNumberInputSx} />
                                                ) : line.standardHours ?? "—"}
                                            </TableCell>
                                            <TableCell align="right">
                                                {isEditingComp ? (
                                                    <TextField size="small" value={draft.overtimeHours} onChange={(event) => handleUpdateDraft(line.Id, { overtimeHours: normalizeDecimalInput(event.target.value) })} sx={compactNumberInputSx} />
                                                ) : line.overtimeHours ?? "—"}
                                            </TableCell>
                                            {mayViewComp && (
                                                <TableCell align="right">
                                                    {isEditingComp ? (
                                                        <TextField
                                                            size="small"
                                                            value={draft.annualSalary}
                                                            onChange={(event) => handleAnnualSalaryChange(line.Id, event.target.value)}
                                                            onBlur={() => handleCurrencyDraftBlur(line.Id, "annualSalary")}
                                                            sx={compactCurrencyInputSx}
                                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                        />
                                                    ) : formatCurrency(line.annualSalary)}
                                                </TableCell>
                                            )}
                                            {mayViewComp && (
                                                <TableCell align="right">
                                                    {isEditingComp ? (
                                                        <TextField
                                                            size="small"
                                                            value={draft.standardRate || formatCurrencyInputValue(preview.standardRate)}
                                                            onChange={(event) => handleStandardRateChange(line.Id, event.target.value)}
                                                            onBlur={() => handleCurrencyDraftBlur(line.Id, "standardRate")}
                                                            sx={compactCurrencyInputSx}
                                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                        />
                                                    ) : formatCurrency(line.standardRate)}
                                                </TableCell>
                                            )}
                                            {mayViewComp && (
                                                <TableCell align="right">
                                                    {isEditingComp ? (
                                                        <TextField
                                                            size="small"
                                                            value={draft.overtimeRate || formatCurrencyInputValue(preview.overtimeRate)}
                                                            onChange={(event) => handleOvertimeRateChange(line.Id, event.target.value)}
                                                            onBlur={() => handleCurrencyDraftBlur(line.Id, "overtimeRate")}
                                                            sx={compactCurrencyInputSx}
                                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                                                        />
                                                    ) : formatCurrency(line.overtimeRate)}
                                                </TableCell>
                                            )}
                                            <TableCell align="right">{formatCurrency(isEditingComp ? preview.totalAmount : line.totalAmount)}</TableCell>
                                            {canEditCompInHrReview && (
                                                <TableCell align="right">
                                                    {isEditingComp ? (
                                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                            <Tooltip title="Recalculate rates from salary">
                                                                <Button size="small" startIcon={<CalculateOutlinedIcon />} onClick={() => handleRecalculateCompRates(line.Id)}>
                                                                    Recalc
                                                                </Button>
                                                            </Tooltip>
                                                            <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={() => handleSaveComp(line)}>
                                                                Save
                                                            </Button>
                                                            <Button size="small" onClick={() => handleCancelCompEdit(line)}>
                                                                Cancel
                                                            </Button>
                                                        </Stack>
                                                    ) : (
                                                        <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => handleStartCompEdit(line)}>
                                                            Edit
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                                {laborLines.length > 1 && (
                                    <TableRow sx={totalsRowSx}>
                                        <TableCell colSpan={isFfpAuthorization ? 4 : 4}>Totals</TableCell>
                                        {!isFfpAuthorization && <TableCell align="right">{laborTotals.standardHours || "—"}</TableCell>}
                                        {!isFfpAuthorization && <TableCell align="right">{laborTotals.overtimeHours || "—"}</TableCell>}
                                        {!isFfpAuthorization && mayViewComp && <TableCell />}
                                        {!isFfpAuthorization && mayViewComp && <TableCell />}
                                        {!isFfpAuthorization && mayViewComp && <TableCell />}
                                        <TableCell align="right">{formatCurrency(laborTotals.totalAmount)}</TableCell>
                                        {!isFfpAuthorization && canEditCompInHrReview && <TableCell />}
                                    </TableRow>
                                )}
                            </>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box>
                <Typography variant="subtitle2" fontWeight={600}>Resource Roster</Typography>
                <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {resources.map((resource) => {
                        const labor = getLaborForResource(resource, laborLines);
                        const modLabels = labor ? ["BASE"] : [];
                        return (
                            <Grid key={resource.Id} size={{ xs: 12, md: 6, xl: 4 }}>
                                <Paper sx={{ p: 1.5, height: "100%" }}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                        <Typography fontWeight={600}>{resource.employee?.Title ?? "—"}</Typography>
                                        <Stack direction="row" spacing={0.5}>
                                            {modLabels.map((label) => (
                                                <Chip key={label} label={label} size="small" color="secondary" variant="outlined" />
                                            ))}
                                        </Stack>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">{resource.employee?.EMail ?? ""}</Typography>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
        </Stack>
    );

    const travelTab = (
        <TableContainer>
            <Table size="small" sx={quietTableSx}>
                <TableHead>
                    <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Job ID</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Comments</TableCell>
                        <TableCell align="right">Amount</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {travelOdcs.length === 0 ? (
                        <TableRow><TableCell colSpan={5}>No travel or ODC lines found.</TableCell></TableRow>
                    ) : (
                        <>
                            {travelOdcs.map((line: ITravelOdcItem) => (
                                <TableRow key={line.Id}>
                                    <TableCell>{line.lineType.toUpperCase()}</TableCell>
                                    <TableCell>{line.jobId || "—"}</TableCell>
                                    <TableCell>{line.description || "—"}</TableCell>
                                    <TableCell>{line.comments || "—"}</TableCell>
                                    <TableCell align="right">{formatCurrency(line.amount)}</TableCell>
                                </TableRow>
                            ))}
                            {travelOdcs.length > 1 && (
                                <TableRow sx={totalsRowSx}>
                                    <TableCell colSpan={4}>Totals</TableCell>
                                    <TableCell align="right">{formatCurrency(travelTotal)}</TableCell>
                                </TableRow>
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );

    const workflowTab = (
        <Stack spacing={2}>
            {workflowRuns.length === 0 ? (
                <Typography color="text.secondary">No workflow runs found.</Typography>
            ) : workflowRuns.map((run) => {
                const runActions = actions.filter((action) => action.workflowRun?.Id === run.Id);
                const runSteps: WorkflowStepKey[] = run.currentStepKey === "submitter" || runActions.some((action) => action.stepKey === "submitter")
                    ? [...baseWorkflowSteps, "submitter"]
                    : baseWorkflowSteps;
                const modifiedAction = runActions.find((action) => action.actionType === "modified" && (!!action.changeSummary || !!action.changePayloadJson));

                return (
                    <Accordion
                        key={run.Id}
                        expanded={expandedRunId === run.Id}
                        onChange={(_event, expanded) => setExpandedRunId(expanded ? run.Id : false)}
                        disableGutters
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: "8px !important",
                            bgcolor: "background.paper",
                            "&:before": { display: "none" }
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ width: "100%", pr: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant="h6" fontWeight={600}>Run {run.runNumber ?? "-"}</Typography>
                                    <Chip label={workflowRunStatusLabels[run.runStatus]} size="small" color={run.runStatus === "active" ? "info" : run.runStatus === "completed" ? "success" : "default"} variant={run.runStatus === "superseded" ? "outlined" : "filled"} />
                                    {modifiedAction && (
                                        <Button
                                            size="small"
                                            startIcon={<SummarizeOutlinedIcon />}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setChangeDialog(modifiedAction);
                                            }}
                                        >
                                            Changes
                                        </Button>
                                    )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    {run.completedOn ? `Completed ${formatDate(run.completedOn, true)}` : `Started ${formatDate(run.Created, true)}`}
                                </Typography>
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            <Stack spacing={1.5}>
                                {runSteps.map((step) => {
                                    const action = getStepAction(runActions, step);
                                    const isCurrent = run.currentStepKey === step && run.runStatus === "active";
                                    const rejectedStepIndex = runSteps.findIndex((candidate) => getStepAction(runActions, candidate)?.actionType === "rejected");
                                    const stepIndex = runSteps.indexOf(step);
                                    const skippedAfterRejection = rejectedStepIndex >= 0 && stepIndex > rejectedStepIndex && !action && step !== "submitter";
                                    const skippedForFfpHr = step === "hr" && isFfpAuthorization;
                                    const skipped = (step === "pm" && run.skipPmStep === true) || skippedForFfpHr || skippedAfterRejection;
                                    const label = workflowStepLabels[step];
                                    const approver = getWorkflowStepApprover(step, authorization, run);
                                    const completedBy = action?.actionBy?.Title ?? (action ? "System" : "");
                                    const actedOnBehalf = action?.actionBy?.Id && approver?.Id && action.actionBy.Id !== approver.Id && step !== "submit";
                                    const statusLabel = skipped
                                        ? "Skipped"
                                        : isCurrent
                                            ? "Pending"
                                            : action
                                                ? action.actionType === "submitted"
                                                    ? "Submitted"
                                                    : action.actionType === "modified"
                                                        ? "Modified"
                                                        : action.actionType === "approved"
                                                            ? "Approved"
                                                            : action.actionType === "returned"
                                                                ? "Returned"
                                                                : action.actionType === "restarted"
                                                                    ? "Restarted"
                                                                    : "Rejected"
                                                : "Queued";

                                    return (
                                        <Stack key={`${run.Id}-${step}`} direction="row" spacing={1.5} alignItems="stretch">
                                            <Stack alignItems="center" sx={{ pt: 0.5 }}>
                                                <Box
                                                    sx={(theme) => ({
                                                        width: 14,
                                                        height: 14,
                                                        borderRadius: "50%",
                                                        bgcolor: isCurrent ? theme.palette.warning.main : skipped ? theme.palette.divider : action ? theme.palette.success.main : theme.palette.divider,
                                                        border: `2px solid ${theme.palette.background.paper}`
                                                    })}
                                                />
                                                {stepIndex !== runSteps.length - 1 && (
                                                    <Box sx={{ width: 2, flex: 1, minHeight: 34, bgcolor: "divider", mt: 0.5 }} />
                                                )}
                                            </Stack>
                                            <Paper
                                                variant="outlined"
                                                sx={{
                                                    p: 1.75,
                                                    flex: 1,
                                                    borderColor: isCurrent ? "secondary.main" : "divider",
                                                    bgcolor: isCurrent ? "action.hover" : "background.paper"
                                                }}
                                            >
                                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                                                    <Box>
                                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                                            <Typography fontWeight={600}>{label}</Typography>
                                                            {action && !!action.comments && (
                                                                <Tooltip title="View comments">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="secondary"
                                                                        onClick={() => setCommentDialog({ title: `${label} Comments`, comments: action.comments ?? "" })}
                                                                        sx={{ p: 0.25 }}
                                                                    >
                                                                        <ChatBubbleOutlineOutlinedIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {actedOnBehalf ? `${completedBy} on behalf of ${approver?.Title ?? "the assigned approver"}` : approver?.Title ?? "No approver assigned"}
                                                        </Typography>
                                                    </Box>
                                                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                        <Stack spacing={0.5} alignItems="flex-end">
                                                            <Chip label={statusLabel} color={getWorkflowActionChipColor(action, isCurrent, skipped)} size="small" variant={skipped || !action && !isCurrent ? "outlined" : "filled"} />
                                                            {isCurrent && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatDate(run.stepAssignedDate, true)}
                                                                </Typography>
                                                            )}
                                                            {action && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatDate(action.actionDate, true)}
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    </Stack>
                                                </Stack>

                                                <Stack spacing={1}>
                                                    {step === "pm" && skipped && run.skipPmStep && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            This step was skipped because the PM was the submitter
                                                        </Typography>
                                                    )}
                                                    {step === "hr" && skippedForFfpHr && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            HR Review is not required for FFP contracts.
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Paper>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Stack>
    );

    const historyTab = (
        <TableContainer>
            <Table size="small" sx={quietTableSx}>
                <TableHead>
                    <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Step</TableCell>
                        <TableCell>By</TableCell>
                        <TableCell>Comments</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {actions.length === 0 ? (
                        <TableRow><TableCell colSpan={5}>No workflow actions found.</TableCell></TableRow>
                    ) : actions.map((action) => (
                        <TableRow key={action.Id}>
                            <TableCell>{formatDate(action.actionDate, true)}</TableCell>
                            <TableCell>{action.actionType}</TableCell>
                            <TableCell>{workflowStepLabels[action.stepKey] ?? action.stepKey}</TableCell>
                            <TableCell>{action.actionBy?.Title ?? "—"}</TableCell>
                            <TableCell>{action.comments || action.skipReason || "—"}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

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
                        <Chip label={contractTypeLabels[authorization.contractType]} color="secondary" variant="outlined" />
                        {currentRun && <Chip label={`Workflow ${workflowRunStatusLabels[currentRun.runStatus]}`} color="info" variant="outlined" />}
                    </Stack>
                    <Typography color="text.secondary">
                        {authorization.contractName || "No contract title"} | {formatRelationship(authorization.donorEntity, authorization.receivingEntity)}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                    {canInitiateMod ? (
                        <Button variant="contained" color="secondary" startIcon={<AccountTreeOutlinedIcon />} onClick={handleOpenInitiateMod}>
                            Initiate Mod
                        </Button>
                    ) : (
                        <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={handleEdit}>
                            Edit
                        </Button>
                    )}
                </Stack>
            </Stack>

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
                {selectedTab === "summary" && summaryTab}
                {selectedTab === "resources" && resourcesTab}
                {selectedTab === "travel" && travelTab}
                {selectedTab === "workflow" && workflowTab}
                {selectedTab === "mods" && (
                    <Typography color="text.secondary">{mods.length ? `${mods.length} mod(s) loaded. Mod drill-in is next.` : "No mods found for this authorization."}</Typography>
                )}
                {selectedTab === "history" && historyTab}
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
                        {formattedChangeSections.length === 0 ? (
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
                    <Button onClick={() => setChangeDialog(undefined)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
};
