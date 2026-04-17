import * as React from "react";
import {
    Alert, Autocomplete, Box, Button, Chip, Divider, Grid, List, ListItem,
    ListItemText, Paper, Stack, Step, StepButton, Stepper, TextField, Typography
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import dayjs, { Dayjs } from "dayjs";
import { IPersonaProps } from "@fluentui/react";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useHistory } from "react-router-dom";
import { Web } from "gd-sprest";
import AlertDialog from "../ui/Alert";
import { PageHeader } from "../ui/PageHeader";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { CompactDateField } from "../ui/CompactDateField";
import { DataSource } from "../data/ds";
import { useIwa } from "../data/iwaContext";
import {
    AuthorizationStatus,
    ContractType,
    IAuthorizationItem,
    IContractItem,
    IEntityItem,
    IInvoiceItem,
    IOgItem,
    IPeoplePicker
} from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";
import { AuthorizationService } from "./iwaService";

interface IIwaFormProps {
    context: WebPartContext;
    mode: "new" | "edit";
    item?: IAuthorizationItem;
}

interface IAttachmentItem {
    FileName: string;
    ServerRelativeUrl?: string;
}

type IwaFormStep = 0 | 1 | 2;

const stepLabels: string[] = ["Basic Information", "Details", "Review & Submit"];

const contractTypeOptions: Array<{ value: ContractType; label: string; helperText: string; }> = [
    {
        value: "tm",
        label: "Time & Materials",
        helperText: "Use for employee/resource-based billing with hours and rates."
    },
    {
        value: "ffp",
        label: "Firm Fixed Price",
        helperText: "Use for lump-sum or period-based charging instead of hourly billing."
    }
];

const createEmptyAuthorization = (): IAuthorizationItem => ({
    Id: 0,
    Title: "Draft",
    authorizationStatus: "draft",
    donorEntity: "",
    receivingEntity: "",
    contractName: "",
    contractId: "",
    invoice: "",
    contractType: "tm",
    scopeOfWork: "",
    justification: "",
    notes: "",
    baseLaborAmount: 0,
    baseTravelAmount: 0,
    baseGrandTotal: 0,
    approvedLaborAmount: 0,
    approvedTravelAmount: 0,
    approvedGrandTotal: 0,
    modCount: 0
});

const toDayjs = (value?: string): Dayjs | undefined => {
    if (!value) {
        return undefined;
    }

    const next = dayjs(value);
    return next.isValid() ? next : undefined;
};

const toIsoDate = (value?: Dayjs): string | undefined => {
    if (!value?.isValid()) {
        return undefined;
    }

    return value.startOf("day").toISOString();
};

/**
 * First pass of the authorization create/edit form. The goal is to stand up
 * the header workflow and draft record immediately so attachments and related
 * line editors can plug into a known authorization Id next.
 */
