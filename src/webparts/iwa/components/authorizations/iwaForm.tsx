/* eslint-disable max-lines */
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
    IModItem,
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
import { IEditableFfpLaborRow, IEditableResourceRow, IEditableTravelRow, IPriorResourceRow } from "./workPackage/workPackageTypes";
import {
    IwaWorkPackageStep
} from "./IwaWorkPackageStep";
import { ResourceService } from "../resources/resourceService";
import { LaborLineItemService } from "../laborlineitems/laborLineItemService";
import { TravelOdcService } from "../travelodc/travelOdcService";
import { ModService } from "../mods/modService";

interface IIwaFormProps {
    context: WebPartContext;
    mode: "new" | "edit";
    item?: IAuthorizationItem;
}

interface IAuthorizationFormLocationState {
    returnTo?: string;
    modId?: number;
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

const createEmptyFfpLaborRow = (): IEditableFfpLaborRow => ({
    id: createLocalRowId(),
    jobId: "",
    chargingPeriod: "monthly",
    periodQty: "",
    lumpSumAmount: "",
    resourceRowIds: [],
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

const getActiveModDraftSessionKey = (authorizationId: number): string => `iwa:activeModDraft:${authorizationId}`;

const readSessionModId = (authorizationId?: number): number | undefined => {
    if (!authorizationId) {
        return undefined;
    }

    const value = sessionStorage.getItem(getActiveModDraftSessionKey(authorizationId));
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
    const location = useLocation<IAuthorizationFormLocationState | undefined>();
    const {
        clearAuthorizationDetailCache,
        authorizations,
        draftAuthorizations,
        laborLinesByAuthorizationId,
        loadAuthorizationDetail,
        modsByAuthorizationId,
        refresh,
        resourcesByAuthorizationId,
        runByAuthorizationId,
        runsByAuthorizationId,
        travelOdcsByAuthorizationId
    } = useIwa();
    const { showBusy, hideBusy, showSuccess, hideSuccess } = useShellUi();
    const successTimeoutRef = React.useRef<number | undefined>(undefined);
    const initialAuthorizationRef = React.useRef<IAuthorizationItem | undefined>(item);
    const lastSyncedContractIdRef = React.useRef<string | undefined>(item?.contractId);
    const returnTo = location.state?.returnTo || sessionStorage.getItem("iwa:lastReturnLocation") || "/my-work/all";
    const routeModId = location.state?.modId;
    const storedModId = readSessionModId(item?.Id);
    const latestDraftModId = React.useMemo<number | undefined>(() => {
        if (!item?.Id) {
            return undefined;
        }

        const draftMods = (modsByAuthorizationId.get(item.Id) ?? [])
            .filter((mod: IModItem) => mod.modStatus === "draft")
            .sort((left: IModItem, right: IModItem) => {
                const leftModified = Date.parse(left.Modified ?? left.Created ?? "");
                const rightModified = Date.parse(right.Modified ?? right.Created ?? "");

                if (Number.isFinite(leftModified) && Number.isFinite(rightModified) && leftModified !== rightModified) {
                    return rightModified - leftModified;
                }

                return (right.modNumber ?? 0) - (left.modNumber ?? 0);
            });

        return draftMods[0]?.Id;
    }, [item?.Id, modsByAuthorizationId]);
    const activeModDraftId = routeModId ?? storedModId ?? latestDraftModId;

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
    const [ffpLaborRows, setFfpLaborRows] = React.useState<IEditableFfpLaborRow[]>([]);
    const [priorResourceRows, setPriorResourceRows] = React.useState<IPriorResourceRow[]>([]);
    const [currentMod, setCurrentMod] = React.useState<IModItem | undefined>(undefined);
    const [modReason, setModReason] = React.useState<string>("");
    const stateOptions = React.useMemo<string[]>(() => [...DataSource.States], []);
    const laborCategoryOptions = React.useMemo<string[]>(() => [...DataSource.LaborCategories], []);

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
    const isModEditIntent = mode === "edit" && typeof activeModDraftId === "number" && activeModDraftId > 0;
    const activeModId = currentMod?.Id ?? (isModEditIntent ? activeModDraftId : undefined);
    const isModDraftMode = isModEditIntent && (currentMod?.modStatus ?? "draft") === "draft";
    const isBaselineLocked = isModDraftMode || normalizeAuthorizationStatus(form.authorizationStatus) === "approved";
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

    const loadWorkPackageDraft = React.useCallback(async (authorizationId: number, modId?: number): Promise<void> => {
        const [resources, laborLines, travelOdcs] = await Promise.all([
            ResourceService.getByAuthorization(authorizationId),
            LaborLineItemService.getByAuthorization(authorizationId),
            TravelOdcService.getByAuthorization(authorizationId)
        ]);

        const resourceScope = modId
            ? (resources ?? []).filter((resource) => resource.lineScope === "mod" && resource.mod?.Id === modId)
            : (resources ?? []).filter((resource) => resource.lineScope !== "mod");
        const laborScope = modId
            ? (laborLines ?? []).filter((line) => line.lineScope === "mod" && line.mod?.Id === modId)
            : (laborLines ?? []).filter((line) => line.lineScope !== "mod");
        const travelScope = modId
            ? (travelOdcs ?? []).filter((travel) => travel.lineScope === "mod" && travel.mod?.Id === modId)
            : (travelOdcs ?? []).filter((travel) => travel.lineScope !== "mod");

        const sortedResources = [...resourceScope].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const sortedLaborLines = [...laborScope].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const sortedTravelOdcs = [...travelScope].sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const baseResources = [...(resources ?? [])]
            .filter((resource) => resource.lineScope !== "mod")
            .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
        const baseLaborLines = (laborLines ?? []).filter((line) => line.lineScope !== "mod");

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
                laborCategory: resource.laborCategory ?? "",
                jobId: tmLabor?.jobId ?? "",
                standardHours: tmLabor?.standardHours !== undefined && tmLabor?.standardHours !== null ? String(tmLabor.standardHours) : "",
                overtimeHours: tmLabor?.overtimeHours !== undefined && tmLabor?.overtimeHours !== null ? String(tmLabor.overtimeHours) : "",
                annualSalary: tmLabor?.annualSalary !== undefined && tmLabor?.annualSalary !== null ? String(tmLabor.annualSalary) : "",
                standardRate: tmLabor?.standardRate !== undefined && tmLabor?.standardRate !== null ? String(tmLabor.standardRate) : "",
                overtimeRate: tmLabor?.overtimeRate !== undefined && tmLabor?.overtimeRate !== null ? String(tmLabor.overtimeRate) : ""
            };
        });

        setResourceRows(nextResources);
        setPriorResourceRows(baseResources
            .filter((resource) => !!resource.employee?.Id)
            .map((resource) => {
                const labor = baseLaborLines.find((line) => line.resources?.results?.some((lookup) => lookup.Id === resource.Id));

                return {
                    id: String(resource.Id),
                    employee: resource.employee,
                    state: resource.state ?? "",
                    jobId: labor?.jobId ?? "",
                    laborCategory: resource.laborCategory ?? "",
                    approvedStandardHours: Number(labor?.standardHours ?? 0),
                    approvedOvertimeHours: Number(labor?.overtimeHours ?? 0)
                };
            }));

        setFfpLaborRows(sortedLaborLines
            .filter((line) => line.pricingType === "ffp")
            .map((line) => ({
                id: String(line.Id),
                jobId: line.jobId ?? "",
                chargingPeriod: line.chargingPeriod ?? "monthly",
                periodQty: line.periodQty !== undefined && line.periodQty !== null ? String(line.periodQty) : "",
                lumpSumAmount: line.lumpSumAmount !== undefined && line.lumpSumAmount !== null ? String(line.lumpSumAmount) : "",
                resourceRowIds: line.resources?.results?.map((resource) => String(resource.Id)) ?? [],
                comments: line.comments ?? ""
            })));

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
                const mod = activeModDraftId ? await ModService.getById(activeModDraftId) : undefined;

                if (mod?.Id && item.Id) {
                    sessionStorage.setItem(getActiveModDraftSessionKey(item.Id), String(mod.Id));
                }

                setCurrentMod(mod);
                setModReason(mod?.reason ?? "");
                await Promise.all([
                    loadAttachments(item.Id),
                    loadWorkPackageDraft(item.Id, mod?.Id)
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
    }, [activeModDraftId, item?.Id, loadAttachments, loadWorkPackageDraft, mode, showDialog]);

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

            if (!isBaselineLocked) {
                updateField("contractName", selectedContract.field_20 ?? "");
                if (contractActuallyChanged) {
                    updateField("invoice", "");
                }
                applyOgAndLobFromContract(selectedContract);

                if (contractActuallyChanged || (firstContractSync && !form.pm?.Id)) {
                    const nextPm = await resolveProjectManager(selectedContract);
                    updateField("pm", nextPm);
                }
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
    }, [applyOgAndLobFromContract, form.pm?.Id, isBaselineLocked, resolveProjectManager, selectedContract, showDialog, updateField]);

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
        setFfpLaborRows((prev) => prev.map((line) => ({
            ...line,
            resourceRowIds: line.resourceRowIds.filter((resourceRowId) => resourceRowId !== id)
        })));
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

    const addFfpLaborRow = React.useCallback((row?: IEditableFfpLaborRow): void => {
        setFfpLaborRows((prev) => [...prev, row ? { ...row, id: createLocalRowId() } : createEmptyFfpLaborRow()]);
    }, []);

    const removeFfpLaborRow = React.useCallback((id: string): void => {
        setFfpLaborRows((prev) => prev.filter((row) => row.id !== id));
    }, []);

    const updateFfpLaborRow = React.useCallback((id: string, patch: Partial<IEditableFfpLaborRow>): void => {
        setFfpLaborRows((prev) => prev.map((row) => row.id === id ? { ...row, ...patch } : row));
    }, []);

    const resourceStepIsValid = React.useMemo((): boolean => {
        const travelValid = travelRows.every((row) => {
            if (!row.jobId.trim()) {
                return false;
            }

            if (!row.amount.trim()) {
                return false;
            }

            return !Number.isNaN(Number(row.amount));
        });

        if (isModDraftMode && resourceRows.length === 0) {
            return travelValid;
        }

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

            if (!row.laborCategory.trim()) {
                return false;
            }

            if (form.contractType === "tm") {
                const standardHours = row.standardHours.trim();
                const overtimeHours = row.overtimeHours.trim();
                const totalHours = Number(standardHours || 0) + Number(overtimeHours || 0);

                return !!row.jobId.trim() &&
                    totalHours > 0 &&
                    (!standardHours || !Number.isNaN(Number(standardHours))) &&
                    (!overtimeHours || !Number.isNaN(Number(overtimeHours)));
            }

            return true;
        });

        if (!resourcesValid) {
            return false;
        }

        if (form.contractType === "ffp") {
            const assignedResourceIds = new Set(resourceRows.filter((row) => !!row.employee?.Id).map((row) => row.id));
            const linkedResourceIds = new Set(ffpLaborRows.flatMap((row) => row.resourceRowIds));
            const everyResourceLinked = [...assignedResourceIds].every((id) => linkedResourceIds.has(id));
            const ffpLinesValid = ffpLaborRows.length > 0 && ffpLaborRows.every((row) => {
                const periodQty = Number(row.periodQty || 0);
                const lumpSumAmount = Number(row.lumpSumAmount || 0);

                return !!row.jobId.trim() &&
                    periodQty > 0 &&
                    lumpSumAmount > 0 &&
                    row.resourceRowIds.length > 0;
            });

            if (!ffpLinesValid || !everyResourceLinked) {
                return false;
            }
        }

        return travelValid;
    }, [ffpLaborRows, form.contractType, isModDraftMode, resourceRows, travelRows]);

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
        if (isModDraftMode && !activeModId) {
            throw new Error("The modification draft is still loading. Please wait a moment and try again.");
        }

        if (form.contractType === "tm") {
            const zeroHourRow = resourceRows.find((row) => {
                if (!row.employee?.Id) {
                    return false;
                }

                const standardHours = Number(row.standardHours || 0);
                const overtimeHours = Number(row.overtimeHours || 0);

                return Number.isNaN(standardHours) || Number.isNaN(overtimeHours) || standardHours + overtimeHours <= 0;
            });

            if (zeroHourRow) {
                throw new Error(`Enter hours greater than zero for ${zeroHourRow.employee?.Title ?? "each resource"} before saving.`);
            }
        }

        const lineOptions = isModDraftMode && activeModId
            ? { lineScope: "mod" as const, modId: activeModId }
            : undefined;
        const resourceLineNumberByRowId = new Map<string, number>();
        const activeResources = resourceRows
            .filter((row) => row.employee?.Id)
            .map((row, index) => {
                const lineNumber = index + 1;
                resourceLineNumberByRowId.set(row.id, lineNumber);

                return {
                    title: `Resource-${lineNumber}-${row.employee?.Title ?? "Employee"}`,
                    lineNumber,
                    displayOrder: lineNumber,
                    employeeId: row.employee!.Id,
                    state: row.state.trim(),
                    laborCategory: row.laborCategory.trim(),
                    comments: row.comments.trim()
                };
            });

        const createdResources = await ResourceService.replaceForAuthorization(authorizationId, activeResources, lineOptions);
        const createdByLineNumber = new Map<number, number>();
        createdResources.forEach((resource) => {
            if (resource.lineNumber) {
                createdByLineNumber.set(resource.lineNumber, resource.Id);
            }
        });

        const laborRows: Parameters<typeof LaborLineItemService.replaceForAuthorization>[1] = form.contractType === "tm"
            ? resourceRows
                .filter((row) => row.employee?.Id)
                .map((row, index) => ({
                    title: `Labor-${index + 1}-${row.employee?.Title ?? "Employee"}`,
                    lineNumber: index + 1,
                    displayOrder: index + 1,
                    pricingType: "tm" as const,
                    jobId: row.jobId.trim(),
                    resourceIds: [createdByLineNumber.get(index + 1)].filter((value): value is number => typeof value === "number"),
                    comments: row.comments.trim(),
                    annualSalary: Number(row.annualSalary || 0),
                    standardRate: Number(row.standardRate || 0),
                    overtimeRate: Number(row.overtimeRate || 0),
                    standardHours: Number(row.standardHours || 0),
                    overtimeHours: Number(row.overtimeHours || 0)
                }))
            : ffpLaborRows.map((row, index) => {
                const lineNumber = index + 1;
                const resourceIds = row.resourceRowIds
                    .map((resourceRowId) => resourceLineNumberByRowId.get(resourceRowId))
                    .map((resourceLineNumber) => resourceLineNumber ? createdByLineNumber.get(resourceLineNumber) : undefined)
                    .filter((value): value is number => typeof value === "number");

                return {
                    title: `Labor-${lineNumber}-FFP`,
                    lineNumber,
                    displayOrder: lineNumber,
                    pricingType: "ffp" as const,
                    jobId: row.jobId.trim(),
                    resourceIds,
                    comments: row.comments.trim(),
                    chargingPeriod: row.chargingPeriod,
                    periodQty: Number(row.periodQty || 0),
                    lumpSumAmount: Number(row.lumpSumAmount || 0)
                };
            });

        const savedLaborLines = await LaborLineItemService.replaceForAuthorization(authorizationId, laborRows, lineOptions);

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

        const savedTravelRows = await TravelOdcService.replaceForAuthorization(authorizationId, activeTravelRows, lineOptions);

        const baseLaborAmount = savedLaborLines.reduce((total, line) => total + Number(line.totalAmount ?? 0), 0);
        const baseTravelAmount = savedTravelRows.reduce((total, line) => total + Number(line.amount ?? 0), 0);
        const baseGrandTotal = baseLaborAmount + baseTravelAmount;

        if (isModDraftMode && activeModId) {
            await ModService.updateDraft(activeModId, {
                reason: modReason.trim(),
                laborAmount: baseLaborAmount,
                travelAmount: baseTravelAmount,
                grandTotal: baseGrandTotal
            });

            return {
                baseLaborAmount: form.baseLaborAmount ?? 0,
                baseTravelAmount: form.baseTravelAmount ?? 0,
                baseGrandTotal: form.baseGrandTotal ?? 0
            };
        }

        const totals = {
            baseLaborAmount,
            baseTravelAmount,
            baseGrandTotal
        };

        await AuthorizationService.updateBaseAmounts(authorizationId, totals);

        return totals;
    }, [activeModId, ffpLaborRows, form.baseGrandTotal, form.baseLaborAmount, form.baseTravelAmount, form.contractType, isModDraftMode, modReason, resourceRows, travelRows]);

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
        const isSubmittingMod = isModDraftMode && normalizedStatus !== "draft";

        if (isModDraftMode && !activeModId) {
            setIsSaving(false);
            showDialog("Mod Draft Loading", "The modification draft is still loading. Please wait a moment and try again.");
            return;
        }

        if (isSubmittingMod && !currentMod?.Id) {
            setIsSaving(false);
            showDialog("Mod Draft Loading", "The modification draft is still loading. Please wait a moment and try again.");
            return;
        }

        if (isSubmittingMod && !modReason.trim()) {
            setIsSaving(false);
            showDialog("Mod Reason Required", "Please enter a reason for this modification before submitting it for approval.");
            return;
        }

        showBusy(
            isModDraftMode
                ? normalizedStatus === "draft"
                    ? "Saving modification draft..."
                    : "Submitting modification..."
                : normalizedStatus === "draft"
                    ? "Saving authorization draft..."
                    : isExistingSubmittedEdit
                        ? "Saving authorization changes..."
                        : "Submitting authorization..."
        );

        const authorizationStatusToSave = isModDraftMode
            ? normalizeAuthorizationStatus(form.authorizationStatus)
            : normalizedStatus;
        const nextForm: IAuthorizationItem = {
            ...form,
            Id: authorizationId,
            authorizationStatus: authorizationStatusToSave,
            periodStart: toIsoDate(periodStart),
            periodEnd: toIsoDate(periodEnd)
        };

        try {
            let saved: IAuthorizationItem;
            const isFirstSubmit = !isModDraftMode && normalizedStatus !== "draft" && isDraftStatus(form.authorizationStatus);

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

            if (isSubmittingMod && currentMod?.Id) {
                showBusy("Capturing modification changes...");
                const approvers = await ApproverResolver.resolve(saved);
                const changeSet = captureIwaChangeSet({
                    beforeAuthorization: initialAuthorizationRef.current,
                    afterAuthorization: saved,
                    beforeResources: resourcesByAuthorizationId.get(saved.Id) ?? [],
                    beforeLaborLines: laborLinesByAuthorizationId.get(saved.Id) ?? [],
                    beforeTravelOdcs: travelOdcsByAuthorizationId.get(saved.Id) ?? [],
                    afterResourceRows: resourceRows,
                    afterTravelRows: travelRows,
                    afterFfpLaborRows: ffpLaborRows
                });
                const nextRunNumber = Math.max(0, ...(runsByAuthorizationId.get(saved.Id) ?? []).map((run) => run.runNumber ?? 0)) + 1;

                showBusy("Creating new workflow...");
                const modRun = await WorkflowRunService.createModRun(
                    saved,
                    currentMod,
                    nextRunNumber,
                    approvers,
                    "Submit modification",
                    changeSet.changeSummary
                );

                showBusy("Updating modification linkages...");
                await ModService.updateDraft(currentMod.Id, {
                    reason: modReason.trim(),
                    changeSummary: changeSet.changeSummary,
                    modStatus: "underReview",
                    currentWorkflowRunId: modRun.Id
                });
                await AuthorizationService.updateRunId(saved.Id, modRun.Id);
                await WorkflowActionService.createSubmitted(saved, modRun, {
                    actionType: "modified",
                    comments: changeSet.changeSummary,
                    changeSummary: changeSet.changeSummary,
                    changePayloadJson: changeSet.changePayloadJson,
                    modId: currentMod.Id
                });

                saved = {
                    ...saved,
                    currentWorkflowRun: {
                        Id: modRun.Id,
                        Title: modRun.Title
                    }
                };
            } else
            if (
                !isModDraftMode &&
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
                    afterFfpLaborRows: ffpLaborRows
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
                showSuccess(isModDraftMode ? "Modification draft saved successfully." : "Draft saved successfully.");
                if (successTimeoutRef.current) {
                    window.clearTimeout(successTimeoutRef.current);
                }
                successTimeoutRef.current = window.setTimeout(() => {
                    hideSuccess();
                }, 1500);
                return;
            }

            if (isSubmittingMod) {
                showSuccess("Modification submitted for approval.");
                if (successTimeoutRef.current) {
                    window.clearTimeout(successTimeoutRef.current);
                }
                successTimeoutRef.current = window.setTimeout(() => {
                    hideSuccess();
                    sessionStorage.removeItem(getActiveModDraftSessionKey(saved.Id));
                    history.push(returnTo);
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
    }, [activeModId, clearAuthorizationDetailCache, currentMod, draftId, ensureUniqueAuthorizationCombination, ffpLaborRows, form, hideBusy, hideSuccess, history, isExistingSubmittedEdit, isModDraftMode, laborLinesByAuthorizationId, loadAuthorizationDetail, modReason, periodEnd, periodStart, refresh, resourcesByAuthorizationId, resourceRows, returnTo, runByAuthorizationId, runsByAuthorizationId, showBusy, showDialog, showSuccess, syncWorkPackageData, travelOdcsByAuthorizationId, travelRows]);

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
            showBusy(isModDraftMode ? "Discarding modification draft..." : "Discarding draft...");

            if (isModDraftMode && activeModId) {
                await ModService.discardDraft(authorizationId, activeModId);
                await AuthorizationService.updateModCount(authorizationId, Math.max(0, (form.modCount ?? 1) - 1));
                sessionStorage.removeItem(getActiveModDraftSessionKey(authorizationId));
            } else {
                await AuthorizationService.delete(authorizationId);
            }

            clearAuthorizationDetailCache(authorizationId);
            await refresh(true);
            hideBusy();
            showSuccess(isModDraftMode ? "Modification draft discarded." : "Draft discarded.");
            history.push(returnTo);
        } catch (error) {
            hideBusy();
            showDialog("Discard Draft Error", formatError(error));
        }
    }, [activeModId, clearAuthorizationDetailCache, draftId, form.Id, form.modCount, hideBusy, history, isModDraftMode, refresh, returnTo, showBusy, showDialog, showSuccess]);

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
                            disabled={isBaselineLocked}
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
                            disabled={isBaselineLocked}
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
                                            onClick={() => {
                                                if (!isBaselineLocked) {
                                                    updateField("contractType", option.value);
                                                }
                                            }}
                                            sx={{
                                                p: 2,
                                                flex: 1,
                                                minWidth: { lg: 260 },
                                                cursor: isBaselineLocked ? "default" : "pointer",
                                                opacity: isBaselineLocked && !isSelected ? 0.58 : 1,
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
                            disabled={isBaselineLocked}
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
                            disabled={isBaselineLocked}
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
                            disabled={isBaselineLocked}
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
            laborCategories={laborCategoryOptions}
            states={stateOptions}
            peoplePickerContext={peoplePickerContext}
            resourceRows={resourceRows}
            travelRows={travelRows}
            ffpLaborRows={ffpLaborRows}
            priorResourceRows={priorResourceRows}
            showPriorResources={isModDraftMode}
            submitted={submitted}
            onAddResource={addResourceRow}
            onRemoveResource={removeResourceRow}
            onUpdateResource={updateResourceRow}
            onAddTravel={addTravelRow}
            onRemoveTravel={removeTravelRow}
            onUpdateTravel={updateTravelRow}
            onAddFfpLabor={addFfpLaborRow}
            onRemoveFfpLabor={removeFfpLaborRow}
            onUpdateFfpLabor={updateFfpLaborRow}
        />
    );

    const reviewSection = (
        <Stack spacing={2} sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
            {isModDraftMode && (
                <Paper sx={{ p: 2 }}>
                    <TextField
                        label="Modification Reason"
                        fullWidth
                        required
                        multiline
                        minRows={2}
                        value={modReason}
                        onChange={(event) => setModReason(event.target.value)}
                        error={submitted && !modReason.trim()}
                        helperText={submitted && !modReason.trim()
                            ? "A reason is required before submitting this Mod."
                            : "Explain why this modification is needed. This will be stored with the Mod and included in workflow context."}
                    />
                </Paper>
            )}
            <IwaReviewSection
                attachmentsCount={attachments.length}
                ffpLaborRows={ffpLaborRows}
                form={form}
                jobs={jobOptions}
                periodEnd={periodEnd}
                periodStart={periodStart}
                resourceRows={resourceRows.filter((row) => !!row.employee?.Id)}
                selectedContractType={selectedContractType}
                selectedInvoice={selectedInvoice ?? undefined}
                travelRows={travelRows}
            />
        </Stack>
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
                        {isModDraftMode ? `Mod ${currentMod?.modNumber ?? ""}` : mode === "new" ? "New Authorization" : "Edit Authorization"}
                    </Typography>
                    <Typography color="text.primary">
                        {stepLabels[activeStep]}
                    </Typography>
                </Breadcrumbs>

                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
                    <PageHeader
                        title={isModDraftMode ? `Edit Mod ${currentMod?.modNumber ?? ""} for ${form.Title || "Authorization"}` : mode === "new" ? "Create Authorization" : `Edit ${form.Title || "Authorization"}`}
                        subtitle={isModDraftMode
                            ? "You are working in a Mod Draft. Approved baseline header fields and lines are locked; new work will be captured against this Mod."
                            : "Build the authorization header first, then layer in attachments, resources, labor, and travel from the same draft record."}
                    />

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        <Chip label={`IWA STATUS: ${String(form.authorizationStatus ?? "draft").toUpperCase()}`} color="info" size="small" variant="filled" />
                        {isModDraftMode && (
                            <Chip label={`MOD ${currentMod?.modNumber ?? ""}: DRAFT`} color="secondary" size="small" />
                        )}
                        {(isDraftAuthorization || isModDraftMode) && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteOutlineOutlinedIcon />}
                                disabled={isSaving || isBootstrapping}
                                onClick={() => setDiscardDraftDialogOpen(true)}
                            >
                                {isModDraftMode ? "Discard Mod" : "Discard Draft"}
                            </Button>
                        )}
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
                                            persistAuthorization(isModDraftMode ? "draft" : isExistingSubmittedEdit ? normalizeAuthorizationStatus(form.authorizationStatus ?? "submitted") : "draft").catch((error) => showDialog("Save Error", formatError(error)));
                                        }}
                                    >
                                        {isModDraftMode ? "Save Mod Draft" : isExistingSubmittedEdit ? "Save Changes" : "Save Draft"}
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
                                        {isModDraftMode ? "Submit Mod" : isExistingSubmittedEdit ? "Save Updates" : "Submit Authorization"}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                        </Paper>
                    </>
                )}

                <Dialog open={discardDraftDialogOpen} onClose={() => setDiscardDraftDialogOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{isModDraftMode ? "Discard Mod?" : "Discard Draft?"}</DialogTitle>
                    <DialogContent>
                        <Typography color="text.secondary">
                            {isModDraftMode
                                ? "This will permanently discard this modification draft and remove linked mod resources, labor, and travel."
                                : "This will permanently discard this draft authorization and remove it from your draft list."}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDiscardDraftDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="error" startIcon={<DeleteOutlineOutlinedIcon />} onClick={handleDiscardDraft}>
                            {isModDraftMode ? "Discard Mod" : "Discard Draft"}
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
