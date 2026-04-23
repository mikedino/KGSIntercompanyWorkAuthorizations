import * as React from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Grid,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { useHistory, useParams } from "react-router-dom";
import { IAuthorizationItem, ILaborLineItem, IResourceItem, ITravelOdcItem, IWorkflowActionItem, IWorkflowRunItem, WorkflowStepKey, workflowRoleLabels, workflowStepLabels } from "../data/props";
import { useIwa } from "../data/iwaContext";
import { formatCurrency, formatDate, formatError } from "../common/utils";
import { authorizationStatusLabels, getStatusChipColor, getWorkflowStatusChipColor, workflowRunStatusLabels } from "../layout/allAuthorizationsUtils";
import { canEditCompensation, canViewCompensation } from "../resources/laborAccess";
import { resolveLaborCompensation } from "../resources/laborMath";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { useShellUi } from "../ui/ShellUiContext";
import AlertDialog from "../ui/Alert";

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

interface ICompDraft {
    annualSalary: string;
    standardRate: string;
    overtimeRate: string;
    standardHours: string;
    overtimeHours: string;
}

const toCompDraft = (line: ILaborLineItem): ICompDraft => ({
    annualSalary: line.annualSalary ? String(line.annualSalary) : "",
    standardRate: line.standardRate ? String(line.standardRate) : "",
    overtimeRate: line.overtimeRate ? String(line.overtimeRate) : "",
    standardHours: line.standardHours ? String(line.standardHours) : "",
    overtimeHours: line.overtimeHours ? String(line.overtimeHours) : ""
});

const toNumberOrUndefined = (value: string): number | undefined => {
    const clean = value.replace(/[^0-9.]/g, "");

    if (!clean) {
        return undefined;
    }

    const next = Number(clean);
    return Number.isNaN(next) ? undefined : next;
};

const getCurrentStepIndex = (run?: IWorkflowRunItem): number => {
    if (!run) {
        return 0;
    }

    const index = baseWorkflowSteps.indexOf(run.currentStepKey);
    return index >= 0 ? index : 0;
};

