import * as React from "react";
import {
    Autocomplete, Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Link, Paper, Stack, Step, StepButton, Stepper, TextField, Typography
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import NavigateNextOutlinedIcon from "@mui/icons-material/NavigateNextOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { alpha } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import { IPersonaProps } from "@fluentui/react";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";
import { Web } from "gd-sprest";
import AlertDialog from "../ui/Alert";
import { PageHeader } from "../ui/PageHeader";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { CompactDateField } from "../ui/CompactDateField";
import { useShellUi } from "../ui/ShellUiContext";
import { DataSource } from "../data/ds";
import { useIwa } from "../data/iwaContext";
import {
    AuthorizationStatus,
    ContractType,
    IAuthorizationItem,
    IContractItem,
    IEntityItem,
    IInvoiceItem,
    IJobItem,
    IOgItem,
    IPeoplePicker
} from "../data/props";
import Strings from "../common/strings";
import { formatDate, formatError } from "../common/utils";
import { authorizationStatusLabels, workflowRunStatusLabels } from "../layout/allAuthorizationsUtils";
import { AuthorizationService } from "./iwaService";
import { ApproverResolver } from "../workflow/defaultApprovers";
import { WorkflowRunService } from "../workflow/runService";
import { WorkflowActionService } from "../workflow/actionService";
import { captureIwaChangeSet } from "../workflow/changeCapture";
import { IwaReviewSection } from "./IwaReviewSection";
import { IwaAttachmentsPanel } from "./IwaAttachmentsPanel";
import {
    IFfpLaborConfig,
    IEditableResourceRow,
    IEditableTravelRow,
    IwaWorkPackageStep
} from "./IwaWorkPackageStep";
import { ResourceService } from "../resources/resourceService";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";

interface IIwaFormProps {
    context: WebPartContext;
    mode: "new" | "edit";
    item?: IAuthorizationItem;
}

interface IAuthorizationFormLocationState {
    returnTo?: string;
}

type IwaFormStep = 0 | 1 | 2 | 3;

const stepLabels: string[] = ["Basic Information", "Resources & Travel", "Details & Attachments", "Review & Submit"];

const normalizeAuthorizationStatus = (status: AuthorizationStatus | string | undefined): AuthorizationStatus => {
    const rawStatus = String(status ?? "draft").trim();
    const lowerStatus = rawStatus.toLowerCase();

    if (lowerStatus === "draft") {
        return "draft";
    }

    if (lowerStatus === "submitted") {
        return "submitted";
    }

    if (lowerStatus === "underreview") {
        return "underReview";
    }

    if (lowerStatus === "approved") {
        return "approved";
    }

    if (lowerStatus === "rejected") {
        return "rejected";
    }

    if (lowerStatus === "canceled") {
        return "canceled";
    }

    if (lowerStatus === "closed") {
        return "closed";
    }

    return "draft";
};

const isDraftStatus = (status: AuthorizationStatus | string | undefined): boolean =>
    normalizeAuthorizationStatus(status) === "draft";

const createLocalRowId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyResourceRow = (): IEditableResourceRow => ({
    id: createLocalRowId(),
    state: "",
    comments: "",
    jobId: "",
    laborCategory: "",
    standardHours: "",
    overtimeHours: "",
    annualSalary: "",
    standardRate: "",
    overtimeRate: ""
});

const createEmptyTravelRow = (): IEditableTravelRow => ({
    id: createLocalRowId(),
    lineType: "travel",
    jobId: "",
    description: "",
    amount: "",
    comments: ""
});

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

const normalizeUniqueValue = (value?: string): string => (value ?? "").trim().toLowerCase();

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
    const location = useLocation<IAuthorizationFormLocationState | undefined>();
    const {
        clearAuthorizationDetailCache,
        authorizations,
        draftAuthorizations,
        laborLinesByAuthorizationId,
        loadAuthorizationDetail,
        refresh,
        resourcesByAuthorizationId,
        runByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();
    const { showBusy, hideBusy, showSuccess, hideSuccess } = useShellUi();
    const successTimeoutRef = React.useRef<number | undefined>(undefined);
    const initialAuthorizationRef = React.useRef<IAuthorizationItem | undefined>(item);
    const lastSyncedContractIdRef = React.useRef<string | undefined>(item?.contractId);
    const returnTo = location.state?.returnTo || sessionStorage.getItem("iwa:lastReturnLocation") || "/my-work/all";

    const [activeStep, setActiveStep] = React.useState<IwaFormStep>(0);
    const [submitted, setSubmitted] = React.useState<boolean>(false);
    const [isBootstrapping, setIsBootstrapping] = React.useState<boolean>(mode === "new");
    const [isInvoicesLoading, setIsInvoicesLoading] = React.useState<boolean>(false);
    const [isSaving, setIsSaving] = React.useState<boolean>(false);
    const [draftId, setDraftId] = React.useState<number | undefined>(item?.Id);
    const [attachments, setAttachments] = React.useState<Array<{ FileName: string; ServerRelativeUrl?: string; }>>([]);
    const [contractOgWarning, setContractOgWarning] = React.useState<string>("");
    const [invoiceOptions, setInvoiceOptions] = React.useState<IInvoiceItem[]>(() => [...DataSource.Invoices]);
    const [jobOptions, setJobOptions] = React.useState<IJobItem[]>(() => [...DataSource.Jobs]);
    const [resourceRows, setResourceRows] = React.useState<IEditableResourceRow[]>([]);
    const [travelRows, setTravelRows] = React.useState<IEditableTravelRow[]>([]);
    const [ffpLaborConfig, setFfpLaborConfig] = React.useState<IFfpLaborConfig>({
        jobId: "",
        laborCategory: "",
        comments: ""
    });
    const stateOptions = React.useMemo<string[]>(() => [...DataSource.States], []);

    const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
    const [dialogTitle, setDialogTitle] = React.useState<string>("");
    const [dialogMessage, setDialogMessage] = React.useState<string>("");
    const [navigateAfterDialog, setNavigateAfterDialog] = React.useState<boolean>(false);
    const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = React.useState<boolean>(false);
    const [duplicateMatch, setDuplicateMatch] = React.useState<IAuthorizationItem | undefined>(undefined);

    const [form, setForm] = React.useState<IAuthorizationItem>(() => ({
        ...createEmptyAuthorization(),
        ...item
    }));

    const [periodStart, setPeriodStart] = React.useState<Dayjs | undefined>(() => toDayjs(item?.periodStart));
    const [periodEnd, setPeriodEnd] = React.useState<Dayjs | undefined>(() => toDayjs(item?.periodEnd));
    const isExistingSubmittedEdit = mode === "edit" && !isDraftStatus(form.authorizationStatus);
    const isDraftAuthorization = isDraftStatus(form.authorizationStatus);
    const duplicateRun = duplicateMatch?.Id ? runByAuthorizationId.get(duplicateMatch.Id) : undefined;

    React.useEffect(() => {
        return () => {
            if (successTimeoutRef.current) {
                window.clearTimeout(successTimeoutRef.current);
            }
        };
    }, []);

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

    const sortedInvoiceOptions = React.useMemo<IInvoiceItem[]>(() => {
        return [...invoiceOptions].sort((left, right) => left.field_42.localeCompare(right.field_42));
    }, [invoiceOptions]);

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
        return sortedInvoiceOptions.find((invoice: IInvoiceItem) => invoice.InvoiceID1 === form.invoice) ?? null;
    }, [form.invoice, sortedInvoiceOptions]);

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

    const findMatchingAuthorization = React.useCallback((): IAuthorizationItem | undefined => {
        const donorEntity = normalizeUniqueValue(form.donorEntity);
        const receivingEntity = normalizeUniqueValue(form.receivingEntity);
        const contractId = normalizeUniqueValue(form.contractId);
        const invoice = normalizeUniqueValue(form.invoice);

        if (!donorEntity || !receivingEntity || !contractId) {
            return undefined;
        }

        const currentId = draftId ?? form.Id;

        return [...draftAuthorizations, ...authorizations].find((authorization) => {
            if (authorization.Id === currentId) {
                return false;
            }

            return normalizeUniqueValue(authorization.donorEntity) === donorEntity &&
                normalizeUniqueValue(authorization.receivingEntity) === receivingEntity &&
                normalizeUniqueValue(authorization.contractId) === contractId &&
                normalizeUniqueValue(authorization.invoice) === invoice;
        });
    }, [authorizations, draftAuthorizations, draftId, form.Id, form.contractId, form.donorEntity, form.invoice, form.receivingEntity]);

    const ensureUniqueAuthorizationCombination = React.useCallback((): boolean => {
        const match = findMatchingAuthorization();

        if (!match) {
            return true;
        }

        setDuplicateMatch(match);
        return false;
    }, [findMatchingAuthorization]);

    const handleCloseDialog = React.useCallback((): void => {
        setDialogOpen(false);

        if (navigateAfterDialog) {
            history.push(returnTo);
        }
    }, [history, navigateAfterDialog, returnTo]);

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
            .executeAndWait() as { results?: Array<{ FileName: string; ServerRelativeUrl?: string; }>; };

        setAttachments((files?.results ?? []) as Array<{ FileName: string; ServerRelativeUrl?: string; }>);
    }, []);

    const loadWorkPackageDraft = React.useCallback(async (authorizationId: number): Promise<void> => {
        const [resources, laborLines, travelOdcs] = await Promise.all([
            ResourceService.getByAuthorization(authorizationId),
            LaborLineItemService.getByAuthorization(authorizationId),
            TravelOdcService.getByAuthorization(authorizationId)
        ]);

        const sortedResources = [...(resources ?? [])].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const sortedLaborLines = [...(laborLines ?? [])].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const sortedTravelOdcs = [...(travelOdcs ?? [])].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));

        const tmLaborByResourceId = new Map<number, typeof sortedLaborLines[number]>();

        sortedLaborLines.forEach((line) => {
            if (line.pricingType !== "tm") {
                return;
            }

            const resourceId = line.resources?.results?.[0]?.Id;

            if (resourceId) {
                tmLaborByResourceId.set(resourceId, line);
            }
        });

        const nextResources: IEditableResourceRow[] = sortedResources.map((resource) => {
            const tmLabor = tmLaborByResourceId.get(resource.Id);

            return {
                id: String(resource.Id),
                employee: resource.employee,
                state: resource.state ?? "",
                comments: resource.comments ?? "",
                jobId: tmLabor?.jobId ?? "",
                laborCategory: tmLabor?.laborCategory ?? "",
                standardHours: tmLabor?.standardHours !== undefined && tmLabor?.standardHours !== null ? String(tmLabor.standardHours) : "",
                overtimeHours: tmLabor?.overtimeHours !== undefined && tmLabor?.overtimeHours !== null ? String(tmLabor.overtimeHours) : "",
                annualSalary: tmLabor?.annualSalary !== undefined && tmLabor?.annualSalary !== null ? String(tmLabor.annualSalary) : "",
                standardRate: tmLabor?.standardRate !== undefined && tmLabor?.standardRate !== null ? String(tmLabor.standardRate) : "",
                overtimeRate: tmLabor?.overtimeRate !== undefined && tmLabor?.overtimeRate !== null ? String(tmLabor.overtimeRate) : ""
            };
        });

        setResourceRows(nextResources);

        const ffpLabor = sortedLaborLines.find((line) => line.pricingType === "ffp");
        setFfpLaborConfig({
            jobId: ffpLabor?.jobId ?? "",
            laborCategory: ffpLabor?.laborCategory ?? "",
            comments: ffpLabor?.comments ?? ""
        });

        const nextTravelRows: IEditableTravelRow[] = sortedTravelOdcs.map((travel) => ({
            id: String(travel.Id),
            lineType: travel.lineType,
            jobId: travel.jobId ?? "",
            description: travel.description ?? "",
            amount: String(travel.amount ?? ""),
            comments: travel.comments ?? ""
        }));

        setTravelRows(nextTravelRows);
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
                await Promise.all([
                    loadAttachments(item.Id),
                    loadWorkPackageDraft(item.Id)
                ]);
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
    }, [item?.Id, loadAttachments, loadWorkPackageDraft, mode, showDialog]);

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
                setAttachments((prev) => prev);
                setInvoiceOptions([]);
                setJobOptions([]);
                updateField("contractName", "");
                updateField("invoice", "");
                setContractOgWarning("");
                return;
            }

            const previousContractId = lastSyncedContractIdRef.current;
            const firstContractSync = !previousContractId;
            const contractActuallyChanged = !!previousContractId && previousContractId !== selectedContract.field_19;
            lastSyncedContractIdRef.current = selectedContract.field_19;

            updateField("contractName", selectedContract.field_20 ?? "");
            if (contractActuallyChanged) {
                updateField("invoice", "");
            }
            applyOgAndLobFromContract(selectedContract);

            if (contractActuallyChanged || (firstContractSync && !form.pm?.Id)) {
                const nextPm = await resolveProjectManager(selectedContract);
                updateField("pm", nextPm);
            }

            setIsInvoicesLoading(true);

            try {
                const [invoices, jobs] = await Promise.all([
                    DataSource.getInvoicesByContract(selectedContract.field_19),
                    DataSource.getJobsByContract(selectedContract.field_19)
                ]);
                setInvoiceOptions([...(invoices ?? [])]);
                setJobOptions([...(jobs ?? [])]);
            } catch (error) {
                setInvoiceOptions([]);
                setJobOptions([]);
                showDialog("Invoice Load Error", formatError(error));
            } finally {
                setIsInvoicesLoading(false);
            }
        };

        syncContract().catch((error) => {
            setIsInvoicesLoading(false);
            showDialog("Contract Sync Error", formatError(error));
        });
    }, [applyOgAndLobFromContract, form.pm?.Id, resolveProjectManager, selectedContract, showDialog, updateField]);

    React.useEffect((): void => {
        if (!selectedOg) {
            return;
        }

        updateField("lob", selectedOg.lob?.Title ?? "");
    }, [selectedOg, updateField]);

    const donorEqualsReceiving = !!form.donorEntity && !!form.receivingEntity && form.donorEntity === form.receivingEntity;
    const missingInvoiceHint = !!form.contractId && !selectedInvoice;
    const periodEndBeforeStart = !!periodStart && !!periodEnd && periodEnd.isBefore(periodStart, "day");

    const addResourceRow = React.useCallback((row?: IEditableResourceRow): void => {
        setResourceRows((prev) => [...prev, row ? { ...row, id: createLocalRowId() } : createEmptyResourceRow()]);
    }, []);

    const removeResourceRow = React.useCallback((id: string): void => {
        setResourceRows((prev) => {
            const next = prev.filter((row) => row.id !== id);
            return next;
        });
    }, []);

    const updateResourceRow = React.useCallback((id: string, patch: Partial<IEditableResourceRow>): void => {
        setResourceRows((prev) => prev.map((row) => row.id === id ? { ...row, ...patch } : row));
    }, []);

    const addTravelRow = React.useCallback((row?: IEditableTravelRow): void => {
        setTravelRows((prev) => [...prev, row ? { ...row, id: createLocalRowId() } : createEmptyTravelRow()]);
    }, []);

    const removeTravelRow = React.useCallback((id: string): void => {
        setTravelRows((prev) => prev.filter((row) => row.id !== id));
    }, []);

    const updateTravelRow = React.useCallback((id: string, patch: Partial<IEditableTravelRow>): void => {
        setTravelRows((prev) => prev.map((row) => row.id === id ? { ...row, ...patch } : row));
    }, []);

    const updateFfpLabor = React.useCallback((patch: Partial<IFfpLaborConfig>): void => {
        setFfpLaborConfig((prev) => ({ ...prev, ...patch }));
    }, []);

    const resourceStepIsValid = React.useMemo((): boolean => {
        if (resourceRows.length === 0) {
            return false;
        }

        const hasAtLeastOneAssignedResource = resourceRows.some((row) => !!row.employee?.Id);

        if (!hasAtLeastOneAssignedResource) {
            return false;
        }

        const resourcesValid = resourceRows.every((row) => {
            if (!row.employee?.Id) {
                return false;
            }

            if (!row.state.trim()) {
                return false;
            }

            if (form.contractType === "tm") {
                const standardHours = row.standardHours.trim();
                const overtimeHours = row.overtimeHours.trim();
                const hasHours = standardHours || overtimeHours;

                return !!row.jobId.trim() &&
                    !!row.laborCategory.trim() &&
                    !!hasHours &&
                    (!standardHours || !Number.isNaN(Number(standardHours))) &&
                    (!overtimeHours || !Number.isNaN(Number(overtimeHours)));
            }

            return true;
        });

        if (!resourcesValid) {
            return false;
        }

        if (form.contractType === "ffp" && (!ffpLaborConfig.jobId.trim() || !ffpLaborConfig.laborCategory.trim())) {
            return false;
        }

        const travelValid = travelRows.every((row) => {
            if (!row.jobId.trim()) {
                return false;
            }

            if (!row.amount.trim()) {
                return false;
            }

            return !Number.isNaN(Number(row.amount));
        });

        return travelValid;
    }, [ffpLaborConfig.jobId, ffpLaborConfig.laborCategory, form.contractType, resourceRows, travelRows]);

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
            return resourceStepIsValid;
        }

        if (step === 2) {
            return Boolean((form.scopeOfWork ?? "").trim() && (form.justification ?? "").trim());
        }

        return true;
    }, [donorEqualsReceiving, form, periodEnd, periodEndBeforeStart, periodStart, resourceStepIsValid]);

    const handleStepButtonClick = React.useCallback((targetStep: number): void => {
        if (targetStep > activeStep && activeStep === 0 && !ensureUniqueAuthorizationCombination()) {
            return;
        }

        if (targetStep > activeStep && !validateStep(activeStep)) {
            setSubmitted(true);
            showDialog("Missing Required Information", "Please correct the highlighted fields before moving to the next step.");
            return;
        }

        setActiveStep(targetStep as IwaFormStep);
    }, [activeStep, ensureUniqueAuthorizationCombination, showDialog, validateStep]);

    const handleNext = React.useCallback((): void => {
        if (activeStep === 0 && !ensureUniqueAuthorizationCombination()) {
            return;
        }

        if (!validateStep(activeStep)) {
            setSubmitted(true);
            showDialog("Missing Required Information", "Please correct the highlighted fields before moving to the next step.");
            return;
        }

        setActiveStep((prev: IwaFormStep) => Math.min(prev + 1, 3) as IwaFormStep);
    }, [activeStep, ensureUniqueAuthorizationCombination, showDialog, validateStep]);

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

    const syncWorkPackageData = React.useCallback(async (authorizationId: number): Promise<Pick<IAuthorizationItem, "baseLaborAmount" | "baseTravelAmount" | "baseGrandTotal">> => {
        const activeResources = resourceRows
            .filter((row) => row.employee?.Id)
            .map((row, index) => ({
                title: `Resource-${index + 1}-${row.employee?.Title ?? "Employee"}`,
                lineNumber: index + 1,
                displayOrder: index + 1,
                employeeId: row.employee!.Id,
                state: row.state.trim(),
                comments: row.comments.trim()
            }));

        const createdResources = await ResourceService.replaceForAuthorization(authorizationId, activeResources);
        const createdByLineNumber = new Map<number, number>();
        createdResources.forEach((resource) => {
            if (resource.lineNumber) {
                createdByLineNumber.set(resource.lineNumber, resource.Id);
            }
        });

        const laborRows = form.contractType === "tm"
            ? resourceRows
                .filter((row) => row.employee?.Id)
                .map((row, index) => ({
                    title: `Labor-${index + 1}-${row.employee?.Title ?? "Employee"}`,
                    lineNumber: index + 1,
                    displayOrder: index + 1,
                    pricingType: "tm" as const,
                    jobId: row.jobId.trim(),
                    laborCategory: row.laborCategory.trim(),
                    resourceIds: [createdByLineNumber.get(index + 1)].filter((value): value is number => typeof value === "number"),
                    comments: row.comments.trim(),
                    annualSalary: Number(row.annualSalary || 0),
                    standardRate: Number(row.standardRate || 0),
                    overtimeRate: Number(row.overtimeRate || 0),
                    standardHours: Number(row.standardHours || 0),
                    overtimeHours: Number(row.overtimeHours || 0)
                }))
            : [{
                title: "Labor-1-FFP",
                lineNumber: 1,
                displayOrder: 1,
                pricingType: "ffp" as const,
                jobId: ffpLaborConfig.jobId.trim(),
                laborCategory: ffpLaborConfig.laborCategory.trim(),
                resourceIds: createdResources.map((resource) => resource.Id),
                comments: ffpLaborConfig.comments.trim()
            }];

        const savedLaborLines = await LaborLineItemService.replaceForAuthorization(authorizationId, laborRows);

        const activeTravelRows = travelRows.map((row, index) => ({
            title: `${row.lineType.toUpperCase()}-${index + 1}`,
            lineNumber: index + 1,
            displayOrder: index + 1,
            lineType: row.lineType,
            jobId: row.jobId.trim(),
            description: row.description.trim(),
            amount: Number(row.amount || 0),
            comments: row.comments.trim()
        }));

        const savedTravelRows = await TravelOdcService.replaceForAuthorization(authorizationId, activeTravelRows);

        const baseLaborAmount = savedLaborLines.reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
        const baseTravelAmount = savedTravelRows.reduce((total, line) => total + Number(line.amount ?? 0), 0);
        const baseGrandTotal = baseLaborAmount + baseTravelAmount;

        const totals = {
            baseLaborAmount,
            baseTravelAmount,
            baseGrandTotal
        };

        await AuthorizationService.updateBaseAmounts(authorizationId, totals);

        return totals;
    }, [ffpLaborConfig.comments, ffpLaborConfig.jobId, ffpLaborConfig.laborCategory, form.contractType, resourceRows, travelRows]);

    const persistAuthorization = React.useCallback(async (status: AuthorizationStatus): Promise<void> => {
        const authorizationId = draftId ?? form.Id;

        if (!authorizationId) {
            showDialog("Save Error", "The draft authorization is not ready yet. Please wait a moment and try again.");
            return;
        }

        if (!ensureUniqueAuthorizationCombination()) {
            return;
        }

        setIsSaving(true);
        setSubmitted(true);
        const normalizedStatus = normalizeAuthorizationStatus(status);

        showBusy(
            normalizedStatus === "draft"
                ? "Saving authorization draft..."
                : isExistingSubmittedEdit
                    ? "Saving authorization changes..."
                    : "Submitting authorization..."
        );

        const nextForm: IAuthorizationItem = {
            ...form,
            Id: authorizationId,
            authorizationStatus: normalizedStatus,
            periodStart: toIsoDate(periodStart),
            periodEnd: toIsoDate(periodEnd)
        };

        try {
            let saved: IAuthorizationItem;
            const isFirstSubmit = normalizedStatus !== "draft" && isDraftStatus(form.authorizationStatus);

            if (isFirstSubmit) {
                showBusy("Submitting authorization...");
                const approvers = await ApproverResolver.resolve(nextForm);

                saved = await AuthorizationService.submitNew(nextForm, normalizedStatus);

                showBusy("Creating new workflow...");
                const firstRun = await WorkflowRunService.createFirstRun(saved, approvers);
                showBusy("Updating workflow linkages...");
                await AuthorizationService.updateRunId(saved.Id, firstRun.Id);
                await WorkflowActionService.createSubmitted(saved, firstRun);

                saved = {
                    ...saved,
                    currentWorkflowRun: {
                        Id: firstRun.Id,
                        Title: firstRun.Title
                    }
                };
            } else {
                saved = await AuthorizationService.edit(nextForm, normalizedStatus);
            }

            const totals = await syncWorkPackageData(saved.Id);
            saved = {
                ...saved,
                ...totals
            };

            const activeRun = runByAuthorizationId.get(saved.Id);

            if (
                normalizedStatus !== "draft" &&
                isExistingSubmittedEdit &&
                !isFirstSubmit &&
                activeRun?.Id &&
                activeRun.hasDecision
            ) {
                showBusy("Restarting workflow...");
                const approvers = await ApproverResolver.resolve(saved);
                const changeSet = captureIwaChangeSet({
                    beforeAuthorization: initialAuthorizationRef.current,
                    afterAuthorization: saved,
                    beforeResources: resourcesByAuthorizationId.get(saved.Id) ?? [],
                    beforeLaborLines: laborLinesByAuthorizationId.get(saved.Id) ?? [],
                    beforeTravelOdcs: travelOdcsByAuthorizationId.get(saved.Id) ?? [],
                    afterResourceRows: resourceRows,
                    afterTravelRows: travelRows,
                    afterFfpLaborConfig: ffpLaborConfig
                });
                const restartReason = "Modify and resubmit";
                showBusy("Creating new workflow...");
                const nextRun = await WorkflowRunService.createRestartRun(
                    saved,
                    (activeRun.runNumber ?? 0) + 1,
                    approvers,
                    restartReason,
                    changeSet.changeSummary
                );

                showBusy("Updating workflow linkages...");
                await AuthorizationService.updateRunId(saved.Id, nextRun.Id);
                await WorkflowRunService.supersedeRun(activeRun.Id, restartReason, changeSet.changeSummary);
                showBusy("Capturing change history...");
                await WorkflowActionService.createRestarted(saved, activeRun, changeSet.changeSummary);
                await WorkflowActionService.createSubmitted(saved, nextRun, {
                    actionType: "modified",
                    comments: changeSet.changeSummary,
                    changeSummary: changeSet.changeSummary,
                    changePayloadJson: changeSet.changePayloadJson
                });

                saved = {
                    ...saved,
                    currentWorkflowRun: {
                        Id: nextRun.Id,
                        Title: nextRun.Title
                    }
                };
            } else {
                const nextPmId = saved.pm?.Id ?? null;
                const pendingPmApproverId = activeRun?.pendingApprover?.Id ?? null;

                if (
                    normalizedStatus !== "draft" &&
                    activeRun?.Id &&
                    activeRun.runStatus === "active" &&
                    activeRun.currentStepKey === "pm" &&
                    typeof nextPmId === "number" &&
                    pendingPmApproverId !== nextPmId
                ) {
                    await WorkflowRunService.updatePendingApprover(activeRun.Id, nextPmId);
                }
            }

            setForm(saved);
            setDraftId(saved.Id);
            clearAuthorizationDetailCache(saved.Id);
            await Promise.all([
                refresh(true),
                loadAuthorizationDetail(saved.Id, true)
            ]);

            if (normalizedStatus === "draft") {
                showSuccess("Draft saved successfully.");
                if (successTimeoutRef.current) {
                    window.clearTimeout(successTimeoutRef.current);
                }
                successTimeoutRef.current = window.setTimeout(() => {
                    hideSuccess();
                }, 1500);
                return;
            }

            if (isExistingSubmittedEdit && !isFirstSubmit) {
                const activeRunBeforeSave = runByAuthorizationId.get(saved.Id);
                showSuccess(activeRunBeforeSave?.hasDecision ? "Authorization changes saved and workflow restarted." : "Authorization changes saved successfully.");
                if (successTimeoutRef.current) {
                    window.clearTimeout(successTimeoutRef.current);
                }
                successTimeoutRef.current = window.setTimeout(() => {
                    hideSuccess();
                    history.push(returnTo);
                }, 1500);
                return;
            }

            showSuccess(`Authorization ${saved.Title} was submitted successfully.`);
            if (successTimeoutRef.current) {
                window.clearTimeout(successTimeoutRef.current);
            }
            successTimeoutRef.current = window.setTimeout(() => {
                hideSuccess();
                history.push(returnTo);
            }, 1500);
        } catch (error) {
            hideBusy();
            showDialog("Authorization Save Error", formatError(error));
        } finally {
            setIsSaving(false);
        }
    }, [clearAuthorizationDetailCache, draftId, ensureUniqueAuthorizationCombination, ffpLaborConfig, form, hideBusy, hideSuccess, history, isExistingSubmittedEdit, laborLinesByAuthorizationId, loadAuthorizationDetail, periodEnd, periodStart, refresh, resourcesByAuthorizationId, resourceRows, returnTo, runByAuthorizationId, showBusy, showDialog, showSuccess, syncWorkPackageData, travelOdcsByAuthorizationId, travelRows]);

    const handleCancel = React.useCallback(async (): Promise<void> => {
        if (mode === "new" && draftId) {
            try {
                await AuthorizationService.delete(draftId);
            } catch (error) {
                showDialog("Draft Delete Error", formatError(error));
                return;
            }
        }

        history.push(returnTo);
    }, [draftId, history, mode, returnTo, showDialog]);

    const handleDiscardDraft = React.useCallback(async (): Promise<void> => {
        const authorizationId = draftId ?? form.Id;

        if (!authorizationId) {
            showDialog("Discard Draft Error", "The draft authorization is not ready yet. Please wait a moment and try again.");
            return;
        }

        setDiscardDraftDialogOpen(false);

        try {
            showBusy("Discarding draft...");
            await AuthorizationService.delete(authorizationId);
            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSuccess("Draft discarded.");
            history.push(returnTo);
        } catch (error) {
            hideBusy();
            showDialog("Discard Draft Error", formatError(error));
        }
    }, [clearAuthorizationDetailCache, draftId, form.Id, hideBusy, history, refresh, returnTo, showBusy, showDialog, showSuccess]);

    const handleViewDuplicate = React.useCallback(async (): Promise<void> => {
        if (!duplicateMatch) {
            return;
        }

        const duplicateId = duplicateMatch.Id;
        const currentAuthorizationId = draftId ?? form.Id;
        const shouldDiscardCurrentDraft = isDraftAuthorization && currentAuthorizationId && currentAuthorizationId !== duplicateId;

        setDuplicateMatch(undefined);

        if (shouldDiscardCurrentDraft) {
            try {
                showBusy("Discarding duplicate draft...");
                await AuthorizationService.delete(currentAuthorizationId);
                clearAuthorizationDetailCache(currentAuthorizationId);
                await refresh(true);
                hideBusy();
                showSuccess("Draft discarded.");
            } catch (error) {
                hideBusy();
                showDialog("Discard Draft Error", formatError(error));
                return;
            }
        }

        history.push(`/authorizations/view/${duplicateId}`);
    }, [clearAuthorizationDetailCache, draftId, duplicateMatch, form.Id, hideBusy, history, isDraftAuthorization, refresh, showBusy, showDialog, showSuccess]);

    const stepOneHasError = submitted && !validateStep(0);
    const stepTwoHasError = submitted && !validateStep(1);

    const basicInfoSection = (
        <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
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
                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                                {contractTypeOptions.map((option) => {
                                    const isSelected = form.contractType === option.value;

                                    return (
                                        <Paper
                                            key={option.value}
                                            onClick={() => updateField("contractType", option.value)}
                                            sx={{
                                                p: 2,
                                                flex: 1,
                                                minWidth: { lg: 260 },
                                                cursor: "pointer",
                                                borderColor: isSelected ? "info.main" : undefined,
                                                borderWidth: isSelected ? 2 : undefined,
                                                backgroundColor: isSelected ? "rgba(3,169,244,0.08)" : "background.paper"
                                            }}
                                        >
                                            <Stack spacing={0.5}>
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    {option.label}
                                                </Typography>
                                                <Typography variant="body2" color={isSelected ? "info.main" : "text.secondary"}>
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
                            autoHighlight
                            onChange={(_, value: IContractItem | null) => {
                                updateField("contractId", value?.field_19 ?? "");
                                updateField("contractName", value?.field_20 ?? "");
                            }}
                            getOptionLabel={(option: IContractItem) => option.field_20 ?? ""}
                            filterOptions={(options, state) => {
                                const search = state.inputValue.trim().toLowerCase();

                                if (!search) {
                                    return options.slice(0, 20);
                                }

                                return options.filter((option: IContractItem) => {
                                    return (
                                        (option.field_20 ?? "").toLowerCase().includes(search) ||
                                        (option.field_19 ?? "").toLowerCase().includes(search) ||
                                        (option.field_35 ?? "").toLowerCase().includes(search)
                                    );
                                }).slice(0, 20);
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Contract"
                                    required
                                    error={stepOneHasError && !form.contractId}
                                    helperText={stepOneHasError && !form.contractId ? "Contract is required." : "Select the JAMIS contract that anchors this authorization."}
                                />
                            )}
                            renderOption={(props, option: IContractItem) => (
                                <li {...props} key={option.field_19}>
                                    <Stack spacing={0.15}>
                                        <Typography variant="body1" fontWeight={600}>
                                            {option.field_20}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.field_35 || "No customer contract code"}
                                        </Typography>
                                    </Stack>
                                </li>
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Autocomplete
                            options={sortedInvoiceOptions}
                            value={selectedInvoice}
                            loading={isInvoicesLoading}
                            autoHighlight
                            onChange={(_, value: IInvoiceItem | null) => {
                                updateField("invoice", value?.InvoiceID1 ?? "");
                            }}
                            getOptionLabel={(option: IInvoiceItem) => option.InvoiceID1 ?? ""}
                            isOptionEqualToValue={(option: IInvoiceItem, value: IInvoiceItem) => option.InvoiceID1 === value.InvoiceID1}
                            filterOptions={(options, state) => {
                                const search = state.inputValue.trim().toLowerCase();

                                if (!search) {
                                    return options.slice(0, 50);
                                }

                                return options.filter((option: IInvoiceItem) => {
                                    return (
                                        (option.InvoiceID1 ?? "").toLowerCase().includes(search) ||
                                        (option.field_14 ?? "").toLowerCase().includes(search) ||
                                        (option.field_42 ?? "").toLowerCase().includes(search) ||
                                        (option.field_28 ?? "").toLowerCase().includes(search)
                                    );
                                }).slice(0, 50);
                            }}
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
                            renderOption={(props, option: IInvoiceItem) => (
                                <li {...props} key={option.InvoiceID1}>
                                    <Stack spacing={0.15}>
                                        <Typography variant="body1" fontWeight={600}>
                                            {option.InvoiceID1}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.field_42 || option.field_28 || "Invoice"}
                                        </Typography>
                                    </Stack>
                                </li>
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
    );

    const detailsSection = (
        <Stack spacing={3}>
            <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Scope of Work"
                            fullWidth
                            required
                            multiline
                            minRows={3}
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
                            minRows={3}
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
        </Stack>
    );

    const workPackageSection = (
        <IwaWorkPackageStep
            contractType={form.contractType}
            jobs={jobOptions}
            states={stateOptions}
            peoplePickerContext={peoplePickerContext}
            resourceRows={resourceRows}
            travelRows={travelRows}
            ffpLaborConfig={ffpLaborConfig}
            submitted={submitted}
            onAddResource={addResourceRow}
            onRemoveResource={removeResourceRow}
            onUpdateResource={updateResourceRow}
            onAddTravel={addTravelRow}
            onRemoveTravel={removeTravelRow}
            onUpdateTravel={updateTravelRow}
            onUpdateFfpLaborConfig={updateFfpLabor}
        />
    );

    const reviewSection = (
        <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
            <IwaReviewSection
                attachmentsCount={attachments.length}
                ffpLaborConfig={ffpLaborConfig}
                form={form}
                jobs={jobOptions}
                periodEnd={periodEnd}
                periodStart={periodStart}
                resourceRows={resourceRows.filter((row) => !!row.employee?.Id)}
                selectedContractType={selectedContractType}
                selectedInvoice={selectedInvoice ?? undefined}
                travelRows={travelRows}
            />
        </Box>
    );

    return (
        <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
            <Stack spacing={3} sx={{ width: "100%" }}>
                <Stack spacing={1.25} sx={{ px: { xs: 0.25, md: 0.5 }, width: "100%" }}>
                <Breadcrumbs separator={<NavigateNextOutlinedIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} color="inherit" to="/my-work" underline="hover">
                        My Work
                    </Link>
                    <Typography color="text.primary">
                        {mode === "new" ? "New Authorization" : "Edit Authorization"}
                    </Typography>
                    <Typography color="text.primary">
                        {stepLabels[activeStep]}
                    </Typography>
                </Breadcrumbs>

                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
                    <PageHeader
                        title={mode === "new" ? "Create Authorization" : `Edit ${form.Title || "Authorization"}`}
                        subtitle="Build the authorization header first, then layer in attachments, resources, labor, and travel from the same draft record."
                    />

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        {isDraftAuthorization && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteOutlineOutlinedIcon />}
                                disabled={isSaving || isBootstrapping}
                                onClick={() => setDiscardDraftDialogOpen(true)}
                            >
                                Discard Draft
                            </Button>
                        )}
                        <Chip label={`STATUS: ${String(form.authorizationStatus ?? "draft").toUpperCase()}`} color="info" size="small" variant="outlined" />
                        {/* {draftId && <Chip label={`Draft Id: ${draftId}`} size="small" color="info" variant="outlined" />} */}
                    </Stack>
                </Stack>
                </Stack>

                <Paper sx={{ p: { xs: 1, md: 2 }, width: "100%" }}>
                <Stack spacing={2}>
                    <Stepper
                        nonLinear
                        activeStep={activeStep}
                        alternativeLabel
                        sx={{
                            "& .MuiStepIcon-root": {
                                fontSize: { xs: "1.6rem", md: "1.9rem" }
                            },
                            "& .MuiStepIcon-text": {
                                fontSize: { xs: "0.9rem", md: "1rem" },
                                fontWeight: 600
                            },
                            "& .MuiStepLabel-label": {
                                fontSize: { xs: "0.95rem", md: "1rem" }
                            },
                            "& .MuiStepLabel-label.Mui-active": {
                                color: "secondary.main",
                                fontWeight: 700
                            },
                            "& .MuiStepIcon-root.Mui-active": {
                                color: "secondary.main"
                            }
                        }}
                    >
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
                    <Paper sx={{ p: 4, textAlign: "center", width: "100%" }}>
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
                        {activeStep === 1 && workPackageSection}
                        {activeStep === 2 && detailsSection}
                        {activeStep === 3 && reviewSection}

                        {activeStep === 2 && (
                            <Box sx={{ width: "100%" }}>
                            <IwaAttachmentsPanel
                                attachments={attachments}
                                onRemoveAttachment={handleRemoveAttachment}
                                onUploadAttachment={handleUploadAttachment}
                            />
                            </Box>
                        )}

                        <Paper sx={{ p: { xs: 2, md: 2.5 }, width: "100%" }}>
                            <Stack
                                direction="row"
                                flexWrap="wrap"
                                justifyContent="space-between"
                                alignItems="center"
                                spacing={1.5}
                            >
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<ArrowBackOutlinedIcon />}
                                        disabled={activeStep === 0 || isSaving}
                                        onClick={handlePrevious}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="text"
                                        color="inherit"
                                        onClick={() => {
                                            handleCancel().catch((error) => showDialog("Cancel Error", formatError(error)));
                                    }}
                                >
                                    Cancel
                                </Button>
                                </Stack>

                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button
                                        variant="outlined"
                                        startIcon={<SaveOutlinedIcon />}
                                        disabled={isSaving}
                                        onClick={() => {
                                            persistAuthorization(isExistingSubmittedEdit ? normalizeAuthorizationStatus(form.authorizationStatus ?? "submitted") : "draft").catch((error) => showDialog("Save Error", formatError(error)));
                                        }}
                                    >
                                        {isExistingSubmittedEdit ? "Save Changes" : "Save Draft"}
                                    </Button>
                                    {activeStep < 3 ? (
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
                                            if (!ensureUniqueAuthorizationCombination()) {
                                                return;
                                            }

                                            if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
                                                setSubmitted(true);
                                                showDialog("Missing Required Information", "Complete the required fields on the earlier steps before submitting.");
                                                return;
                                            }

                                            persistAuthorization("submitted").catch((error) => showDialog("Submit Error", formatError(error)));
                                        }}
                                    >
                                        {isExistingSubmittedEdit ? "Save Updates" : "Submit Authorization"}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                        </Paper>
                    </>
                )}

                <Dialog open={discardDraftDialogOpen} onClose={() => setDiscardDraftDialogOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>Discard Draft?</DialogTitle>
                    <DialogContent>
                        <Typography color="text.secondary">
                            This will permanently discard this draft authorization and remove it from your draft list.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDiscardDraftDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={handleDiscardDraft}>
                            Discard Draft
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={!!duplicateMatch} onClose={() => setDuplicateMatch(undefined)} fullWidth maxWidth="md">
                    <DialogTitle>Matching IWA Found</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Typography>
                                An IWA with matching Entities, Contract, and Invoice already exists. This combination of information should be unique per IWA.
                            </Typography>
                            {duplicateMatch && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Grid container spacing={1.5}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Typography variant="caption" color="text.secondary">IWA</Typography>
                                            <Typography fontWeight={600}>{duplicateMatch.Title}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Typography variant="caption" color="text.secondary">Status</Typography>
                                            <Typography>{authorizationStatusLabels[duplicateMatch.authorizationStatus]}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Typography variant="caption" color="text.secondary">Workflow</Typography>
                                            <Typography>{duplicateRun ? workflowRunStatusLabels[duplicateRun.runStatus] : "No workflow"}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Typography variant="caption" color="text.secondary">Submitter</Typography>
                                            <Typography>{duplicateMatch.Author?.Title ?? "Not available"}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Typography variant="caption" color="text.secondary">Submitted On</Typography>
                                            <Typography>{duplicateMatch.Created ? formatDate(duplicateMatch.Created, true) : "—"}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Typography variant="caption" color="text.secondary">Last Modified</Typography>
                                            <Typography>{duplicateMatch.Modified ? formatDate(duplicateMatch.Modified, true) : "—"}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            )}
                            <Grid container spacing={1.5}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Paper
                                        variant="outlined"
                                        onClick={() => setDuplicateMatch(undefined)}
                                        sx={(theme) => ({
                                            p: 2,
                                            height: "100%",
                                            cursor: "pointer",
                                            borderColor: "text.primary",
                                            transition: "background-color 160ms ease, border-color 160ms ease, border-width 160ms ease",
                                            "&:hover": {
                                                bgcolor: alpha(theme.palette.info.main, 0.04),
                                                borderColor: "info.main",
                                                borderWidth: 2
                                            }
                                        })}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <TuneOutlinedIcon color="info" sx={{ fontSize: 42, flexShrink: 0 }} />
                                            <Box>
                                                <Typography fontWeight={600}>Go back</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Return to the form and update the entities, contract, or invoice.
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Paper
                                        variant="outlined"
                                        onClick={handleViewDuplicate}
                                        sx={(theme) => ({
                                            p: 2,
                                            height: "100%",
                                            cursor: "pointer",
                                            borderColor: "text.primary",
                                            transition: "background-color 160ms ease, border-color 160ms ease, border-width 160ms ease",
                                            "&:hover": {
                                                bgcolor: alpha(theme.palette.error.main, 0.04),
                                                borderColor: "error.main",
                                                borderWidth: 2
                                            }
                                        })}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <ManageSearchOutlinedIcon color="error" sx={{ fontSize: 42, flexShrink: 0 }} />
                                            <Box>
                                                <Typography fontWeight={600}>{isDraftAuthorization ? "Discard draft and view existing IWA" : "View existing IWA"}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {isDraftAuthorization
                                                        ? "Delete this draft and open the matching authorization."
                                                        : "Leave this authorization unchanged and open the matching authorization."}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDuplicateMatch(undefined)}>Close</Button>
                    </DialogActions>
                </Dialog>

                <AlertDialog
                    open={dialogOpen}
                    title={dialogTitle}
                    message={dialogMessage}
                    onClose={handleCloseDialog}
                />
            </Stack>
        </Box>
    );
};
