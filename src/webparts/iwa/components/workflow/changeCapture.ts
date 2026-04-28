import {
    IAuthorizationItem,
    ILaborLineItem,
    IResourceItem,
    ITravelOdcItem
} from "../data/props";
import { IFfpLaborConfig, IEditableResourceRow, IEditableTravelRow } from "../authorizations/IwaWorkPackageStep";

export interface IIwaChangeCaptureInput {
    beforeAuthorization?: IAuthorizationItem;
    afterAuthorization: IAuthorizationItem;
    beforeResources: IResourceItem[];
    beforeLaborLines: ILaborLineItem[];
    beforeTravelOdcs: ITravelOdcItem[];
    afterResourceRows: IEditableResourceRow[];
    afterTravelRows: IEditableTravelRow[];
    afterFfpLaborConfig: IFfpLaborConfig;
}

export interface IIwaChangeCaptureResult {
    changeSummary: string;
    changePayloadJson: string;
}

const normalizePerson = (person?: { Id?: number; Title?: string; EMail?: string }): Record<string, unknown> | undefined => {
    if (!person?.Id && !person?.Title && !person?.EMail) {
        return undefined;
    }

    return {
        id: person.Id ?? null,
        name: person.Title ?? "",
        email: person.EMail ?? ""
    };
};

const normalizeAuthorization = (authorization?: IAuthorizationItem): Record<string, unknown> => ({
    title: authorization?.Title ?? "",
    status: authorization?.authorizationStatus ?? "",
    donorEntity: authorization?.donorEntity ?? "",
    donorEntityAbbr: authorization?.donorEntityAbbr ?? "",
    receivingEntity: authorization?.receivingEntity ?? "",
    receivingEntityAbbr: authorization?.receivingEntityAbbr ?? "",
    og: authorization?.og ?? "",
    lob: authorization?.lob ?? "",
    contractName: authorization?.contractName ?? "",
    contractId: authorization?.contractId ?? "",
    invoice: authorization?.invoice ?? "",
    contractType: authorization?.contractType ?? "",
    periodStart: authorization?.periodStart ?? "",
    periodEnd: authorization?.periodEnd ?? "",
    pm: normalizePerson(authorization?.pm),
    backupRequestor: normalizePerson(authorization?.backupRequestor),
    scopeOfWork: authorization?.scopeOfWork ?? "",
    justification: authorization?.justification ?? "",
    notes: authorization?.notes ?? "",
    baseLaborAmount: Number(authorization?.baseLaborAmount ?? 0),
    baseTravelAmount: Number(authorization?.baseTravelAmount ?? 0),
    baseGrandTotal: Number(authorization?.baseGrandTotal ?? 0)
});

const normalizeExistingResources = (resources: IResourceItem[]): Record<string, unknown>[] => (
    [...resources]
        .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
        .map((resource, index) => ({
            lineNumber: resource.lineNumber ?? index + 1,
            employee: normalizePerson(resource.employee),
            state: resource.state ?? "",
            comments: resource.comments ?? ""
        }))
);

const normalizeDraftResources = (rows: IEditableResourceRow[]): Record<string, unknown>[] => (
    rows
        .filter((row) => !!row.employee?.Id)
        .map((row, index) => ({
            lineNumber: index + 1,
            employee: normalizePerson(row.employee),
            state: row.state.trim(),
            comments: row.comments.trim(),
            jobId: row.jobId.trim(),
            laborCategory: row.laborCategory.trim(),
            standardHours: Number(row.standardHours || 0),
            overtimeHours: Number(row.overtimeHours || 0),
            annualSalary: Number(row.annualSalary || 0),
            standardRate: Number(row.standardRate || 0),
            overtimeRate: Number(row.overtimeRate || 0)
        }))
);

