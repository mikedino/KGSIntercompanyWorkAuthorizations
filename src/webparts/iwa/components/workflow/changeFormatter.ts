import { formatDate } from "../common/utils";

export interface IIwaFormattedChangeLine {
    text: string;
    delta?: string;
    deltaDirection?: "positive" | "negative";
}

export interface IIwaFormattedChangeSection {
    title: string;
    lines: IIwaFormattedChangeLine[];
}

const headerLabels: Record<string, string> = {
    donorEntity: "Donor Entity",
    receivingEntity: "Receiving Entity",
    og: "Operating Group",
    lob: "LOB",
    contractName: "Contract Name",
    contractId: "Contract ID",
    customerContractCode: "Customer Contract Code",
    naicsCode: "NAICS Code",
    invoice: "Invoice",
    contractType: "Contract Type",
    periodStart: "Period Start",
    periodEnd: "Period End",
    pm: "Project Manager",
    backupRequestor: "Backup Requestor",
    scopeOfWork: "Scope",
    justification: "Justification",
    notes: "Notes",
    baseLaborAmount: "Labor Amount",
    baseTravelAmount: "Travel/ODC Amount",
    baseGrandTotal: "Grand Total"
};

const resourceLabels: Record<string, string> = {
    employee: "Employee",
    state: "State",
    laborCategory: "Labor Category",
    standardHours: "Standard Hours",
    overtimeHours: "Overtime Hours",
    comments: "Comments"
};

const laborLabels: Record<string, string> = {
    pricingType: "Pricing Type",
    jobId: "Job ID",
    jobTitle: "Job Title",
    standardHours: "Standard Hours",
    overtimeHours: "Overtime Hours",
    annualSalary: "Annual Salary",
    standardRate: "Standard Rate",
    overtimeRate: "Overtime Rate",
    chargingPeriod: "Charging Period",
    periodQty: "Number of Periods",
    lumpSumAmount: "Lump Sum Amount",
    totalAmount: "Total Amount",
    employeeIds: "Resources",
    comments: "Comments"
};

const travelLabels: Record<string, string> = {
    lineType: "Type",
    jobId: "Job ID",
    jobTitle: "Job Title",
    description: "Description",
    amount: "Amount",
    comments: "Comments"
};

const moneyKeys = new Set(["baseLaborAmount", "baseTravelAmount", "baseGrandTotal", "annualSalary", "standardRate", "overtimeRate", "amount", "lumpSumAmount", "totalAmount"]);
const dateKeys = new Set(["periodStart", "periodEnd"]);

const asRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
};

const asArray = (value: unknown): Record<string, unknown>[] => {
    return Array.isArray(value) ? value.map(asRecord) : [];
};