const getStepAction = (actions: IWorkflowActionItem[], step: WorkflowStepKey): IWorkflowActionItem | undefined => {
    return actions.find((action) => action.stepKey === step && action.actionType !== "submitted");
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

export const IwaDetailPage: React.FC = (): JSX.Element => {
    const history = useHistory();
    const { id } = useParams<{ id: string; }>();
    const authorizationId = Number(id);
    const { showBusy, hideBusy, showSuccess, hideSuccess } = useShellUi();
    const {
        actionsByAuthorizationId,
        authorizations,
        currentUser,
        draftAuthorizations,
        isAuthorizationDetailLoading,
        laborLinesByAuthorizationId,
        loadAuthorizationDetail,
        modsByAuthorizationId,
        resourcesByAuthorizationId,
        runByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();

    const [selectedTab, setSelectedTab] = React.useState<DetailTab>("summary");
    const [compDrafts, setCompDrafts] = React.useState<Record<number, ICompDraft>>({});
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);

    const authorization = React.useMemo<IAuthorizationItem | undefined>(() => {
        return [...authorizations, ...draftAuthorizations].find((item) => item.Id === authorizationId);
    }, [authorizationId, authorizations, draftAuthorizations]);

    const currentRun = runByAuthorizationId.get(authorizationId);
    const actions = actionsByAuthorizationId.get(authorizationId) ?? [];
    const resources = resourcesByAuthorizationId.get(authorizationId) ?? [];
    const laborLines = laborLinesByAuthorizationId.get(authorizationId) ?? [];
    const travelOdcs = travelOdcsByAuthorizationId.get(authorizationId) ?? [];
    const mods = modsByAuthorizationId.get(authorizationId) ?? [];
    const detailLoading = isAuthorizationDetailLoading(authorizationId);
    const mayViewComp = canViewCompensation(currentUser, authorization);
    const mayEditComp = canEditCompensation(currentUser);
    const activeStep = getCurrentStepIndex(currentRun);

    React.useEffect((): void => {
        if (!authorizationId || Number.isNaN(authorizationId)) {
            return;
        }

        loadAuthorizationDetail(authorizationId).catch((error) => {
            setDialogTitle("Detail Load Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        });
    }, [authorizationId, loadAuthorizationDetail]);

    React.useEffect((): void => {
        const nextDrafts: Record<number, ICompDraft> = {};

        laborLines.forEach((line) => {
            nextDrafts[line.Id] = toCompDraft(line);
        });

        setCompDrafts(nextDrafts);
    }, [laborLines]);

    const handleBack = React.useCallback((): void => {
        const fallback = sessionStorage.getItem("iwa:lastReturnLocation") || "/all-authorizations/all";
        history.push(fallback);
    }, [history]);

    const handleEdit = React.useCallback((): void => {
        if (!authorization) {
            return;
        }

        history.push(`/authorizations/edit/${authorization.Id}`, {
            returnTo: `/authorizations/view/${authorization.Id}`
        });
    }, [authorization, history]);

    const handleUpdateDraft = React.useCallback((lineId: number, patch: Partial<ICompDraft>): void => {
        setCompDrafts((prev) => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                ...patch
            }
        }));
    }, []);

    const handleSaveComp = React.useCallback(async (line: ILaborLineItem): Promise<void> => {
        const draft = compDrafts[line.Id] ?? toCompDraft(line);

        try {
            showBusy("Saving labor compensation...");
            await LaborLineItemService.updateCompensation(line.Id, {
                annualSalary: toNumberOrUndefined(draft.annualSalary),
                standardRate: toNumberOrUndefined(draft.standardRate),
                overtimeRate: toNumberOrUndefined(draft.overtimeRate),
                standardHours: toNumberOrUndefined(draft.standardHours),
                overtimeHours: toNumberOrUndefined(draft.overtimeHours)
            });
            await loadAuthorizationDetail(authorizationId, true);
            showSuccess("Labor compensation saved.");
            window.setTimeout(() => hideSuccess(), 1200);
        } catch (error) {
            hideBusy();
            setDialogTitle("Labor Save Error");
            setDialogMessage(formatError(error));
            setDialogOpen(true);
        }
    }, [authorizationId, compDrafts, hideBusy, hideSuccess, loadAuthorizationDetail, showBusy, showSuccess]);

    if (!authorization) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700}>Authorization not found</Typography>
                <Typography color="text.secondary">Refresh the app or return to the list and try again.</Typography>
            </Paper>
        );
    }

    const summaryTab = (
        <Grid container spacing={2}>
            {[
                ["Contract", `${authorization.contractId || "—"} | ${authorization.contractName || "—"}`],
                ["Entities", `${authorization.donorEntity || "—"} -> ${authorization.receivingEntity || "—"}`],
                ["Operating Group", `${authorization.og || "—"} | ${authorization.lob || "—"}`],
                ["Project Manager", authorization.pm?.Title || "—"],
                ["Period", `${formatDate(authorization.periodStart)} - ${formatDate(authorization.periodEnd)}`],
                ["Invoice / Task Order", authorization.invoice || "Not specified"]
            ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 12, md: 6, xl: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography fontWeight={600}>{value}</Typography>
                    </Paper>
                </Grid>
            ))}
            <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Scope of Work</Typography>
                    <Typography color="text.secondary">{authorization.scopeOfWork || "—"}</Typography>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Justification</Typography>
                    <Typography color="text.secondary">{authorization.justification || "—"}</Typography>
                </Paper>
            </Grid>
        </Grid>
    );

    const resourcesTab = (
        <Stack spacing={2}>
            {mayEditComp && (
                <Alert severity="info">
                    HR/Admin compensation entry is available here for this first pass. Salary derives standard rate from salary / 2080 unless HR/Admin overrides the rate fields.
                </Alert>
            )}
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Employee / Resource</TableCell>
                            <TableCell>State</TableCell>
                            <TableCell>Job ID</TableCell>
                            <TableCell>Labor Category</TableCell>
                            <TableCell align="right">Std Hrs</TableCell>
                            <TableCell align="right">OT Hrs</TableCell>
                            {mayViewComp && <TableCell align="right">Salary</TableCell>}
                            {mayViewComp && <TableCell align="right">Std Rate</TableCell>}
                            {mayViewComp && <TableCell align="right">OT Rate</TableCell>}
                            <TableCell align="right">Total</TableCell>
                            {mayEditComp && <TableCell align="right">Action</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {laborLines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={mayEditComp ? 11 : mayViewComp ? 10 : 7}>No labor lines found.</TableCell>
                            </TableRow>
                        ) : laborLines.map((line) => {
                            const draft = compDrafts[line.Id] ?? toCompDraft(line);
                            const preview = resolveLaborCompensation({
                                annualSalary: toNumberOrUndefined(draft.annualSalary),
                                standardRate: toNumberOrUndefined(draft.standardRate),
                                overtimeRate: toNumberOrUndefined(draft.overtimeRate),
                                standardHours: toNumberOrUndefined(draft.standardHours),
                                overtimeHours: toNumberOrUndefined(draft.overtimeHours)
                            });

                            return (
                                <TableRow key={line.Id} hover>
                                    <TableCell>{getResourceNamesForLabor(line, resources)}</TableCell>
                                    <TableCell>{line.pricingType === "tm" ? resources.find((resource) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id))?.state ?? "—" : "Multiple"}</TableCell>
                                    <TableCell>{line.jobId || "—"}</TableCell>
                                    <TableCell>{line.laborCategory || "—"}</TableCell>
                                    <TableCell align="right">{line.standardHours ?? "—"}</TableCell>
                                    <TableCell align="right">{line.overtimeHours ?? "—"}</TableCell>
                                    {mayViewComp && (
                                        <TableCell align="right">
                                            {mayEditComp ? (
                                                <TextField size="small" value={draft.annualSalary} onChange={(event) => handleUpdateDraft(line.Id, { annualSalary: event.target.value })} sx={{ width: 120 }} />
                                            ) : formatCurrency(line.annualSalary)}
                                        </TableCell>
                                    )}
                                    {mayViewComp && (
                                        <TableCell align="right">
                                            {mayEditComp ? (
                                                <TextField size="small" value={draft.standardRate || String(preview.standardRate || "")} onChange={(event) => handleUpdateDraft(line.Id, { standardRate: event.target.value })} sx={{ width: 100 }} />
                                            ) : formatCurrency(line.standardRate)}
                                        </TableCell>
                                    )}
                                    {mayViewComp && (
                                        <TableCell align="right">
                                            {mayEditComp ? (
                                                <TextField size="small" value={draft.overtimeRate || String(preview.overtimeRate || "")} onChange={(event) => handleUpdateDraft(line.Id, { overtimeRate: event.target.value })} sx={{ width: 100 }} />
                                            ) : formatCurrency(line.overtimeRate)}
                                        </TableCell>
                                    )}
                                    <TableCell align="right">{formatCurrency(mayEditComp ? preview.totalAmount : line.totalAmount)}</TableCell>
                                    {mayEditComp && (
                                        <TableCell align="right">
                                            <Button size="small" startIcon={<SaveOutlinedIcon />} onClick={() => handleSaveComp(line)}>
                                                Save
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>Resource Roster</Typography>
                <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {resources.map((resource) => {
                        const labor = getLaborForResource(resource, laborLines);
                        return (
                            <Grid key={resource.Id} size={{ xs: 12, md: 6, xl: 4 }}>
                                <Paper sx={{ p: 1.5, height: "100%" }}>
                                    <Typography fontWeight={700}>{resource.employee?.Title ?? "—"}</Typography>
                                    <Typography variant="body2" color="text.secondary">{resource.employee?.EMail ?? ""}</Typography>
                                    <Typography variant="caption" color="text.secondary">{resource.state || "No state"} | {labor?.jobId || "No job"}</Typography>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            </Paper>
        </Stack>
    );

    const travelTab = (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
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
                    ) : travelOdcs.map((line: ITravelOdcItem) => (
                        <TableRow key={line.Id}>
                            <TableCell>{line.lineType.toUpperCase()}</TableCell>
                            <TableCell>{line.jobId || "—"}</TableCell>
                            <TableCell>{line.description || "—"}</TableCell>
                            <TableCell>{line.comments || "—"}</TableCell>
                            <TableCell align="right">{formatCurrency(line.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    const workflowTab = (
        <Stack spacing={2}>
            {baseWorkflowSteps.map((step) => {
                const action = getStepAction(actions, step);
                const isCurrent = currentRun?.currentStepKey === step && currentRun.runStatus === "active";
                const label = workflowStepLabels[step];
                const approver = step === "pm"
                    ? authorization.pm
                    : step === "hr"
                        ? currentRun?.hr
                        : step === "ogPresident"
                            ? currentRun?.ogPresident
                            : step === "cfo"
                                ? currentRun?.cfo
                                : authorization.Author;

                return (
                    <Paper key={step} variant="outlined" sx={{ p: 2, borderColor: isCurrent ? "secondary.main" : "divider" }}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                            <Box>
                                <Typography fontWeight={700}>{label}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {approver?.Title ?? "No approver assigned"} {approver?.EMail ? `| ${approver.EMail}` : ""}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {isCurrent && <Chip label="Current" color="secondary" size="small" />}
                                {action && <Chip label={action.actionType.toUpperCase()} color={action.actionType === "approved" ? "success" : action.actionType === "rejected" ? "error" : "info"} size="small" />}
                                {step === "pm" && currentRun?.skipPmStep && <Chip label="Skipped" size="small" variant="outlined" />}
                            </Stack>
                        </Stack>
                        {action && (
                            <Typography variant="caption" color="text.secondary">
                                {action.actionBy?.Title ?? "System"} on {formatDate(action.actionDate)} {action.comments ? `| ${action.comments}` : ""}
                            </Typography>
                        )}
                    </Paper>
                );
            })}
        </Stack>
    );

    const historyTab = (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
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
                            <TableCell>{formatDate(action.actionDate)}</TableCell>
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
                        <Typography variant="h4" fontWeight={700}>{authorization.Title}</Typography>
                        <Chip label={authorizationStatusLabels[authorization.authorizationStatus]} color={getStatusChipColor(authorization.authorizationStatus)} />
                        {currentRun && <Chip label={`WF ${workflowRunStatusLabels[currentRun.runStatus]}`} color={getWorkflowStatusChipColor(currentRun.runStatus)} variant="outlined" />}
                    </Stack>
                    <Typography color="text.secondary">
                        {authorization.contractName || "No contract title"} | {authorization.donorEntity} {"->"} {authorization.receivingEntity}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={handleEdit}>
                        Edit
                    </Button>
                </Stack>
            </Stack>

            <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Stepper activeStep={activeStep} alternativeLabel sx={{ "& .MuiStepLabel-label.Mui-active": { color: "secondary.main", fontWeight: 700 }, "& .MuiStepIcon-root.Mui-active": { color: "secondary.main" } }}>
                            {baseWorkflowSteps.map((step) => (
                                <Step key={step} completed={!!getStepAction(actions, step)}>
                                    <StepLabel>{workflowStepLabels[step]}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                            <Typography variant="caption" color="text.secondary">Pending With</Typography>
                            <Typography fontWeight={700}>{currentRun?.pendingApprover?.Title ?? "No active assignee"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {currentRun?.pendingRole ? workflowRoleLabels[currentRun.pendingRole] : "Workflow not active"}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ px: 2, borderRadius: 3 }}>
                <Tabs value={selectedTab} onChange={(_event, value: DetailTab) => setSelectedTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                    {detailTabs.map((tab) => (
                        <Tab key={tab.value} value={tab.value} label={tab.label} sx={{ textTransform: "none", fontWeight: 700 }} />
                    ))}
                </Tabs>
            </Paper>

            {detailLoading && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <CircularProgress size={22} />
                    <Typography color="text.secondary">Loading authorization details...</Typography>
                </Stack>
            )}

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
        </Stack>
    );
};
