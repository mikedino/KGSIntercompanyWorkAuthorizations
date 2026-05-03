import { ChargingPeriod, IPeoplePicker, TravelLineType } from "../../data/props";

export interface IEditableResourceRow {
    id: string;
    employee?: IPeoplePicker;
    state: string;
    comments: string;
    jobId: string;
    laborCategory: string;
    standardHours: string;
    overtimeHours: string;
    annualSalary: string;
    standardRate: string;
    overtimeRate: string;
}

export interface IEditableTravelRow {
    id: string;
    lineType: TravelLineType;
    jobId: string;
    description: string;
    amount: string;
    comments: string;
}

export interface IEditableFfpLaborRow {
    id: string;
    jobId: string;
    chargingPeriod: ChargingPeriod;
    periodQty: string;
    lumpSumAmount: string;
    resourceRowIds: string[];
    comments: string;
}

export interface IPriorResourceRow {
    id: string;
    employee: IPeoplePicker;
    state: string;
    jobId: string;
    laborCategory: string;
    approvedStandardHours: number;
    approvedOvertimeHours: number;
}