const formatMoney = (value: unknown): string => {
    const next = Number(value ?? 0);

    return next.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const formatPerson = (value: unknown): string => {
    const record = asRecord(value);
    const name = String(record.name ?? "").trim();
    return name;
};

const formatValue = (key: string, value: unknown): string => {
    if (value === undefined || value === null || value === "") {
        return "-";
    }

    if (moneyKeys.has(key)) {
        return formatMoney(value);
    }

    if (dateKeys.has(key)) {
        return formatDate(String(value), false);
    }

    if (Array.isArray(value)) {
        return value.map((item) => formatValue(key, item)).filter((item) => item !== "-").join(", ") || "-";
    }

    if (typeof value === "object") {
        const record = asRecord(value);

        if ("name" in record || "email" in record) {
            return formatPerson(record);
        }

        if ("id" in record) {
            return String(record.id ?? "-");
        }

        return JSON.stringify(record);
    }

    return String(value).trim() || "-";
};

const valuesEqual = (key: string, left: unknown, right: unknown): boolean => {
    if (moneyKeys.has(key)) {
        return Math.abs(Number(left ?? 0) - Number(right ?? 0)) < 0.01;
    }

    return formatValue(key, left) === formatValue(key, right);
};

const formatFieldChanges = (
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    labels: Record<string, string>
): IIwaFormattedChangeLine[] => {
    return Object.keys(labels)
        .filter((key) => !valuesEqual(key, before[key], after[key]))
        .map((key) => {
            const baseText = `${labels[key]} changed from ${formatValue(key, before[key])} to ${formatValue(key, after[key])}.`;

            if (!moneyKeys.has(key)) {
                return { text: baseText };
            }

            const delta = Number(after[key] ?? 0) - Number(before[key] ?? 0);

            if (Math.abs(delta) < 0.01) {
                return { text: baseText };
            }

            return {
                text: baseText,
                delta: `${delta > 0 ? "+" : "-"}${formatMoney(Math.abs(delta))}`,
                deltaDirection: delta > 0 ? "positive" : "negative"
            };
        });
};

const getLineKey = (line: Record<string, unknown>, index: number): string => {
    return String(line.lineNumber ?? line.employeeId ?? index + 1);
};

const describeLine = (line: Record<string, unknown>, fallback: string): string => {
    const employee = formatValue("employee", line.employee);
    const description = String(line.description ?? "").trim();
    const jobId = String(line.jobId ?? "").trim();

    if (employee !== "-") {
        return employee;
    }

    if (description) {
        return description;
    }

    if (jobId) {
        return jobId;
    }

    return fallback;
};

const formatCollectionChanges = (
    title: string,
    before: Record<string, unknown>[],
    after: Record<string, unknown>[],
    labels: Record<string, string>,
    describe?: (line: Record<string, unknown>, key: string) => string
): IIwaFormattedChangeSection | undefined => {
    const lines: IIwaFormattedChangeLine[] = [];
    const beforeMap = new Map(before.map((line, index) => [getLineKey(line, index), line]));
    const afterMap = new Map(after.map((line, index) => [getLineKey(line, index), line]));

    afterMap.forEach((afterLine, key) => {
        const beforeLine = beforeMap.get(key);

        if (!beforeLine) {
            lines.push({ text: `Added ${(describe ?? describeLine)(afterLine, `line ${key}`)}.` });
            return;
        }

        const changes = formatFieldChanges(beforeLine, afterLine, labels);

        if (changes.length > 0) {
            lines.push({
                text: `${(describe ?? describeLine)(afterLine, `Line ${key}`)}: ${changes.map((change) => {
                    return change.delta ? `${change.text} (${change.delta})` : change.text;
                }).join(" ")}`
            });
        }
    });

    beforeMap.forEach((beforeLine, key) => {
        if (!afterMap.has(key)) {
            lines.push({ text: `Removed ${(describe ?? describeLine)(beforeLine, `line ${key}`)}.` });
        }
    });

    return lines.length > 0 ? { title, lines } : undefined;
};

const mergeLaborHoursIntoResources = (
    resources: Record<string, unknown>[],
    laborLines: Record<string, unknown>[]
): Record<string, unknown>[] => {
    const laborByLineNumber = new Map<string, Record<string, unknown>>();

    laborLines.forEach((line, index) => {
        laborByLineNumber.set(getLineKey(line, index), line);
    });

    return resources.map((resource, index) => {
        const labor = laborByLineNumber.get(getLineKey(resource, index));

        if (!labor) {
            return resource;
        }

        return {
            ...resource,
            standardHours: labor.standardHours,
            overtimeHours: labor.overtimeHours
        };
    });
};

const getResourceNameByLineNumber = (resources: Record<string, unknown>[]): Map<string, string> => {
    const names = new Map<string, string>();

    resources.forEach((resource, index) => {
        const key = getLineKey(resource, index);
        const name = formatValue("employee", resource.employee);

        if (name !== "-") {
            names.set(key, name);
        }
    });

    return names;
};

const stripResourceLabeledLaborChanges = (
    before: Record<string, unknown>[],
    after: Record<string, unknown>[],
    resourceNames: Map<string, string>
): { before: Record<string, unknown>[]; after: Record<string, unknown>[] } => {
    const labelsToStrip = new Set(["standardHours", "overtimeHours"]);

    return {
        before: before.map((line, index) => {
            const key = getLineKey(line, index);
            const next = { ...line };

            if (resourceNames.has(key)) {
                labelsToStrip.forEach((label) => delete next[label]);
            }

            return next;
        }),
        after: after.map((line, index) => {
            const key = getLineKey(line, index);
            const next = { ...line };

            if (resourceNames.has(key)) {
                labelsToStrip.forEach((label) => delete next[label]);
            }

            return next;
        })
    };
};

export const formatIwaChangePayload = (payloadJson?: string, fallbackSummary?: string): IIwaFormattedChangeSection[] => {
    if (!payloadJson) {
        return fallbackSummary ? [{ title: "Summary", lines: [{ text: fallbackSummary }] }] : [];
    }

    try {
        const payload = asRecord(JSON.parse(payloadJson));
        const before = asRecord(payload.before);
        const after = asRecord(payload.after);
        const sections: IIwaFormattedChangeSection[] = [];
        const beforeResources = asArray(before.resources);
        const afterResources = asArray(after.resources);
        const beforeLabor = asArray(before.laborLines);
        const afterLabor = asArray(after.laborLines);
        const resourceNames = getResourceNameByLineNumber(afterResources);
        const headerChanges = formatFieldChanges(asRecord(before.authorization), asRecord(after.authorization), headerLabels);

        if (headerChanges.length > 0) {
            sections.push({ title: "Header", lines: headerChanges });
        }

        const resourceChanges = formatCollectionChanges(
            "Resources",
            mergeLaborHoursIntoResources(beforeResources, beforeLabor),
            mergeLaborHoursIntoResources(afterResources, afterLabor),
            resourceLabels,
            (line, key) => resourceNames.get(String(line.lineNumber ?? key)) ?? describeLine(line, key)
        );
        const laborForDisplay = stripResourceLabeledLaborChanges(beforeLabor, afterLabor, resourceNames);
        const laborChanges = formatCollectionChanges("Labor Lines", laborForDisplay.before, laborForDisplay.after, laborLabels);
        const travelChanges = formatCollectionChanges("Travel/ODC", asArray(before.travelOdcs), asArray(after.travelOdcs), travelLabels);

        [resourceChanges, laborChanges, travelChanges].forEach((section) => {
            if (section) {
                sections.push(section);
            }
        });

        if (sections.length === 0 && fallbackSummary) {
            sections.push({ title: "Summary", lines: [{ text: fallbackSummary }] });
        }

        return sections;
    } catch {
        return fallbackSummary ? [{ title: "Summary", lines: [{ text: fallbackSummary }] }] : [];
    }
};
