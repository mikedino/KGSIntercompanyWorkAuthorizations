import * as React from "react";
import {
    Box,
    Button,
    Chip,
    Alert,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { pdf } from "@react-pdf/renderer";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { formatCurrency, formatDate, formatError } from "../../common/utils";
import { useIwa } from "../../data/iwaContext";
import { DataSource } from "../../data/ds";
import { IAuthorizationItem, IInvoiceItem } from "../../data/props";
import { buildIwaExportOptions, buildIwaExportViewModel, formatExportModLabel, hasLaborSummaryAmount, hasTravelSummaryAmount, IIwaExportSummaryRow } from "./exportViewModel";
import { IwaExportPdfDocument } from "./IwaExportPdfDocument";
import { IwaExportService } from "./iwaExportService";
import { useShellUi } from "../../ui/ShellUiContext";
import { AuthorizationService } from "../iwaService";
import { canViewFinancialAmounts } from "../financialAccess";

const totalCellSx = {
    fontWeight: 600,
    bgcolor: "background.default"
};

const sectionSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 1,
    p: 2
};

const compactTableSx = {
    "& th": {
        fontWeight: 600,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
        textTransform: "uppercase",
        fontSize: 12
    },
    "& td": {
        borderBottom: "1px solid",
        borderColor: "divider"
    },
    "& tbody tr:last-child td": {
        borderBottom: 0
    }
};

const laborTableSx = {
    ...compactTableSx,
    "& .labor-employee": { width: "21%" },
    "& .labor-state": { width: "12%", whiteSpace: "nowrap" },
    "& .labor-job": { width: "24%" },
    "& .labor-category": { width: "17%" },
    "& .labor-std": { width: "7%" },
    "& .labor-ot": { width: "6%" },
    "& .labor-total": { width: "13%" }
};

const isModelApprovedForPdf = (model: ReturnType<typeof buildIwaExportViewModel>): boolean => {
    if (model.mod) {
        return model.mod.modStatus === "approved";
    }

    return model.authorization.authorizationStatus === "approved" || model.authorization.authorizationStatus === "closed";
};