export const IwaForm: React.FC<IIwaFormProps> = ({
    context,
    mode,
    item
}): JSX.Element => {
    const history = useHistory();
    const { refresh } = useIwa();

    const [activeStep, setActiveStep] = React.useState<IwaFormStep>(0);
    const [submitted, setSubmitted] = React.useState<boolean>(false);
    const [isBootstrapping, setIsBootstrapping] = React.useState<boolean>(mode === "new");
    const [isInvoicesLoading, setIsInvoicesLoading] = React.useState<boolean>(false);
    const [isSaving, setIsSaving] = React.useState<boolean>(false);
    const [draftId, setDraftId] = React.useState<number | undefined>(item?.Id);
    const [attachments, setAttachments] = React.useState<IAttachmentItem[]>([]);
    const [contractOgWarning, setContractOgWarning] = React.useState<string>("");

    const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [navigateAfterDialog, setNavigateAfterDialog] = React.useState<boolean>(false);

    const [form, setForm] = React.useState<IAuthorizationItem>(() => ({
        ...createEmptyAuthorization(),
        ...item
    }));

    const [periodStart, setPeriodStart] = React.useState<Dayjs | undefined>(() => toDayjs(item?.periodStart));
    const [periodEnd, setPeriodEnd] = React.useState<Dayjs | undefined>(() => toDayjs(item?.periodEnd));

    const peoplePickerContext = React.useMemo(() => ({
        absoluteUrl: context.pageContext.web.absoluteUrl,
        msGraphClientFactory: context.msGraphClientFactory,
        spHttpClient: context.spHttpClient
    }), [context.msGraphClientFactory, context.pageContext.web.absoluteUrl, context.spHttpClient]);

    const entityOptions = React.useMemo<IEntityItem[]>(() => {
        return [...DataSource.Entities].sort((left, right) => left.combinedTitle.localeCompare(right.combinedTitle));
    }, []);

    const ogOptions = React.useMemo<IOgItem[]>(() => {
        return DataSource.OGs
            .filter((og: IOgItem) => og.isActive !== false && og.isSelectable !== false)
            .sort((left, right) => left.Title.localeCompare(right.Title));
    }, []);

    const contractOptions = React.useMemo<IContractItem[]>(() => {
        return [...DataSource.Contracts].sort((left, right) => left.field_20.localeCompare(right.field_20));
    }, []);

    const invoiceOptions = React.useMemo<IInvoiceItem[]>(() => {
        return [...DataSource.Invoices].sort((left, right) => left.field_42.localeCompare(right.field_42));
    }, []);

    const selectedDonorEntity = React.useMemo<IEntityItem | null>(() => {
        return entityOptions.find((entity: IEntityItem) => entity.Title === form.donorEntity) ?? null;
    }, [entityOptions, form.donorEntity]);

    const selectedReceivingEntity = React.useMemo<IEntityItem | null>(() => {
        return entityOptions.find((entity: IEntityItem) => entity.Title === form.receivingEntity) ?? null;
    }, [entityOptions, form.receivingEntity]);

    const selectedContract = React.useMemo<IContractItem | null>(() => {
        return contractOptions.find((contract: IContractItem) => contract.field_19 === form.contractId) ?? null;
    }, [contractOptions, form.contractId]);

    const selectedInvoice = React.useMemo<IInvoiceItem | null>(() => {
        return invoiceOptions.find((invoice: IInvoiceItem) => invoice.InvoiceID1 === form.invoice) ?? null;
    }, [form.invoice, invoiceOptions]);

    const selectedOg = React.useMemo<IOgItem | null>(() => {
        return ogOptions.find((og: IOgItem) => og.Title === form.og) ?? null;
    }, [form.og, ogOptions]);

    const selectedContractType = React.useMemo(() => {
        return contractTypeOptions.find((option) => option.value === form.contractType) ?? contractTypeOptions[0];
    }, [form.contractType]);

    const showDialog = React.useCallback((title: string, message: string, navigateOnClose: boolean = false): void => {
        setDialogTitle(title);
        setDialogMessage(message);
        setDialogOpen(true);
        setNavigateAfterDialog(navigateOnClose);
    }, []);

    const handleCloseDialog = React.useCallback((): void => {
        setDialogOpen(false);

        if (navigateAfterDialog) {
            history.push("/my-work");
        }
    }, [history, navigateAfterDialog]);

    const updateField = React.useCallback(<K extends keyof IAuthorizationItem>(key: K, value: IAuthorizationItem[K]): void => {
        setForm((prev: IAuthorizationItem) => ({
            ...prev,
            [key]: value
        }));
    }, []);

    const handlePeoplePicker = React.useCallback((items: IPersonaProps[], field: keyof Pick<IAuthorizationItem, "pm" | "backupRequestor">): void => {
        const first = items[0];

        if (!first?.id || !first.text || !first.secondaryText) {
            updateField(field, undefined);
            return;
        }

        updateField(field, {
            Id: parseInt(first.id, 10),
            Title: first.text,
            EMail: first.secondaryText,
            id: first.id,
            text: first.text,
            secondaryText: first.secondaryText
        });
    }, [updateField]);

    const loadAttachments = React.useCallback(async (authorizationId: number): Promise<void> => {
        const files = await Web()
            .Lists(Strings.Sites.main.lists.Authorizations)
            .Items()
            .getById(authorizationId)
            .AttachmentFiles()
            .executeAndWait() as { results?: IAttachmentItem[]; };

        setAttachments((files?.results ?? []) as IAttachmentItem[]);
    }, []);

    const resolveProjectManager = React.useCallback(async (contract: IContractItem | null): Promise<IPeoplePicker | undefined> => {
        const email = contract?.field_21?.trim();

        if (!email) {
            return undefined;
        }

        try {
            const siteUser = await Web().SiteUsers().getByEmail(email).executeAndWait() as unknown as IPeoplePicker;

            if (!siteUser?.Id) {
                return undefined;
            }

            return {
                Id: siteUser.Id,
                Title: contract?.field_23 || siteUser.Title,
                EMail: email,
                id: String(siteUser.Id),
                text: contract?.field_23 || siteUser.Title,
                secondaryText: email
            };
        } catch (error) {
            console.warn("Unable to resolve PM from contract email.", error);
            return undefined;
        }
    }, []);

    const applyOgAndLobFromContract = React.useCallback((contract: IContractItem | null): void => {
        const contractOgTitle = contract?.field_75?.trim();

        if (!contractOgTitle) {
            setContractOgWarning("");
            return;
        }

        const og = ogOptions.find((option: IOgItem) => option.Title === contractOgTitle);

        if (!og) {
            setContractOgWarning(`The contract's default OG "${contractOgTitle}" is not active/selectable. Please choose the correct OG manually.`);
            return;
        }

        updateField("og", og.Title);
        updateField("lob", og.lob?.Title ?? "");
        setContractOgWarning("");
    }, [ogOptions, updateField]);

    React.useEffect((): void => {
        const bootstrapDraft = async (): Promise<void> => {
            if (mode !== "new") {
                return;
            }

            try {
                const nextDraftId = await AuthorizationService.createDraft();

                if (!nextDraftId) {
                    throw new Error("Draft authorization Id was not returned.");
                }

                setDraftId(nextDraftId);
                setForm((prev: IAuthorizationItem) => ({
                    ...prev,
                    Id: nextDraftId
                }));
                await loadAttachments(nextDraftId);
            } catch (error) {
                showDialog("Draft Creation Error", formatError(error));
            } finally {
                setIsBootstrapping(false);
            }
        };

        const loadExisting = async (): Promise<void> => {
            if (mode !== "edit" || !item?.Id) {
                setIsBootstrapping(false);
                return;
            }

            try {
                await loadAttachments(item.Id);
            } catch (error) {
                showDialog("Attachment Load Error", formatError(error));
            } finally {
                setIsBootstrapping(false);
            }
        };

        bootstrapDraft().catch((error) => {
            showDialog("Draft Creation Error", formatError(error));
            setIsBootstrapping(false);
        });
        loadExisting().catch((error) => {
            showDialog("Attachment Load Error", formatError(error));
            setIsBootstrapping(false);
        });
    }, [item?.Id, loadAttachments, mode, showDialog]);

    // Keep entity abbreviations and GMs aligned with the selected entities so
    // downstream numbering/workflow logic can trust the header values.
    React.useEffect((): void => {
        updateField("donorEntityAbbr", selectedDonorEntity?.abbr ?? "");
        updateField("donorGm", selectedDonorEntity?.GM);
    }, [selectedDonorEntity, updateField]);

    React.useEffect((): void => {
        updateField("receivingEntityAbbr", selectedReceivingEntity?.abbr ?? "");
        updateField("receivingGm", selectedReceivingEntity?.GM);
    }, [selectedReceivingEntity, updateField]);

    // When the contract changes, rehydrate invoice options and auto-apply
    // the PM / OG / LOB hints that we already trust from the JAMIS source.
    React.useEffect((): void => {
        const syncContract = async (): Promise<void> => {
            if (!selectedContract) {
                setAttachments((prev: IAttachmentItem[]) => prev);
                updateField("contractName", "");
                updateField("invoice", "");
                setContractOgWarning("");
                return;
            }

            updateField("contractName", selectedContract.field_20 ?? "");
            updateField("invoice", "");
            applyOgAndLobFromContract(selectedContract);

            const nextPm = await resolveProjectManager(selectedContract);
            updateField("pm", nextPm);

            setIsInvoicesLoading(true);

            try {
                await DataSource.getInvoicesByContract(selectedContract.field_19);
            } catch (error) {
                showDialog("Invoice Load Error", formatError(error));
            } finally {
                setIsInvoicesLoading(false);
            }
        };

        syncContract().catch((error) => {
            setIsInvoicesLoading(false);
            showDialog("Contract Sync Error", formatError(error));
        });
    }, [applyOgAndLobFromContract, resolveProjectManager, selectedContract, showDialog, updateField]);

    React.useEffect((): void => {
        if (!selectedOg) {
            return;
        }

        updateField("lob", selectedOg.lob?.Title ?? "");
    }, [selectedOg, updateField]);

    const donorEqualsReceiving = !!form.donorEntity && !!form.receivingEntity && form.donorEntity === form.receivingEntity;
    const missingInvoiceHint = !!form.contractId && !selectedInvoice;
    const periodEndBeforeStart = !!periodStart && !!periodEnd && periodEnd.isBefore(periodStart, "day");

    const validateStep = React.useCallback((step: IwaFormStep): boolean => {
        if (step === 0) {
            return Boolean(
                form.donorEntity &&
                form.receivingEntity &&
                !donorEqualsReceiving &&
                form.contractType &&
                form.contractId &&
                form.contractName &&
                form.pm?.Id &&
                form.og &&
                form.lob &&
                periodStart &&
                periodEnd &&
                !periodEndBeforeStart
            );
        }

        if (step === 1) {
            return Boolean((form.scopeOfWork ?? "").trim() && (form.justification ?? "").trim());
        }

        return true;
    }, [donorEqualsReceiving, form, periodEnd, periodEndBeforeStart, periodStart]);

    const handleStepButtonClick = React.useCallback((targetStep: number): void => {
        if (targetStep > activeStep && !validateStep(activeStep)) {
            setSubmitted(true);
            showDialog("Missing Required Information", "Please correct the highlighted fields before moving to the next step.");
            return;
        }

        setActiveStep(targetStep as IwaFormStep);
    }, [activeStep, showDialog, validateStep]);

    const handleNext = React.useCallback((): void => {
        if (!validateStep(activeStep)) {
            setSubmitted(true);
            showDialog("Missing Required Information", "Please correct the highlighted fields before moving to the next step.");
            return;
        }

        setActiveStep((prev: IwaFormStep) => Math.min(prev + 1, 2) as IwaFormStep);
    }, [activeStep, showDialog, validateStep]);

    const handlePrevious = React.useCallback((): void => {
        setActiveStep((prev: IwaFormStep) => Math.max(prev - 1, 0) as IwaFormStep);
    }, []);

    const handleUploadAttachment = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const input = event.currentTarget;
        const file = event.target.files?.[0];

        if (!file || !draftId) {
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            await Web()
                .Lists(Strings.Sites.main.lists.Authorizations)
                .Items()
                .getById(draftId)
                .AttachmentFiles()
                .add(file.name, buffer)
                .executeAndWait();

            await loadAttachments(draftId);
        } catch (error) {
            showDialog("Attachment Upload Error", formatError(error));
        } finally {
            input.value = "";
        }
    }, [draftId, loadAttachments, showDialog]);

    const handleRemoveAttachment = React.useCallback(async (fileName: string): Promise<void> => {
        if (!draftId) {
            return;
        }

        try {
            const file = await Web()
                .Lists(Strings.Sites.main.lists.Authorizations)
                .Items()
                .getById(draftId)
                .AttachmentFiles()
                .getByFileName(fileName)
                .executeAndWait();

            await file.delete().executeAndWait();
            await loadAttachments(draftId);
        } catch (error) {
            showDialog("Attachment Remove Error", formatError(error));
        }
    }, [draftId, loadAttachments, showDialog]);

    const persistAuthorization = React.useCallback(async (status: AuthorizationStatus): Promise<void> => {
        const authorizationId = draftId ?? form.Id;

        if (!authorizationId) {
            showDialog("Save Error", "The draft authorization is not ready yet. Please wait a moment and try again.");
            return;
        }

        setIsSaving(true);
        setSubmitted(true);

        const nextForm: IAuthorizationItem = {
            ...form,
            Id: authorizationId,
            authorizationStatus: status,
            periodStart: toIsoDate(periodStart),
            periodEnd: toIsoDate(periodEnd)
        };

        try {
            const saved = mode === "new" && status !== "draft"
                ? await AuthorizationService.submitNew(nextForm, status)
                : await AuthorizationService.edit(nextForm, status);

            setForm(saved);
            setDraftId(saved.Id);
            await refresh(true);

            if (status === "draft") {
                showDialog("Draft Saved", "The authorization header draft was saved. You can come back and continue building out resources, labor, and travel later.");
                return;
            }

            showDialog("Authorization Submitted", `Authorization ${saved.Title} was submitted successfully.`, true);
        } catch (error) {
            showDialog("Authorization Save Error", formatError(error));
        } finally {
            setIsSaving(false);
        }
    }, [draftId, form, mode, periodEnd, periodStart, refresh, showDialog]);

    const handleCancel = React.useCallback(async (): Promise<void> => {
        if (mode === "new" && draftId) {
            try {
                await AuthorizationService.delete(draftId);
            } catch (error) {
                showDialog("Draft Delete Error", formatError(error));
                return;
            }
        }

        history.push("/my-work");
    }, [draftId, history, mode, showDialog]);

    const renderSummaryCard = (title: string, helperText: string, icon: React.ReactNode, statusText: string): JSX.Element => {
        return (
            <Paper sx={{ p: 2.25, height: "100%" }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: "info.main", display: "flex", alignItems: "center" }}>
                            {icon}
                        </Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {title}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {helperText}
                    </Typography>
                    <Chip label={statusText} size="small" color="info" variant="outlined" sx={{ alignSelf: "flex-start" }} />
                </Stack>
            </Paper>
        );
    };

    const stepOneHasError = submitted && !validateStep(0);
    const stepTwoHasError = submitted && !validateStep(1);

    const basicInfoSection = (
        <Stack spacing={3}>
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700}>
                        Basic Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Start with the contract framing. The contract type and selected contract drive the downstream resource and labor experience.
                    </Typography>
                </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={entityOptions}
                            value={selectedDonorEntity}
                            onChange={(_, value: IEntityItem | null) => {
                                updateField("donorEntity", value?.Title ?? "");
                            }}
                            getOptionLabel={(option: IEntityItem) => option.combinedTitle || option.Title}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Donor Entity"
                                    required
                                    error={stepOneHasError && !form.donorEntity}
                                    helperText={stepOneHasError && !form.donorEntity ? "Donor entity is required." : "Entity providing employees or services."}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={entityOptions}
                            value={selectedReceivingEntity}
                            onChange={(_, value: IEntityItem | null) => {
                                updateField("receivingEntity", value?.Title ?? "");
                            }}
                            getOptionLabel={(option: IEntityItem) => option.combinedTitle || option.Title}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Receiving Entity"
                                    required
                                    error={(stepOneHasError && !form.receivingEntity) || donorEqualsReceiving}
                                    helperText={
                                        donorEqualsReceiving
                                            ? "Donor and receiving entities must be different."
                                            : stepOneHasError && !form.receivingEntity
                                                ? "Receiving entity is required."
                                                : "Entity receiving the work and cost."
                                    }
                                />
                            )}
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" fontWeight={600}>
                                Contract Type
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Choose the billing model first so the related line editors can enforce the right rules later.
                            </Typography>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                                {contractTypeOptions.map((option) => {
                                    const isSelected = form.contractType === option.value;

                                    return (
                                        <Paper
                                            key={option.value}
                                            onClick={() => updateField("contractType", option.value)}
                                            sx={{
                                                p: 2,
                                                flex: 1,
                                                cursor: "pointer",
                                                borderColor: isSelected ? "info.main" : undefined,
                                                backgroundColor: isSelected ? "action.hover" : "background.paper"
                                            }}
                                        >
                                            <Stack spacing={0.5}>
                                                <Typography variant="subtitle2" fontWeight={700}>
                                                    {option.label}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {option.helperText}
                                                </Typography>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={contractOptions}
                            value={selectedContract}
                            onChange={(_, value: IContractItem | null) => {
                                updateField("contractId", value?.field_19 ?? "");
                                updateField("contractName", value?.field_20 ?? "");
                            }}
                            getOptionLabel={(option: IContractItem) => `${option.field_19} | ${option.field_20}`}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Contract"
                                    required
                                    error={stepOneHasError && !form.contractId}
                                    helperText={stepOneHasError && !form.contractId ? "Contract is required." : "Select the JAMIS contract that anchors this authorization."}
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={invoiceOptions}
                            value={selectedInvoice}
                            loading={isInvoicesLoading}
                            onChange={(_, value: IInvoiceItem | null) => {
                                updateField("invoice", value?.InvoiceID1 ?? "");
                            }}
                            getOptionLabel={(option: IInvoiceItem) => `${option.field_14} | ${option.field_42}`}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Invoice / Task Order"
                                    helperText={
                                        !form.contractId
                                            ? "Select a contract first."
                                            : missingInvoiceHint
                                                ? "Invoice is optional for now. Leave blank if not applicable."
                                                : "Optional, but helpful when the work is tied to a specific invoice or task order."
                                    }
                                />
                            )}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <CompactDateField
                            label="Period Start"
                            value={periodStart}
                            onChange={setPeriodStart}
                            error={stepOneHasError && !periodStart}
                            helperText={stepOneHasError && !periodStart ? "Period start is required." : undefined}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <CompactDateField
                            label="Period End"
                            value={periodEnd}
                            onChange={setPeriodEnd}
                            error={(stepOneHasError && !periodEnd) || periodEndBeforeStart}
                            helperText={
                                periodEndBeforeStart
                                    ? "Period end must be on or after the start date."
                                    : stepOneHasError && !periodEnd
                                        ? "Period end is required."
                                        : undefined
                            }
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <MuiPeoplePicker
                            label="Project Manager"
                            context={peoplePickerContext}
                            required
                            value={form.pm?.EMail ? [form.pm.EMail] : undefined}
                            onChange={(items) => handlePeoplePicker(items, "pm")}
                            helperText="Auto-filled from the contract when possible, but still editable."
                            error={stepOneHasError && !form.pm?.Id}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <MuiPeoplePicker
                            label="Backup Requestor"
                            context={peoplePickerContext}
                            value={form.backupRequestor?.EMail ? [form.backupRequestor.EMail] : undefined}
                            onChange={(items) => handlePeoplePicker(items, "backupRequestor")}
                            helperText="Optional coverage when someone else may submit or restart workflow on your behalf."
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={ogOptions}
                            value={selectedOg}
                            onChange={(_, value: IOgItem | null) => {
                                updateField("og", value?.Title ?? "");
                                updateField("lob", value?.lob?.Title ?? "");
                                setContractOgWarning("");
                            }}
                            getOptionLabel={(option: IOgItem) => option.Title}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Operating Group"
                                    required
                                    error={stepOneHasError && !form.og}
                                    helperText={
                                        stepOneHasError && !form.og
                                            ? "OG is required."
                                            : contractOgWarning || "The contract default OG is applied when it matches an active/selectable OG."
                                    }
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            label="LOB"
                            fullWidth
                            value={form.lob ?? ""}
                            required
                            disabled
                            error={stepOneHasError && !form.lob}
                            helperText={stepOneHasError && !form.lob ? "LOB is required." : "Derived from the selected OG to keep routing/reporting aligned."}
                        />
                    </Grid>
                </Grid>
            </Paper>
        </Stack>
    );

    const detailsSection = (
        <Stack spacing={3}>
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700}>
                        Authorization Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Capture the narrative that reviewers will need, then use the draft workspace below for attachments and the related editors that plug into this header.
                    </Typography>
                </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Scope of Work"
                            fullWidth
                            required
                            multiline
                            minRows={4}
                            value={form.scopeOfWork ?? ""}
                            onChange={(event) => updateField("scopeOfWork", event.target.value)}
                            error={stepTwoHasError && !(form.scopeOfWork ?? "").trim()}
                            helperText={stepTwoHasError && !(form.scopeOfWork ?? "").trim() ? "Scope of work is required." : "Describe the work being authorized and what the donor entity is expected to deliver."}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Justification"
                            fullWidth
                            required
                            multiline
                            minRows={4}
                            value={form.justification ?? ""}
                            onChange={(event) => updateField("justification", event.target.value)}
                            error={stepTwoHasError && !(form.justification ?? "").trim()}
                            helperText={stepTwoHasError && !(form.justification ?? "").trim() ? "Justification is required." : "Give approvers enough context to understand why the intercompany work is needed now."}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Notes"
                            fullWidth
                            multiline
                            minRows={3}
                            value={form.notes ?? ""}
                            onChange={(event) => updateField("notes", event.target.value)}
                            helperText="Optional internal notes for admin, finance, or follow-up context."
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2.5}>
                    <Stack spacing={0.75}>
                        <Typography variant="h6" fontWeight={700}>
                            Draft Workspace
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            The draft header is created immediately so related records can attach to a real authorization Id from the start.
                        </Typography>
                        {!!draftId && (
                            <Alert severity="info" variant="outlined">
                                Draft Authorization Id: <strong>{draftId}</strong>
                            </Alert>
                        )}
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            {renderSummaryCard(
                                "Attachments",
                                "Files can already be added to the draft header and will travel with the authorization into workflow.",
                                <AttachFileOutlinedIcon />,
                                `${attachments.length} file${attachments.length === 1 ? "" : "s"}`
                            )}
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            {renderSummaryCard(
                                "Resources",
                                `Resource assignment will plug into this same draft Id next. Contract type is currently set to ${selectedContractType.label}.`,
                                <GroupOutlinedIcon />,
                                "Next Surface"
                            )}
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            {renderSummaryCard(
                                "Labor Lines",
                                "Labor charge lines will follow this header once the resource/labor editor is wired in.",
                                <ReceiptLongOutlinedIcon />,
                                "Next Surface"
                            )}
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            {renderSummaryCard(
                                "Travel / ODC",
                                "Travel and ODC line items will attach to this header the same way as labor lines.",
                                <TravelExploreOutlinedIcon />,
                                "Next Surface"
                            )}
                        </Grid>
                    </Grid>

                    <Divider />

                    <Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                            <Stack spacing={0.25}>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    Attachment Files
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    This is live against the saved draft record, so uploads are available before final submit.
                                </Typography>
                            </Stack>
                            <Button
                                component="label"
                                variant="outlined"
                                startIcon={<AddOutlinedIcon />}
                                disabled={!draftId}
                            >
                                Add Attachment
                                <input hidden type="file" onChange={(event) => {
                                    handleUploadAttachment(event).catch((error) => showDialog("Attachment Upload Error", formatError(error)));
                                }} />
                            </Button>
                        </Stack>

                        {attachments.length === 0 ? (
                            <Paper sx={{ p: 3, borderStyle: "dashed", textAlign: "center" }}>
                                <Stack spacing={0.75} alignItems="center">
                                    <DescriptionOutlinedIcon color="disabled" />
                                    <Typography variant="body1" fontWeight={600}>
                                        No attachments yet
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Upload supporting backup now, or come back once the resource and pricing lines are ready.
                                    </Typography>
                                </Stack>
                            </Paper>
                        ) : (
                            <List dense disablePadding>
                                {attachments.map((attachment: IAttachmentItem) => (
                                    <ListItem
                                        key={attachment.FileName}
                                        divider
                                        secondaryAction={(
                                            <Button
                                                color="error"
                                                size="small"
                                                startIcon={<DeleteOutlineOutlinedIcon />}
                                                onClick={() => {
                                                    handleRemoveAttachment(attachment.FileName).catch((error) => showDialog("Attachment Remove Error", formatError(error)));
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    >
                                        <ListItemText
                                            primary={attachment.FileName}
                                            secondary={attachment.ServerRelativeUrl ?? "Attached to current draft"}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Stack>
                </Stack>
            </Paper>
        </Stack>
    );

    const reviewSection = (
        <Stack spacing={3}>
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700}>
                        Review & Submit
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        This is the final pass before the authorization gets its official IWA number and moves into workflow.
                    </Typography>
                </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Donor / Receiver</Typography>
                        <Typography variant="body2" color="text.secondary">{`${form.donorEntity || "—"} -> ${form.receivingEntity || "—"}`}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Contract Framing</Typography>
                        <Typography variant="body2" color="text.secondary">{form.contractId || "—"} | {form.contractName || "—"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Contract Type</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedContractType.label}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Invoice / Task Order</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedInvoice ? `${selectedInvoice.field_14} | ${selectedInvoice.field_42}` : "Not specified"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Workflow Routing</Typography>
                        <Typography variant="body2" color="text.secondary">{form.pm?.Title || "—"} | {form.og || "—"} | {form.lob || "—"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Period</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {periodStart?.format("M/D/YYYY") || "—"} - {periodEnd?.format("M/D/YYYY") || "—"}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Divider sx={{ my: 0.5 }} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Scope of Work</Typography>
                        <Typography variant="body2" color="text.secondary">{(form.scopeOfWork ?? "").trim() || "—"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Justification</Typography>
                        <Typography variant="body2" color="text.secondary">{(form.justification ?? "").trim() || "—"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Notes</Typography>
                        <Typography variant="body2" color="text.secondary">{(form.notes ?? "").trim() || "No notes entered."}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" fontWeight={700}>Attachments</Typography>
                        <Typography variant="body2" color="text.secondary">{attachments.length} file(s) currently attached to the draft header.</Typography>
                    </Grid>
                </Grid>
            </Paper>
        </Stack>
    );

    return (
        <Stack spacing={3}>
            <PageHeader
                title={mode === "new" ? "Create Authorization" : `Edit ${form.Title || "Authorization"}`}
                subtitle="Build the authorization header first, then layer in attachments, resources, labor, and travel from the same draft record."
            />

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Stack spacing={0.5}>
                            <Typography variant="h6" fontWeight={700}>
                                Authorization Wizard
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Compact by design, with validation on step advance so we can keep the form shorter than a long scroll page.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={`Status: ${form.authorizationStatus}`} size="small" variant="outlined" />
                            {draftId && <Chip label={`Draft Id: ${draftId}`} size="small" color="info" variant="outlined" />}
                        </Stack>
                    </Stack>

                    <Stepper nonLinear activeStep={activeStep} alternativeLabel>
                        {stepLabels.map((label: string, index: number) => (
                            <Step key={label}>
                                <StepButton color="inherit" onClick={() => handleStepButtonClick(index)}>
                                    {label}
                                </StepButton>
                            </Step>
                        ))}
                    </Stepper>
                </Stack>
            </Paper>

            {isBootstrapping ? (
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Stack spacing={1}>
                        <Typography variant="h6" fontWeight={700}>
                            Creating Draft Authorization
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Setting up the header record now so attachments and related rows have somewhere to live.
                        </Typography>
                    </Stack>
                </Paper>
            ) : (
                <>
                    {activeStep === 0 && basicInfoSection}
                    {activeStep === 1 && detailsSection}
                    {activeStep === 2 && reviewSection}

                    <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "stretch", md: "center" }}
                            spacing={1.5}
                        >
                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="text"
                                    color="inherit"
                                    onClick={() => {
                                        handleCancel().catch((error) => showDialog("Cancel Error", formatError(error)));
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<SaveOutlinedIcon />}
                                    disabled={isSaving}
                                    onClick={() => {
                                        persistAuthorization("draft").catch((error) => showDialog("Save Error", formatError(error)));
                                    }}
                                >
                                    Save Draft
                                </Button>
                            </Stack>

                            <Stack direction="row" spacing={1} justifyContent={{ xs: "space-between", md: "flex-end" }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<ArrowBackOutlinedIcon />}
                                    disabled={activeStep === 0 || isSaving}
                                    onClick={handlePrevious}
                                >
                                    Previous
                                </Button>

                                {activeStep < 2 ? (
                                    <Button
                                        variant="contained"
                                        endIcon={<ArrowForwardOutlinedIcon />}
                                        disabled={isSaving}
                                        onClick={handleNext}
                                    >
                                        Next
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        startIcon={<SendOutlinedIcon />}
                                        disabled={isSaving}
                                        onClick={() => {
                                            if (!validateStep(0) || !validateStep(1)) {
                                                setSubmitted(true);
                                                showDialog("Missing Required Information", "Complete the required fields on the earlier steps before submitting.");
                                                return;
                                            }

                                            persistAuthorization("submitted").catch((error) => showDialog("Submit Error", formatError(error)));
                                        }}
                                    >
                                        Submit Authorization
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Paper>
                </>
            )}

            <AlertDialog
                open={dialogOpen}
                title={dialogTitle}
                message={dialogMessage}
                onClose={handleCloseDialog}
            />
        </Stack>
    );
};
