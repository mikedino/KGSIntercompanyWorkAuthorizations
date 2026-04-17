import { Web } from "gd-sprest";
import { ILaborLineItem } from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";

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
}
