import * as React from "react";
import { flushSync } from "react-dom";
import {
    Alert, BottomNavigation, BottomNavigationAction, Box, Button, Chip, Grid, Paper, Stack, Step, StepIcon, StepLabel, Stepper, SvgIcon, Tooltip, useTheme,
    Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { pdf } from "@react-pdf/renderer";
import { Web } from "gd-sprest";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { IAuthorizationItem, ILaborLineItem, IModItem, IWorkflowActionItem, IWorkflowRunItem, workflowStepLabels } from "../data/props";
import { useIwa } from "../data/iwaContext";
import { DataSource } from "../data/ds";
import Strings from "../common/strings";
import { formatCurrencyInputValue, formatDate, formatError, formatRelationship, markWorkflowListsStale, normalizeDecimalInput, parseNumberOrUndefined } from "../common/utils";
import { authorizationStatusLabels, getStatusChipColor, modStatusLabels, workflowRunStatusLabels } from "../layout/allAuthorizationsUtils";
import { canEditCompensation } from "../resources/laborAccess";
import { ResourceService } from "../resources/resourceService";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";
import { useShellUi } from "../ui/ShellUiContext";
import AlertDialog from "../ui/Alert";
import { ConfirmDeleteDialog } from "../admin/ConfirmDeleteDialog";
import { canUserEditAuthorization } from "./authorizationEditAccess";
import { canCancelMod, canDeleteAuthorization } from "./authorizationDeleteAccess";
import { AuthorizationService } from "./iwaService";
import { WorkflowDecisionService } from "../workflow/decisionService";
import { WorkflowService } from "../workflow/workflowService";
import { getWorkflowActionPermission } from "../workflow/workflowAccess";
import { formatIwaChangePayload } from "../workflow/changeFormatter";
import { ModService } from "../mods/modService";
import { buildIwaExportViewModel } from "./export/exportViewModel";
import { IwaExportPdfDocument } from "./export/IwaExportPdfDocument";
import { IwaExportService } from "./export/iwaExportService";
import { canViewFinancialAmounts } from "./financialAccess";
import { IwaHistoryTab } from "./view/IwaHistoryTab";
import { IwaModsTab } from "./view/IwaModsTab";
import { IwaResourcesLaborTab } from "./view/IwaResourcesLaborTab";
import { IwaSummaryTab } from "./view/IwaSummaryTab";
import { IViewAttachmentItem } from "./view/IwaSummaryTab";
import { IwaTravelOdcTab } from "./view/IwaTravelOdcTab";
import { IwaWorkflowTab } from "./view/IwaWorkflowTab";
import {
    baseWorkflowSteps,
    DetailTab,
    detailTabs,
    getActiveModDraftSessionKey,
    getCompOverrideDraft,
    getCurrentStepIndex,
    getDerivedRatesFromSalary,
    formatModLabel,
    getLaborDisplayName,
    getMissingCompensationMessage,
    getModScopeLabel,
    getResourceDisplayName,
    getStepAction,
    ICompDraft,
    ICompOverrideDraft,
    isFallbackResourceEmployee,
    roundCurrency,
    toCompDraft
} from "./view/iwaViewUtils";

const deleteSuccessDurationMs = 7000;

export const IwaDetailPage: React.FC = (): JSX.Element => {
    const history = useHistory();
    const location = useLocation();
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
        clearAuthorizationDetailCache,
        loadAuthorizationDetail,
        modsByAuthorizationId,
        patchAuthorization,
        reloadAuthorizationDetailSections,
        resourcesByAuthorizationId,
        refresh,
        runByAuthorizationId,
        runsByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();

    const getRequestedTab = React.useCallback((): DetailTab => {
        const tab = new URLSearchParams(location.search).get("tab");
        const requestedTab = detailTabs.find((item) => item.value === tab);

        return requestedTab?.value ?? "summary";
    }, [location.search]);

    const [selectedTab, setSelectedTab] = React.useState<DetailTab>(() => getRequestedTab());
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
    const [iwaJamisProjectIdDraft, setIwaJamisProjectIdDraft] = React.useState<string>("");
    const [iwaJamisProjectIdError, setIwaJamisProjectIdError] = React.useState<string>("");
    const [commentDialog, setCommentDialog] = React.useState<{ title: string; comments: string } | undefined>(undefined);
    const [changeDialog, setChangeDialog] = React.useState<IWorkflowActionItem | undefined>(undefined);
    const [modifyPromptOpen, setModifyPromptOpen] = React.useState<boolean>(false);
    const [modPromptOpen, setModPromptOpen] = React.useState<boolean>(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState<boolean>(false);
    const [deleteError, setDeleteError] = React.useState<string>("");
    const [deleteBusy, setDeleteBusy] = React.useState<boolean>(false);
    const [cancelModConfirmOpen, setCancelModConfirmOpen] = React.useState<boolean>(false);
    const [cancelModError, setCancelModError] = React.useState<string>("");
    const [cancelModBusy, setCancelModBusy] = React.useState<boolean>(false);
    const [expandedRunId, setExpandedRunId] = React.useState<number | false>(false);
    const [attachments, setAttachments] = React.useState<IViewAttachmentItem[]>([]);
    const theme = useTheme();

    const authorization = React.useMemo<IAuthorizationItem | undefined>(() => {
        return [...authorizations, ...draftAuthorizations].find((item) => item.Id === authorizationId);
    }, [authorizationId, authorizations, draftAuthorizations]);
    const detailReturnTo = React.useMemo<string>(() => {
        return `/authorizations/view/${authorizationId}${location.search || ""}`;
    }, [authorizationId, location.search]);

    const detailRuns = React.useMemo<IWorkflowRunItem[]>(() => {
        return runsByAuthorizationId.get(authorizationId) ?? [];
    }, [authorizationId, runsByAuthorizationId]);
    const currentRun = React.useMemo<IWorkflowRunItem | undefined>(() => {
        if (detailRuns.length > 0) {
            return detailRuns.find((run) => run.runStatus === "active") ?? detailRuns[0];
        }

        return runByAuthorizationId.get(authorizationId);
    }, [authorizationId, detailRuns, runByAuthorizationId]);
    const workflowRuns = React.useMemo<IWorkflowRunItem[]>(() => {
        const runs = detailRuns.length > 0 ? detailRuns : currentRun ? [currentRun] : [];
        return [...runs].sort((left, right) => (left.runNumber ?? 0) - (right.runNumber ?? 0));
    }, [currentRun, detailRuns]);
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
    const latestMod = React.useMemo(() => {
        return [...mods].sort((left, right) => {
            if ((right.modNumber ?? 0) !== (left.modNumber ?? 0)) {
                return (right.modNumber ?? 0) - (left.modNumber ?? 0);
            }

            return Date.parse(right.Created ?? "") - Date.parse(left.Created ?? "");
        })[0];
    }, [mods]);
    const headerModLabel = latestMod || (authorization?.modCount ?? 0) > 0
        ? formatModLabel(latestMod?.modNumber ?? authorization?.modCount)
        : undefined;

    React.useEffect(() => {
        if (!authorizationId || Number.isNaN(authorizationId)) {
            setAttachments([]);
            return;
        }

        let isActive = true;

        const loadViewAttachments = async (): Promise<void> => {
            try {
                const files = await Web()
                    .Lists(Strings.Sites.main.lists.Authorizations)
                    .Items()
                    .getById(authorizationId)
                    .AttachmentFiles()
                    .executeAndWait() as { results?: IViewAttachmentItem[] };
                const baseAttachments = files?.results ?? [];
                const enrichedAttachments = await Promise.all(baseAttachments.map(async (attachment) => {
                    if (!attachment.ServerRelativeUrl) {
                        return attachment;
                    }

                    try {
                        const file = await Web()
                            .getFileByServerRelativeUrl(attachment.ServerRelativeUrl)
                            .query({
                                Select: ["UniqueId"]
                            })
                            .executeAndWait() as { UniqueId?: string };

                        return {
                            ...attachment,
                            UniqueId: file?.UniqueId
                        };
                    } catch (error) {
                        console.warn("Could not resolve attachment UniqueId:", attachment.FileName, error);
                        return attachment;
                    }
                }));

                if (isActive) {
                    setAttachments(enrichedAttachments);
                }
            } catch (error: unknown) {
                if (isActive) {
                    setAttachments([]);
                    showSnackbar(`Unable to load attachments: ${formatError(error)}`, "error");
                }
            }
        };

        loadViewAttachments().catch(() => undefined);

        return () => {
            isActive = false;
        };
    }, [authorizationId, lastRefreshed, showSnackbar]);
    const pendingModCount = React.useMemo(() => {
        return mods.filter((mod) => mod.modStatus === "draft" || mod.modStatus === "submitted" || mod.modStatus === "underReview").length;
    }, [mods]);
    const modsBadgeTooltip = React.useMemo(() => {
        if (mods.length === 0) {
            return "No Mods have been created for this authorization.";
        }

        return pendingModCount > 0
            ? `${mods.length} Mod${mods.length === 1 ? "" : "s"} on this authorization; ${pendingModCount} pending.`
            : `${mods.length} Mod${mods.length === 1 ? "" : "s"} on this authorization; none pending.`;
    }, [mods.length, pendingModCount]);
    const draftMod = React.useMemo<IModItem | undefined>(() => {
        return mods.find((mod) => mod.modStatus === "draft") ?? draftModsByAuthorizationId.get(authorizationId);
    }, [authorizationId, draftModsByAuthorizationId, mods]);
    const canEditAuthorizationByUser = React.useMemo((): boolean => {
        return canUserEditAuthorization(authorization, currentUser, appUsers);
    }, [appUsers, authorization, currentUser]);
    const currentRunMod = React.useMemo<IModItem | undefined>(() => {
        const modId = currentRun?.runType === "mod" ? currentRun.mod?.Id : undefined;

        if (!modId) {
            return undefined;
        }

        return mods.find((mod) => mod.Id === modId);
    }, [currentRun, mods]);
    const canDeleteCurrentAuthorization = React.useMemo((): boolean => {
        return canDeleteAuthorization(authorization, currentUser, appUsers, currentRun);
    }, [appUsers, authorization, currentRun, currentUser]);
    const canCancelCurrentMod = React.useMemo((): boolean => {
        return canCancelMod(authorization, currentUser, appUsers, currentRun, currentRunMod);
    }, [appUsers, authorization, currentRun, currentRunMod, currentUser]);
    const displayedStatus = React.useMemo((): {
        label: string;
        color: "default" | "success" | "warning" | "error" | "info";
    } => {
        if (currentRun?.runType === "mod") {
            const modStatus = currentRunMod?.modStatus ?? (currentRun.outcome === "rejected" ? "rejected" : undefined);

            if (modStatus) {
                return {
                    label: `Mod ${modStatusLabels[modStatus]}`,
                    color: getStatusChipColor(modStatus)
                };
            }

            return {
                label: currentRun.runStatus === "completed" ? "Mod Approved" : "Mod Submitted",
                color: currentRun.runStatus === "completed" ? "success" : "warning"
            };
        }

        return {
            label: authorization ? authorizationStatusLabels[authorization.authorizationStatus] : "",
            color: getStatusChipColor(authorization?.authorizationStatus)
        };
    }, [authorization, currentRun, currentRunMod]);
    const displayedWorkflowStatus = React.useMemo((): {
        label: string;
        color: "default" | "success" | "warning" | "error" | "info";
    } => {
        if (currentRun?.runType === "mod" && currentRun.outcome === "rejected") {
            return { label: "Workflow Rejected", color: "error" };
        }

        return {
            label: currentRun ? `Workflow ${workflowRunStatusLabels[currentRun.runStatus]}` : "",
            color: "info"
        };
    }, [currentRun]);
    const rejectionActionRequiredMessage = React.useMemo((): string | undefined => {
        if (currentRun?.runStatus !== "active" || currentRun.outcome !== "rejected" || currentRun.currentStepKey !== "submitter") {
            return undefined;
        }

        return currentRun.runType === "mod"
            ? "This Mod was rejected and is waiting on the submitter to Modify & Resubmit or Cancel."
            : "This authorization was rejected and is waiting on the submitter to Modify & Resubmit or Cancel.";
    }, [currentRun]);
    const draftModOwnerName = draftMod?.Author?.Title ?? "another user";
    const canEditDraftMod = !!draftMod && canEditAuthorizationByUser;
    const canViewFinancials = React.useMemo(() => {
        return canViewFinancialAmounts(currentUser, authorization, workflowRuns, appUsers);
    }, [appUsers, authorization, currentUser, workflowRuns]);
    const mayEditComp = canEditCompensation(currentUser, currentRun, appUsers);
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
    const requiresIwaJamisProjectId = workflowDialogDecision === "approved" &&
        currentRun?.currentStepKey === "cfo" &&
        currentRun.runType !== "mod";
    const activeStep = getCurrentStepIndex(currentRun);
    const stepperActiveStep = currentRun?.runStatus === "completed" ? -1 : activeStep;
    const workflowPermission = React.useMemo(() => {
        return getWorkflowActionPermission(currentRun, currentUser, appUsers);
    }, [appUsers, currentRun, currentUser]);
    const currentUserId = DataSource.CurrentUserId;
    const missingCompensationMessage = React.useMemo(() => {
        if (!canEditCompInHrReview) {
            return undefined;
        }

        return getMissingCompensationMessage(authorization, currentRun, laborLines);
    }, [authorization, canEditCompInHrReview, currentRun, laborLines]);
    const hasActiveWorkflowRun = React.useMemo(() => {
        return workflowRuns.some((run) => run.runStatus === "active");
    }, [workflowRuns]);
    const canInitiateMod = !!authorization && !!currentUserId && authorization.authorizationStatus === "approved" && !hasActiveWorkflowRun && !draftMod;
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
        const employeeMap = new Map<string, {
            key: string | number;
            title: string;
            email: string;
            labels: string[];
        }>();

        resources
            .filter((resource) => resource.isActive !== false && !!resource.employee?.Id)
            .forEach((resource) => {
                const employeeId = resource.employee!.Id;
                const displayName = getResourceDisplayName(resource);
                const mapKey = isFallbackResourceEmployee(resource)
                    ? `fallback:${displayName.trim().toLowerCase() || resource.Id}`
                    : `employee:${employeeId}`;
                const existing = employeeMap.get(mapKey) ?? {
                    key: mapKey,
                    title: displayName,
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

                employeeMap.set(mapKey, existing);
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
        const requestedTab = getRequestedTab();

        setSelectedTab((current) => current === requestedTab ? current : requestedTab);
    }, [getRequestedTab]);

    const selectDetailTab = React.useCallback((value: DetailTab): void => {
        setSelectedTab(value);

        const params = new URLSearchParams(location.search);
        params.set("tab", value);
        history.replace({
            pathname: location.pathname,
            search: params.toString()
        });
    }, [history, location.pathname, location.search]);

    const handleTabChange = React.useCallback((_event: React.SyntheticEvent, value: DetailTab): void => {
        selectDetailTab(value);
    }, [selectDetailTab]);

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

    const showMissingModLinkDialog = React.useCallback((): void => {
        setDialogTitle("Mod Link Missing");
        setDialogMessage("This workflow run is marked as a modification, but the run is not linked to a Mod record. Editing it would load the base IWA data, so the Mod lookup must be repaired or the missing Mod restored before changes are submitted.");
        setDialogOpen(true);
    }, []);

    const getFreshEditNavigationState = React.useCallback(async (): Promise<{ hasDecision: boolean; modId?: number; } | undefined> => {
        if (!authorization?.Id) {
            return undefined;
        }

        const [freshRuns, freshMods] = await Promise.all([
            WorkflowService.getRunsByAuthorization(authorization.Id),
            ModService.getByAuthorization(authorization.Id)
        ]);
        const latestRun = freshRuns.find((run) => run.runStatus === "active") ??
            [...freshRuns].sort((left, right) => (right.runNumber ?? 0) - (left.runNumber ?? 0))[0];

        if (!latestRun) {
            return { hasDecision: false };
        }

        if (latestRun.runType !== "mod") {
            return { hasDecision: !!latestRun.hasDecision };
        }

        // Edit routing is a workflow boundary, so do not trust the cached run's
        // Mod lookup here. Refetch both lists and, if needed, recover the Mod by
        // matching the Mod's currentWorkflowRun to the latest run before routing.
        const modId = latestRun.mod?.Id ??
            freshMods.find((mod) => mod.currentWorkflowRun?.Id === latestRun.Id)?.Id;

        if (!modId) {
            showMissingModLinkDialog();
            return undefined;
        }

        return {
            hasDecision: !!latestRun.hasDecision,
            modId
        };
    }, [authorization?.Id, showMissingModLinkDialog]);

    const handleEdit = React.useCallback(async (): Promise<void> => {
        if (!authorization || !canEditAuthorizationByUser) {
            return;
        }

        if (draftMod) {
            return;
        }

        try {
            showBusy("Checking latest workflow...");
            const editState = await getFreshEditNavigationState();
            hideBusy();

            if (!editState) {
                return;
            }

            if (editState.hasDecision) {
                setModifyPromptOpen(true);
                return;
            }

            history.push(`/authorizations/edit/${authorization.Id}`, {
                returnTo: detailReturnTo,
                modId: editState.modId
            });
        } catch (error) {
            hideBusy();
            setDialogTitle("Edit Load Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, canEditAuthorizationByUser, detailReturnTo, draftMod, getFreshEditNavigationState, hideBusy, history, showBusy]);

    const handleEditMod = React.useCallback((): void => {
        if (!authorization || !draftMod?.Id || !canEditDraftMod) {
            return;
        }

        sessionStorage.setItem(getActiveModDraftSessionKey(authorization.Id), String(draftMod.Id));
        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: detailReturnTo,
            modId: draftMod.Id
        });
    }, [authorization, canEditDraftMod, detailReturnTo, draftMod, history]);

    const handleDeleteAuthorization = React.useCallback(async (): Promise<void> => {
        if (!authorization?.Id) {
            return;
        }

        try {
            flushSync(() => {
                setDeleteBusy(true);
                setDeleteError("");
                setDeleteConfirmOpen(false);
                showBusy("Deleting IWA and associated data...");
            });
            await AuthorizationService.deleteAuthorizationCascade(authorization.Id);
            clearAuthorizationDetailCache(authorization.Id);
            await refresh(true);
            hideBusy();
            showSnackbar(`${authorization.Title || "IWA"} ${authorization.authorizationStatus === "draft" ? "draft discarded" : "deleted"}.`, "success", deleteSuccessDurationMs);

            const returnTo = sessionStorage.getItem("iwa:lastReturnLocation") || "/my-work";
            history.push(returnTo);
        } catch (error) {
            hideBusy();
            setDialogTitle("Delete IWA Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        } finally {
            setDeleteBusy(false);
        }
    }, [authorization, clearAuthorizationDetailCache, hideBusy, history, refresh, showBusy, showSnackbar]);

    const handleCancelMod = React.useCallback(async (): Promise<void> => {
        if (!authorization?.Id || !currentRunMod?.Id) {
            return;
        }

        try {
            flushSync(() => {
                setCancelModBusy(true);
                setCancelModError("");
                setCancelModConfirmOpen(false);
                showBusy("Canceling Mod and reverting IWA...");
            });
            await AuthorizationService.cancelSubmittedMod(authorization.Id, currentRunMod.Id);
            clearAuthorizationDetailCache(authorization.Id);
            await Promise.all([
                refresh(true),
                loadAuthorizationDetail(authorization.Id, true)
            ]);
            hideBusy();
            showSnackbar(`${authorization.Title || "IWA"} Mod ${currentRunMod.modNumber ?? ""} canceled and reverted to the previously approved state.`, "success", deleteSuccessDurationMs);
        } catch (error) {
            hideBusy();
            setDialogTitle("Cancel Mod Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        } finally {
            setCancelModBusy(false);
        }
    }, [authorization, clearAuthorizationDetailCache, currentRunMod, hideBusy, loadAuthorizationDetail, refresh, showBusy, showSnackbar]);

    const handleConfirmModify = React.useCallback(async (): Promise<void> => {
        if (!authorization || !canEditAuthorizationByUser) {
            return;
        }

        setModifyPromptOpen(false);

        try {
            showBusy("Checking latest workflow...");
            const editState = await getFreshEditNavigationState();
            hideBusy();

            if (!editState) {
                return;
            }

            history.push(`/authorizations/edit/${authorization.Id}`, {
                returnTo: detailReturnTo,
                modId: editState.modId
            });
        } catch (error) {
            hideBusy();
            setDialogTitle("Edit Load Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, canEditAuthorizationByUser, detailReturnTo, getFreshEditNavigationState, hideBusy, history, showBusy]);

    const handleOpenInitiateMod = React.useCallback((): void => {
        setModPromptOpen(true);
    }, []);

    const handleInitiateMod = React.useCallback(async (): Promise<void> => {
        if (!authorization || !currentUserId || authorization.authorizationStatus !== "approved" || hasActiveWorkflowRun || draftMod) {
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
            patchAuthorization(authorization.Id, { modCount: nextModNumber });

            showBusy("Refreshing authorization...");
            await reloadAuthorizationDetailSections(authorization.Id, ["mods"]);

            sessionStorage.setItem(getActiveModDraftSessionKey(authorization.Id), String(mod.Id));
            hideBusy();
            history.push(`/authorizations/edit/${authorization.Id}`, {
                returnTo: detailReturnTo,
                modId: mod.Id
            });
        } catch (error) {
            hideBusy();
            setDialogTitle("Initiate Mod Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, currentUserId, detailReturnTo, draftMod, hasActiveWorkflowRun, hideBusy, history, mods, patchAuthorization, reloadAuthorizationDetailSections, showBusy]);

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
        setIwaJamisProjectIdDraft(authorization?.iwaJamisProjectId ?? "");
        setIwaJamisProjectIdError("");
    }, [authorization, currentRun, laborLines, showSnackbar]);

    const handleCloseWorkflowDecision = React.useCallback((): void => {
        setWorkflowDecision(undefined);
        setWorkflowComments("");
        setWorkflowCommentError("");
        setIwaJamisProjectIdDraft("");
        setIwaJamisProjectIdError("");
    }, []);

    const generateApprovedPdfExport = React.useCallback(async (run: IWorkflowRunItem): Promise<boolean> => {
        const selectedExportKey = run.runType === "mod" && run.mod?.Id ? `mod-${run.mod.Id}` : "base";
        const [
            approvedAuthorization,
            mods,
            actions,
            resources,
            approvedLaborLines,
            approvedTravelOdcs
        ] = await Promise.all([
            AuthorizationService.getById(authorizationId),
            ModService.getByAuthorization(authorizationId),
            WorkflowService.getActionsByAuthorization(authorizationId),
            ResourceService.getByAuthorization(authorizationId),
            LaborLineItemService.getByAuthorization(authorizationId),
            TravelOdcService.getByAuthorization(authorizationId)
        ]);
        const taskOrder = approvedAuthorization.contractId && approvedAuthorization.invoice
            ? (await DataSource.getInvoicesByContract(approvedAuthorization.contractId))
                .find((invoice) => invoice.InvoiceID1 === approvedAuthorization.invoice)
            : undefined;
        const model = buildIwaExportViewModel(
            approvedAuthorization,
            mods,
            approvedLaborLines,
            approvedTravelOdcs,
            actions,
            resources,
            selectedExportKey
        );

        if (model.option.pdfUrl) {
            return false;
        }

        const generatedOn = new Date().toISOString();
        const modelWithGeneratedDate = {
            ...model,
            option: {
                ...model.option,
                pdfGeneratedOn: generatedOn
            }
        };
        const blob = await pdf(<IwaExportPdfDocument model={modelWithGeneratedDate} taskOrder={taskOrder} />).toBlob();
        const pdfContent = await blob.arrayBuffer();

        await IwaExportService.saveApprovedPdf(model, taskOrder, pdfContent, generatedOn);
        return true;
    }, [authorizationId]);

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

        const normalizedIwaJamisProjectId = iwaJamisProjectIdDraft.trim();

        if (requiresIwaJamisProjectId && !/^\d{6}$/.test(normalizedIwaJamisProjectId)) {
            setIwaJamisProjectIdError("Enter the 6-digit IWA JAMIS Project ID before approving.");
            return;
        }

        try {
            handleCloseWorkflowDecision();
            const shouldGeneratePdf = decision === "approved" && currentRun.currentStepKey === "cfo";

            showBusy(decision === "approved"
                ? shouldGeneratePdf ? "Approving workflow step and generating PDF export..." : "Approving workflow step..."
                : "Rejecting workflow step...");
            await WorkflowDecisionService.submitDecision(authorization, currentRun, decision, trimmedComments, {
                iwaJamisProjectId: requiresIwaJamisProjectId ? normalizedIwaJamisProjectId : undefined
            });
            let generatedPdf = false;

            if (shouldGeneratePdf) {
                showBusy("Generating PDF export...");
                generatedPdf = await generateApprovedPdfExport(currentRun);
            }

            await reloadAuthorizationDetailSections(authorizationId, ["mods", "runs", "actions"]);
            const latestAuthorization = await AuthorizationService.getById(authorizationId);
            patchAuthorization(authorizationId, latestAuthorization);
            markWorkflowListsStale();
            showSuccess(decision === "approved"
                ? generatedPdf ? "Workflow step approved. Successfully generated PDF export." : "Workflow step approved."
                : "Workflow step rejected and returned to the submitter.");
            window.setTimeout(() => hideSuccess(), 1600);
        } catch (error) {
            hideBusy();
            setDialogTitle("Workflow Action Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorization, authorizationId, currentRun, generateApprovedPdfExport, handleCloseWorkflowDecision, hideBusy, hideSuccess, iwaJamisProjectIdDraft, patchAuthorization, reloadAuthorizationDetailSections, requiresIwaJamisProjectId, showBusy, showSuccess, workflowComments, workflowDecision]);

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
                standardHours: line.standardHours,
                overtimeHours: line.overtimeHours
            });
            const baseAmounts = await AuthorizationService.recalculateBaseAmounts(authorizationId);
            if (line.lineScope !== "mod") {
                patchAuthorization(authorizationId, baseAmounts);
            }
            await reloadAuthorizationDetailSections(authorizationId, ["labor"]);
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
    }, [authorizationId, compDrafts, hideBusy, hideSuccess, patchAuthorization, reloadAuthorizationDetailSections, showBusy, showSuccess]);

    if (!authorization) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700}>Authorization not found</Typography>
                <Typography color="text.secondary">Refresh the app or return to the list and try again.</Typography>
            </Paper>
        );
    }

    const deleteButtonLabel = authorization.authorizationStatus === "draft" ? "Discard Draft" : "Delete IWA";
    const deleteButtonTitle = authorization.authorizationStatus === "draft" ? "Discard Draft" : "Permanently delete this IWA";
    const cancelModTitle = "Permanently Cancel this Mod request";

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.75}>
                    <Button startIcon={<ArrowBackOutlinedIcon />} onClick={handleBack} sx={{ alignSelf: "flex-start" }} aria-label="Back to previous page" title="Back to previous page">
                        Back
                    </Button>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        <Typography variant="h4" fontWeight={600}>{authorization.Title}</Typography>
                        {headerModLabel && (
                            <Tooltip title={`${headerModLabel} is the latest Mod on this authorization.`}>
                                <Chip icon={<AccountTreeOutlinedIcon />} label={headerModLabel} />
                            </Tooltip>
                        )}
                        <Chip label={displayedStatus.label} color={displayedStatus.color} />
                        {draftMod && <Chip label={`Mod ${draftMod.modNumber ?? ""} Draft`} color="secondary" />}
                        {currentRun && <Chip label={displayedWorkflowStatus.label} color={displayedWorkflowStatus.color} variant="outlined" />}
                    </Stack>
                    <Typography color="text.secondary">
                        {authorization.contractName || "No contract title"} | {formatRelationship(authorization.donorEntity, authorization.receivingEntity)}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
                    <Tooltip title={canViewFinancials ? "Open export preview" : "Export preview contains dollar amounts and is limited to workflow approvers, their backups, and the PM."}>
                        <span>
                            <Button
                                variant="outlined"
                                startIcon={<PictureAsPdfOutlinedIcon />}
                                onClick={() => history.push(`/authorizations/export/${authorization.Id}`)}
                                disabled={!canViewFinancials}
                                aria-label="Open export preview"
                                title={canViewFinancials ? "Open export preview" : "Export preview contains dollar amounts and is limited to workflow approvers, their backups, and the PM."}
                            >
                                Export Preview
                            </Button>
                        </span>
                    </Tooltip>
                    {canDeleteCurrentAuthorization && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineOutlinedIcon />}
                            onClick={() => setDeleteConfirmOpen(true)}
                            aria-label={deleteButtonTitle}
                            title={deleteButtonTitle}
                        >
                            {deleteButtonLabel}
                        </Button>
                    )}
                    {canCancelCurrentMod && (
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setCancelModConfirmOpen(true)}
                            aria-label={cancelModTitle}
                            title={cancelModTitle}
                        >
                            Cancel Mod
                        </Button>
                    )}
                    {canEditDraftMod ? (
                        <Button variant="contained" color="secondary" startIcon={<EditOutlinedIcon />} onClick={handleEditMod} aria-label="Edit Mod" title="Edit Mod">
                            Edit Mod
                        </Button>
                    ) : canInitiateMod ? (
                        <Button variant="contained" color="secondary" startIcon={<AccountTreeOutlinedIcon />} onClick={handleOpenInitiateMod} aria-label="Initiate Mod" title="Initiate Mod">
                            Initiate Mod
                        </Button>
                    ) : canEditAuthorizationByUser && !draftMod ? (
                        <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={handleEdit} aria-label="Edit authorization" title="Edit authorization">
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

            {rejectionActionRequiredMessage && (
                <Alert
                    severity="warning"
                    variant="outlined"
                    icon={<ErrorOutlineOutlinedIcon />}
                    sx={{
                        alignItems: "center",
                        borderColor: "warning.main",
                        borderWidth: 2,
                        fontSize: "1rem",
                        "& .MuiAlert-icon": {
                            alignItems: "center"
                        },
                        "& .MuiAlert-message": {
                            fontSize: "1rem",
                            lineHeight: 1.5
                        }
                    }}
                >
                    <Typography component="span" fontSize="inherit" lineHeight="inherit" fontWeight={800}>
                        Action required:
                    </Typography>{" "}
                    {rejectionActionRequiredMessage}
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
                            {baseWorkflowSteps.map((step) => {
                                const action = getStepAction(currentRunActions, step);
                                const isRejected = action?.actionType === "rejected";

                                return (
                                    <Step key={step} completed={!!action}>
                                        <StepLabel
                                            StepIconComponent={(stepIconProps) => isRejected ? (
                                                <SvgIcon
                                                    className={stepIconProps.className}
                                                    viewBox="0 0 24 24"
                                                    sx={(stepTheme) => ({
                                                        color: "error.main",
                                                        "& circle": {
                                                            fill: stepTheme.palette.error.main
                                                        },
                                                        "& path": {
                                                            stroke: stepTheme.palette.error.contrastText
                                                        }
                                                    })}
                                                >
                                                    <circle cx="12" cy="12" r="12" />
                                                    <path d="M8 8l8 8M16 8l-8 8" strokeWidth="2.75" strokeLinecap="round" />
                                                </SvgIcon>
                                            ) : (
                                                <StepIcon {...stepIconProps} />
                                            )}
                                        >
                                            {workflowStepLabels[step]}
                                        </StepLabel>
                                    </Step>
                                );
                            })}
                        </Stepper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: "100%", borderColor: theme.palette.info.main }}>
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
                                                aria-label="Approve authorization"
                                                title="Approve authorization"
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
                                                aria-label="Reject authorization"
                                                title="Reject authorization"
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
                    onChange={handleTabChange}
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
                            minWidth: 80,
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
                    {detailTabs.map((tab) => {
                        const label = tab.value === "resources" && missingCompensationMessage ? (
                            <Tooltip title={missingCompensationMessage}>
                                <Box
                                    component="span"
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 0.65
                                    }}
                                >
                                    <ErrorOutlineOutlinedIcon fontSize="small" />
                                    <span>{tab.label}</span>
                                </Box>
                            </Tooltip>
                        ) : tab.value === "mods" && mods.length > 0 ? (
                            <Tooltip title={modsBadgeTooltip}>
                                <Box
                                    component="span"
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 0.5,
                                        minWidth: 54
                                    }}
                                >
                                    <span>{tab.label}</span>
                                    <Box
                                        component="span"
                                        sx={(theme) => ({
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            minWidth: 17,
                                            height: 17,
                                            px: 0.45,
                                            borderRadius: 999,
                                            bgcolor: pendingModCount > 0 ? theme.palette.error.main : theme.palette.accent.main,
                                            color: pendingModCount > 0 ? theme.palette.error.contrastText : theme.palette.accent.contrastText,
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            lineHeight: 1
                                        })}
                                    >
                                        {mods.length}
                                    </Box>
                                </Box>
                            </Tooltip>
                        ) : tab.label;

                        return (
                            <BottomNavigationAction
                                key={tab.value}
                                value={tab.value}
                                label={label}
                                sx={tab.value === "resources" && missingCompensationMessage ? (theme) => ({
                                    borderColor: `${theme.palette.accent.main} !important`,
                                    bgcolor: `${alpha(theme.palette.accent.main, theme.palette.mode === "dark" ? 0.12 : 0.14)} !important`,
                                    color: `${theme.palette.accent.main} !important`,
                                    boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.accent.main, 0.35)}, 0 0 0 2px ${alpha(theme.palette.accent.main, 0.12)}`,
                                    "& .MuiBottomNavigationAction-label": {
                                        fontWeight: 800
                                    }
                                }) : undefined}
                            />
                        );
                    })}
                </BottomNavigation>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
                {selectedTab === "summary" && (
                    <IwaSummaryTab
                        attachments={attachments}
                        authorization={authorization}
                        canViewFinancials={canViewFinancials}
                        latestMod={latestMod}
                    />
                )}
                {selectedTab === "resources" && (
                    <IwaResourcesLaborTab
                        canEditCompInHrReview={canEditCompInHrReview}
                        canEditCompLine={canEditCompLine}
                        canViewFinancials={canViewFinancials}
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
                        isFfpAuthorization={isFfpAuthorization}
                        laborDeltaTotal={laborDeltaTotal}
                        laborLines={laborLines}
                        laborTotals={laborTotals}
                        mods={mods}
                        onOpenCommentDialog={setCommentDialog}
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
                        actions={actions}
                        canViewFinancials={canViewFinancials}
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
                            {requiresIwaJamisProjectId
                                ? "Enter the IWA JAMIS Project ID before approving the base IWA. Approval comments are optional."
                                : workflowDialogDecision === "approved"
                                ? "Approval comments are optional."
                                : "Reject comments are required and will be shown to the submitter."}
                        </Typography>
                        {requiresIwaJamisProjectId && (
                            <TextField
                                label="IWA JAMIS Project ID"
                                value={iwaJamisProjectIdDraft}
                                onChange={(event) => {
                                    setIwaJamisProjectIdDraft(event.target.value.replace(/\D/g, "").slice(0, 6));
                                    if (iwaJamisProjectIdError) {
                                        setIwaJamisProjectIdError("");
                                    }
                                }}
                                error={!!iwaJamisProjectIdError}
                                helperText={iwaJamisProjectIdError || "Enter the 6-digit project ID assigned in JAMIS."}
                                required
                                fullWidth
                                autoFocus
                            />
                        )}
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
                            autoFocus={!requiresIwaJamisProjectId}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseWorkflowDecision} aria-label="Cancel workflow decision" title="Cancel workflow decision">Cancel</Button>
                    <Button
                        variant="contained"
                        color={workflowDialogDecision === "approved" ? "success" : "error"}
                        onClick={handleSubmitWorkflowDecision}
                        aria-label={workflowDialogDecision === "approved" ? "Submit approval" : "Submit rejection"}
                        title={workflowDialogDecision === "approved" ? "Submit approval" : "Submit rejection"}
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
                    <Button onClick={() => setCommentDialog(undefined)} aria-label="Close workflow comments" title="Close workflow comments">Close</Button>
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
                    <Button onClick={() => setModifyPromptOpen(false)} aria-label="Cancel modify authorization" title="Cancel modify authorization">Cancel</Button>
                    <Button variant="contained" onClick={handleConfirmModify} aria-label="Confirm modify authorization" title="Confirm modify authorization">Yes, continue</Button>
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
                    <Button onClick={() => setModPromptOpen(false)} aria-label="Cancel initiate Mod" title="Cancel initiate Mod">Cancel</Button>
                    <Button variant="contained" color="secondary" onClick={handleInitiateMod} aria-label="Confirm initiate Mod" title="Confirm initiate Mod">Yes, initiate Mod</Button>
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
                                selectDetailTab("mods");
                            }}
                            aria-label="View Mods"
                            title="View Mods"
                        >
                            View Mods
                        </Button>
                    )}
                    <Button onClick={() => setChangeDialog(undefined)} aria-label="Close workflow changes" title="Close workflow changes">Close</Button>
                </DialogActions>
            </Dialog>
            <ConfirmDeleteDialog
                open={deleteConfirmOpen}
                title={authorization.authorizationStatus === "draft" ? "Discard Draft" : "Delete IWA"}
                message="Are you sure you want to permanently delete this request and all associated data?"
                confirmLabel={deleteButtonLabel}
                error={deleteError}
                busy={deleteBusy}
                onClose={() => {
                    if (!deleteBusy) {
                        setDeleteConfirmOpen(false);
                        setDeleteError("");
                    }
                }}
                onConfirm={handleDeleteAuthorization}
            />
            <ConfirmDeleteDialog
                open={cancelModConfirmOpen}
                title="Cancel Mod"
                message={"Do you want to permanently cancel this Mod request and all associated Mod data? This IWA will be reverted back to its previously approved state.\n\nThis action cannot be undone."}
                confirmLabel="Yes, Cancel Mod"
                cancelLabel="No, Go Back"
                error={cancelModError}
                busy={cancelModBusy}
                onClose={() => {
                    if (!cancelModBusy) {
                        setCancelModConfirmOpen(false);
                        setCancelModError("");
                    }
                }}
                onConfirm={handleCancelMod}
            />
        </Stack>
    );
};