const normalizeExistingLabor = (laborLines: ILaborLineItem[]): Record<string, unknown>[] => (
    [...laborLines]
        .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
        .map((line, index) => ({
            lineNumber: line.lineNumber ?? index + 1,
            pricingType: line.pricingType ?? "",
            jobId: line.jobId ?? "",
            laborCategory: line.laborCategory ?? "",
            resourceIds: line.resources?.results?.map((resource) => resource.Id).sort((left, right) => left - right) ?? [],
            standardHours: Number(line.standardHours ?? 0),
            overtimeHours: Number(line.overtimeHours ?? 0),
            annualSalary: Number(line.annualSalary ?? 0),
            standardRate: Number(line.standardRate ?? 0),
            overtimeRate: Number(line.overtimeRate ?? 0),
            totalAmount: Number(line.totalAmount ?? 0),
            comments: line.comments ?? ""
        }))
);

const normalizeDraftLabor = (rows: IEditableResourceRow[], ffpConfig: IFfpLaborConfig, contractType?: string): Record<string, unknown>[] => {
    const activeRows = rows.filter((row) => !!row.employee?.Id);

    if (contractType === "ffp") {
        return [{
            lineNumber: 1,
            pricingType: "ffp",
            jobId: ffpConfig.jobId.trim(),
            laborCategory: ffpConfig.laborCategory.trim(),
            employeeIds: activeRows.map((row) => row.employee?.Id).filter(Boolean),
            comments: ffpConfig.comments.trim()
        }];
    }

    return activeRows.map((row, index) => ({
        lineNumber: index + 1,
        pricingType: "tm",
        employeeId: row.employee?.Id ?? null,
        jobId: row.jobId.trim(),
        laborCategory: row.laborCategory.trim(),
        standardHours: Number(row.standardHours || 0),
        overtimeHours: Number(row.overtimeHours || 0),
        annualSalary: Number(row.annualSalary || 0),
        standardRate: Number(row.standardRate || 0),
        overtimeRate: Number(row.overtimeRate || 0),
        comments: row.comments.trim()
    }));
};

const normalizeExistingTravel = (travelOdcs: ITravelOdcItem[]): Record<string, unknown>[] => (
    [...travelOdcs]
        .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
        .map((line, index) => ({
            lineNumber: line.lineNumber ?? index + 1,
            lineType: line.lineType,
            jobId: line.jobId ?? "",
            description: line.description ?? "",
            amount: Number(line.amount ?? 0),
            comments: line.comments ?? ""
        }))
);

const normalizeDraftTravel = (rows: IEditableTravelRow[]): Record<string, unknown>[] => (
    rows.map((row, index) => ({
        lineNumber: index + 1,
        lineType: row.lineType,
        jobId: row.jobId.trim(),
        description: row.description.trim(),
        amount: Number(row.amount || 0),
        comments: row.comments.trim()
    }))
);

const stringifyStable = (value: unknown): string => JSON.stringify(value);

const hasChanged = (before: unknown, after: unknown): boolean => stringifyStable(before) !== stringifyStable(after);

export const captureIwaChangeSet = (input: IIwaChangeCaptureInput): IIwaChangeCaptureResult => {
    const before = {
        authorization: normalizeAuthorization(input.beforeAuthorization),
        resources: normalizeExistingResources(input.beforeResources),
        laborLines: normalizeExistingLabor(input.beforeLaborLines),
        travelOdcs: normalizeExistingTravel(input.beforeTravelOdcs)
    };

    const after = {
        authorization: normalizeAuthorization(input.afterAuthorization),
        resources: normalizeDraftResources(input.afterResourceRows),
        laborLines: normalizeDraftLabor(input.afterResourceRows, input.afterFfpLaborConfig, input.afterAuthorization.contractType),
        travelOdcs: normalizeDraftTravel(input.afterTravelRows)
    };

    const changedSections: string[] = [];

    if (hasChanged(before.authorization, after.authorization)) {
        changedSections.push("Header");
    }

    if (hasChanged(before.resources, after.resources)) {
        changedSections.push("Resources");
    }

    if (hasChanged(before.laborLines, after.laborLines)) {
        changedSections.push("Labor lines");
    }

    if (hasChanged(before.travelOdcs, after.travelOdcs)) {
        changedSections.push("Travel/ODC");
    }

    const changeSummary = changedSections.length > 0
        ? `${changedSections.join(", ")} updated.`
        : "No material changes detected.";

    return {
        changeSummary,
        changePayloadJson: JSON.stringify({
            capturedOn: new Date().toISOString(),
            changedSections,
            before,
            after
        })
    };
};
