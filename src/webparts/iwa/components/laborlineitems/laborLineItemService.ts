import { Web } from "gd-sprest";
import { ILaborLineItem } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";
import { resolveLaborCompensation } from "../resources/laborMath";

export class LaborLineItemService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "pricingType", "jobId", "laborCategory",
        "annualSalary", "standardRate", "overtimeRate",
        "standardHours", "overtimeHours", "standardAmount",
        "overtimeAmount", "chargingPeriod", "periodQty",
        "lumpSumAmount", "totalAmount", "comments",
        "authorization/Id", "authorization/Title", "mod/Id", "mod/Title",
        "resources/Id", "resources/Title"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod", "resources"];

    static async replaceForAuthorization(
        authorizationId: number,
        rows: Array<{
            title: string;
            lineNumber: number;
            displayOrder: number;
            pricingType: "tm" | "ffp";
            jobId: string;
            laborCategory: string;
            resourceIds: number[];
            comments?: string;
            annualSalary?: number;
            standardRate?: number;
            overtimeRate?: number;
            standardHours?: number;
            overtimeHours?: number;
        }>
    ): Promise<ILaborLineItem[]> {
        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            await Web().Lists(Strings.Sites.main.lists.LaborLine).Items(item.Id).recycle().executeAndWait();
        }

        for (const row of rows) {
            const compensation = resolveLaborCompensation({
                annualSalary: row.annualSalary,
                standardRate: row.standardRate,
                overtimeRate: row.overtimeRate,
                standardHours: row.standardHours,
                overtimeHours: row.overtimeHours
            });

            await Web().Lists(Strings.Sites.main.lists.LaborLine).Items().add({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.LaborLine)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope: "base",
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                pricingType: row.pricingType,
                jobId: row.jobId,
                laborCategory: row.laborCategory,
                resourcesId: { results: row.resourceIds },
                comments: row.comments ?? "",
                annualSalary: row.pricingType === "tm" ? compensation.annualSalary : 0,
                standardRate: row.pricingType === "tm" ? compensation.standardRate : 0,
                overtimeRate: row.pricingType === "tm" ? compensation.overtimeRate : 0,
                standardHours: row.pricingType === "tm" ? compensation.standardHours : 0,
                overtimeHours: row.pricingType === "tm" ? compensation.overtimeHours : 0,
                standardAmount: row.pricingType === "tm" ? compensation.standardAmount : 0,
                overtimeAmount: row.pricingType === "tm" ? compensation.overtimeAmount : 0,
                chargingPeriod: "monthly",
                periodQty: 1,
                lumpSumAmount: 0,
                totalAmount: row.pricingType === "tm" ? compensation.totalAmount : 0
            }).executeAndWait();
        }

        return this.getByAuthorization(authorizationId);
    }

    static getByAuthorization(authorizationId: number): Promise<ILaborLineItem[]> {
        return new Promise<ILaborLineItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.LaborLine).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["displayOrder asc", "Id asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as ILaborLineItem[]),
                (error) => reject(new Error(`Error fetching Labor Lines by Authorization: ${formatError(error)}`))
            );
        });
    }

    static async updateCompensation(
        laborLineId: number,
        values: {
            annualSalary?: number;
            standardRate?: number;
            overtimeRate?: number;
            standardHours?: number;
            overtimeHours?: number;
        }
    ): Promise<void> {
        const compensation = resolveLaborCompensation(values);

        await Web()
            .Lists(Strings.Sites.main.lists.LaborLine)
            .Items()
            .getById(laborLineId)
            .update({
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.LaborLine)}ListItem` },
                annualSalary: compensation.annualSalary,
                standardRate: compensation.standardRate,
                overtimeRate: compensation.overtimeRate,
                standardHours: compensation.standardHours,
                overtimeHours: compensation.overtimeHours,
                standardAmount: compensation.standardAmount,
                overtimeAmount: compensation.overtimeAmount,
                totalAmount: compensation.totalAmount
            })
            .executeAndWait();
    }
}
