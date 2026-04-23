export interface ILaborCompensationInput {
    annualSalary?: number;
    standardRate?: number;
    overtimeRate?: number;
    standardHours?: number;
    overtimeHours?: number;
}

export interface ILaborCompensationResolved {
    annualSalary: number;
    standardRate: number;
    overtimeRate: number;
    standardHours: number;
    overtimeHours: number;
    standardAmount: number;
    overtimeAmount: number;
    totalAmount: number;
}

const roundCurrency = (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const resolveLaborCompensation = (
    input: ILaborCompensationInput
): ILaborCompensationResolved => {
    const annualSalary = Number(input.annualSalary ?? 0);
    const derivedStandardRate = annualSalary > 0 ? annualSalary / 2080 : 0;
    const standardRate = Number(input.standardRate ?? 0) > 0
        ? Number(input.standardRate ?? 0)
        : derivedStandardRate;
    const overtimeRate = Number(input.overtimeRate ?? 0) > 0
        ? Number(input.overtimeRate ?? 0)
        : standardRate * 1.5;
    const standardHours = Number(input.standardHours ?? 0);
    const overtimeHours = Number(input.overtimeHours ?? 0);

    const standardAmount = roundCurrency(standardRate * standardHours);
    const overtimeAmount = roundCurrency(overtimeRate * overtimeHours);
    const totalAmount = roundCurrency(standardAmount + overtimeAmount);

    return {
        annualSalary: roundCurrency(annualSalary),
        standardRate: roundCurrency(standardRate),
        overtimeRate: roundCurrency(overtimeRate),
        standardHours: roundCurrency(standardHours),
        overtimeHours: roundCurrency(overtimeHours),
        standardAmount,
        overtimeAmount,
        totalAmount
    };
};