export const IwaExportPreviewPage: React.FC = (): JSX.Element => {
    const history = useHistory();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const { showBusy, hideBusy, showSnackbar } = useShellUi();
    const authorizationId = Number(id);
    const search = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
    const selectedExportKey = search.get("export") ?? undefined;
    const [freshAuthorization, setFreshAuthorization] = React.useState<IAuthorizationItem | undefined>(undefined);
    const [isLoadingFreshAuthorization, setIsLoadingFreshAuthorization] = React.useState<boolean>(true);
    const [taskOrder, setTaskOrder] = React.useState<IInvoiceItem | undefined>(undefined);
    const [savedPdfUrl, setSavedPdfUrl] = React.useState<string | undefined>(undefined);
    const [savedPdfGeneratedOn, setSavedPdfGeneratedOn] = React.useState<string | undefined>(undefined);
    const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
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
        runsByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();
    const contextAuthorization = React.useMemo(() => {
        return [...authorizations, ...draftAuthorizations].find((item) => item.Id === authorizationId);
    }, [authorizationId, authorizations, draftAuthorizations]);
    const authorization = freshAuthorization ?? contextAuthorization;

    React.useEffect(() => {
        if (!authorizationId || Number.isNaN(authorizationId)) {
            return;
        }

        let isActive = true;

        setIsLoadingFreshAuthorization(true);
        setFreshAuthorization(undefined);

        Promise.all([
            AuthorizationService.getById(authorizationId),
            loadAuthorizationDetail(authorizationId, true)
        ])
            .then(([nextAuthorization]) => {
                if (!isActive) {
                    return;
                }

                setFreshAuthorization(nextAuthorization);
            })
            .catch((error) => {
                console.error(error);
                showSnackbar(`Export preview refresh failed: ${formatError(error)}`, "error");
            })
            .finally(() => {
                if (isActive) {
                    setIsLoadingFreshAuthorization(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [authorizationId, lastRefreshed, loadAuthorizationDetail, showSnackbar]);

    React.useEffect(() => {
        if (!authorization?.contractId || !authorization.invoice) {
            setTaskOrder(undefined);
            return;
        }

        DataSource.getInvoicesByContract(authorization.contractId)
            .then((invoices) => {
                setTaskOrder(invoices.find((invoice) => invoice.InvoiceID1 === authorization.invoice));
            })
            .catch(() => setTaskOrder(undefined));
    }, [authorization?.contractId, authorization?.invoice]);

    const mods = modsByAuthorizationId.get(authorizationId) ?? [];
    const laborLines = laborLinesByAuthorizationId.get(authorizationId) ?? [];
    const travelOdcs = travelOdcsByAuthorizationId.get(authorizationId) ?? [];
    const actions = actionsByAuthorizationId.get(authorizationId) ?? [];
    const resources = resourcesByAuthorizationId.get(authorizationId) ?? [];
    const workflowRuns = runsByAuthorizationId.get(authorizationId) ?? [];
    const canViewFinancials = canViewFinancialAmounts(currentUser, authorization, workflowRuns, appUsers);
    const options = authorization ? buildIwaExportOptions(authorization, mods) : [];
    const model = authorization
        ? buildIwaExportViewModel(authorization, mods, laborLines, travelOdcs, actions, resources, selectedExportKey)
        : undefined;
    const storedPdfUrl = model?.option.pdfUrl ?? savedPdfUrl;
    const storedPdfGeneratedOn = model?.option.pdfGeneratedOn ?? savedPdfGeneratedOn;
    const hasStoredPdf = !!storedPdfUrl;
    const canCreatePdf = model ? isModelApprovedForPdf(model) : false;
    const canGeneratePdf = canCreatePdf && !hasStoredPdf;
    const approvalGateMessage = "PDF export is available after this base IWA or Mod is fully approved.";

    React.useEffect(() => {
        setSavedPdfUrl(undefined);
        setSavedPdfGeneratedOn(undefined);
    }, [selectedExportKey]);
    const handleExportChange = (value: string): void => {
        history.replace(`/authorizations/export/${authorizationId}?export=${encodeURIComponent(value)}`);
    };

    const handleGeneratePdf = async (): Promise<void> => {
        if (!model || !canGeneratePdf) {
            return;
        }

        setIsGeneratingPdf(true);
        showBusy("Generating approved PDF...");

        try {
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
            showBusy("Saving PDF to IWAExports...");
            const saved = await IwaExportService.saveApprovedPdf(model, taskOrder, pdfContent, generatedOn);

            setSavedPdfUrl(saved.pdfUrl);
            setSavedPdfGeneratedOn(saved.generatedOn);
            showBusy("Refreshing PDF link...");
            await Promise.all([
                loadAuthorizationDetail(authorizationId, true),
                refresh(true)
            ]);
            showSnackbar("PDF saved to IWAExports.", "success");
            window.open(saved.pdfUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            showSnackbar(`PDF save failed: ${formatError(error)}`, "error");
        } finally {
            setIsGeneratingPdf(false);
            hideBusy();
        }
    };

    if ((!authorization || !model) && isLoadingFreshAuthorization) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700}>Loading export preview...</Typography>
                <Typography color="text.secondary">Refreshing the latest authorization status and export data.</Typography>
            </Paper>
        );
    }

    if (!authorization || !model) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700}>Export preview unavailable</Typography>
                <Typography color="text.secondary">Refresh the app or return to the authorization and try again.</Typography>
            </Paper>
        );
    }

    if (!canViewFinancials) {
        return (
            <Paper sx={{ p: 3 }}>
                <Stack spacing={1.5}>
                    <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => history.push(`/authorizations/view/${authorization.Id}`)} sx={{ alignSelf: "flex-start" }}>
                        Back
                    </Button>
                    <Alert severity="warning">
                        Export preview contains dollar amounts and is limited to workflow approvers, their backups, and the PM.
                    </Alert>
                </Stack>
            </Paper>
        );
    }

    const exportLabel = model.mod ? formatExportModLabel(model.mod.modNumber) : undefined;
    const headerLabel = exportLabel ?? "BASE";
    const contractTypeLabel = authorization.contractType === "tm" ? "T&M" : "FFP";
    const totalStandardHours = model.laborDetails.reduce((total, row) => total + row.standardHours, 0);
    const totalOvertimeHours = model.laborDetails.reduce((total, row) => total + row.overtimeHours, 0);
    const modSummaryTitle = model.mod ? "TOTAL THIS MOD" : "TOTAL BASE";

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }}>
                <Stack spacing={1}>
                    <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => history.push(`/authorizations/view/${authorization.Id}`)} sx={{ alignSelf: "flex-start" }}>
                        Back to IWA
                    </Button>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="iwa-export-select-label">Export</InputLabel>
                        <Select
                            labelId="iwa-export-select-label"
                            label="Export"
                            value={model.option.key}
                            onChange={(event) => handleExportChange(event.target.value)}
                        >
                            {options.map((option) => (
                                <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Tooltip title={canCreatePdf ? "Print approved export" : approvalGateMessage}>
                        <span>
                            <Button startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!canCreatePdf}>
                                Print
                            </Button>
                        </span>
                    </Tooltip>
                    {!hasStoredPdf && (
                        <Tooltip title={canGeneratePdf ? "Save approved PDF to IWAExports" : approvalGateMessage}>
                            <span>
                                <Button startIcon={<PictureAsPdfOutlinedIcon />} onClick={handleGeneratePdf} disabled={!canGeneratePdf || isGeneratingPdf}>
                                    {isGeneratingPdf ? "Saving..." : "Save PDF"}
                                </Button>
                            </span>
                        </Tooltip>
                    )}
                    {canCreatePdf && storedPdfUrl && (
                        <Button startIcon={<OpenInNewOutlinedIcon />} onClick={() => window.open(storedPdfUrl, "_blank", "noopener,noreferrer")}>
                            Open PDF
                        </Button>
                    )}
                </Stack>
            </Stack>

            {!canCreatePdf && (
                <Alert severity="info">
                    PDF export and print are locked until this base IWA or Mod is fully approved. You can still review the on-screen preview.
                </Alert>
            )}

            {!canCreatePdf && (
                <Box sx={{ display: "none", "@media print": { display: "block" } }}>
                    <Typography variant="h6" fontWeight={700}>PDF export unavailable</Typography>
                    <Typography>{approvalGateMessage}</Typography>
                </Box>
            )}

            <Box sx={!canCreatePdf ? { "@media print": { display: "none" } } : undefined}>
                <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
                    <Stack spacing={2.5}>
                        <Stack spacing={0.75} sx={{ pb: 1, borderBottom: "3px solid", borderColor: "primary.dark" }}>
                            <Box>
                                <Typography variant="overline" color="primary" fontWeight={700}>Intercompany Work Authorization</Typography>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant="h4" fontWeight={800}>{model.title}</Typography>
                                    <Chip label={headerLabel} color="secondary" variant="outlined" />
                                </Stack>
                            </Box>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={0.5}>
                                <Typography color="text.secondary">Entity A: {authorization.donorEntity} providing services to Entity B: {authorization.receivingEntity}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: "left", md: "right" } }}>
                                    {storedPdfGeneratedOn ? `PDF Generated ${formatDate(storedPdfGeneratedOn, true)}` : "PDF not generated"}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Grid container spacing={1.5}>
                            {[
                                ["NEW LABOR", formatCurrency(model.modLaborTotal), `${totalStandardHours} std hrs / ${totalOvertimeHours} OT hrs`],
                                ["NEW TRAVEL", formatCurrency(model.modTravelTotal), `${model.travelDetails.length} line(s)`],
                                [modSummaryTitle, formatCurrency(model.modGrandTotal), exportLabel ?? "Base IWA"],
                                ["NEW GRAND TOTAL", formatCurrency(model.newGrandTotal), "Labor + Travel / ODC"]
                            ].map(([label, value, detail]) => (
                                <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper variant="outlined" sx={{ p: 1.5, height: "100%", borderLeft: "5px solid", borderLeftColor: "primary.main" }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                                        <Typography variant="h5" fontWeight={700}>{value}</Typography>
                                        <Typography variant="caption" color="text.secondary">{detail}</Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Box sx={sectionSx}>
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Transaction Header</Typography>
                            <Grid container spacing={2}>
                                {[
                                    ["ENTITY A (DONOR)", authorization.donorEntity, authorization.donorEntityAbbr],
                                    ["ENTITY B (RECEIVES SERVICES)", authorization.receivingEntity, authorization.receivingEntityAbbr],
                                    ["OG", authorization.og || "-", ""],
                                    ["LOB", authorization.lob || "-", ""],
                                    ["ENTITY A GM", authorization.donorGm?.Title || "-", ""],
                                    ["ENTITY B GM", authorization.receivingGm?.Title || "-", ""],
                                    ["CONTRACT ID", authorization.contractId || "-", authorization.customerContractCode],
                                    ["CONTRACT NAME", authorization.contractName || "-", ""],
                                    ["TASK ORDER", taskOrder?.field_14 || authorization.invoice || "-", taskOrder?.field_42],
                                    ["PROJECT MANAGER", authorization.pm?.Title || "-", ""],
                                    ["PERIOD", `${formatDate(model.periodStart, false)} - ${formatDate(model.periodEnd, false)}`, ""],
                                    ["SUBMITTER", model.requestedBy || "-", `Submitted ${formatDate(model.requestedOn, true)}`]
                                ].map(([label, value, detail]) => (
                                    <Grid key={label} spacing={0} size={{ xs: 12, md: 4 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", lineHeight: 1.05, mb: 0.5 }}>{label}</Typography>
                                        <Typography fontWeight={600} sx={{ mb: 0.15 }}>{value}</Typography>
                                        {detail && <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>{detail}</Typography>}
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>

                    {model.mod && (
                         <Box sx={sectionSx}>
                            <Stack spacing={0.75}>
                                <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Mod Summary</Typography>
                                {model.reason && <Typography color="text.secondary">{model.reason}</Typography>}
                                {(model.previousPeriodStart || model.previousPeriodEnd) && (
                                    <Typography variant="body2">
                                        Period changed from {formatDate(model.previousPeriodStart ?? model.periodStart, false)} - {formatDate(model.previousPeriodEnd ?? model.periodEnd, false)}
                                        {" "}to {formatDate(model.periodStart, false)} - {formatDate(model.periodEnd, false)}.
                                    </Typography>
                                )}
                            </Stack>
                        </Box>
                    )}

                        <Box sx={sectionSx}>
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Finance Coding Summary</Typography>
                            <TableContainer>
                                <Table size="small" sx={compactTableSx}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Line Type</TableCell>
                                            <TableCell>Job ID / CLIN</TableCell>
                                            <TableCell align="right">Previous</TableCell>
                                            <TableCell align="right">{model.mod ? "This Mod" : "Base"}</TableCell>
                                            <TableCell align="right">New Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {model.rows.flatMap((row: IIwaExportSummaryRow) => {
                                            const rows: JSX.Element[] = [];

                                            if (hasLaborSummaryAmount(row)) {
                                                rows.push(
                                                    <TableRow key={`labor-${row.jobId}`}>
                                                        <TableCell>Labor</TableCell>
                                                        <TableCell>{row.jobId}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.previousLabor)}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.modLabor)}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.newLabor)}</TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            if (hasTravelSummaryAmount(row)) {
                                                rows.push(
                                                    <TableRow key={`travel-${row.jobId}`}>
                                                        <TableCell>Travel / ODC</TableCell>
                                                        <TableCell>{row.jobId}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.previousTravel)}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.modTravel)}</TableCell>
                                                        <TableCell align="right">{formatCurrency(row.newTravel)}</TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return rows;
                                        })}
                                        <TableRow>
                                            <TableCell sx={totalCellSx} colSpan={2}>Grand Total</TableCell>
                                            <TableCell align="right" sx={totalCellSx}>{formatCurrency(model.previousGrandTotal)}</TableCell>
                                            <TableCell align="right" sx={totalCellSx}>{formatCurrency(model.modGrandTotal)}</TableCell>
                                            <TableCell align="right" sx={totalCellSx}>{formatCurrency(model.newGrandTotal)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        <Box sx={sectionSx}>
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Labor Detail - {contractTypeLabel}</Typography>
                            <TableContainer>
                                <Table size="small" sx={laborTableSx}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell className="labor-employee">Employee</TableCell>
                                            <TableCell className="labor-state">State</TableCell>
                                            <TableCell className="labor-job">Job ID / CLIN</TableCell>
                                            <TableCell className="labor-category">Labor Category</TableCell>
                                            <TableCell className="labor-std" align="right">STD</TableCell>
                                            <TableCell className="labor-ot" align="right">OT</TableCell>
                                            <TableCell className="labor-total" align="right">Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {model.laborDetails.map((row) => (
                                            <TableRow key={`${row.employeeName}-${row.jobId}-${row.laborCategory}`}>
                                                <TableCell className="labor-employee">{row.employeeName}</TableCell>
                                                <TableCell className="labor-state">{row.state}</TableCell>
                                                <TableCell className="labor-job">{row.jobId}</TableCell>
                                                <TableCell className="labor-category">{row.laborCategory}</TableCell>
                                                <TableCell className="labor-std" align="right">{row.standardHours}</TableCell>
                                                <TableCell className="labor-ot" align="right">{row.overtimeHours}</TableCell>
                                                <TableCell className="labor-total" align="right">{formatCurrency(row.totalAmount)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell sx={totalCellSx} colSpan={4}>Labor Totals</TableCell>
                                            <TableCell className="labor-std" align="right" sx={totalCellSx}>{totalStandardHours}</TableCell>
                                            <TableCell className="labor-ot" align="right" sx={totalCellSx}>{totalOvertimeHours}</TableCell>
                                            <TableCell className="labor-total" align="right" sx={totalCellSx}>{formatCurrency(model.modLaborTotal)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        <Box sx={sectionSx}>
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Travel / ODC Detail</Typography>
                            <TableContainer>
                                <Table size="small" sx={compactTableSx}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Job ID / CLIN</TableCell>
                                            <TableCell>Description</TableCell>
                                            <TableCell align="right">Amount</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {model.travelDetails.map((row) => (
                                            <TableRow key={`${row.lineType}-${row.jobId}-${row.description}`}>
                                                <TableCell>{row.lineType}</TableCell>
                                                <TableCell>{row.jobId}</TableCell>
                                                <TableCell>{row.description}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell sx={totalCellSx} colSpan={3}>Travel / ODC Totals</TableCell>
                                            <TableCell align="right" sx={totalCellSx}>{formatCurrency(model.modTravelTotal)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        <Box sx={sectionSx}>
                            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Approval Record</Typography>
                            <Grid container spacing={1}>
                                {model.approvals.map((row) => (
                                    <Grid key={row.stepKey} size={{ xs: 12, sm: 6, md: 3 }}>
                                        <Paper variant="outlined" sx={{ p: 1.25, height: "100%" }}>
                                            <Typography variant="caption" fontWeight={700}>{row.label}</Typography>
                                            <Typography
                                                title={row.actionBy}
                                                noWrap
                                                sx={{
                                                    //fontSize: getApprovalNameFontSize(row.actionBy),
                                                    lineHeight: 1.15,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis"
                                                }}
                                            >
                                                {row.actionBy}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">{formatDate(row.actionDate, true)}</Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {/* <Chip label={`${resources.filter((resource) => resource.isActive !== false).length} resources omitted from export detail`} variant="outlined" /> */}
                        {storedPdfGeneratedOn && <Chip label={`PDF generated ${formatDate(storedPdfGeneratedOn, true)}`} variant="outlined" />}
                        {storedPdfUrl && <Chip label="Stored PDF link available" variant="outlined" color="success" />}
                    </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Stack>
    );
};
