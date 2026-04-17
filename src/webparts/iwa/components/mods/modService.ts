import { Web } from "gd-sprest";
import { IModItem } from "../data/props";
import Strings from "../common/strings";
import { formatError } from "../common/utils";

export class ModService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "modNumber",
        "modStatus", "reason", "changeSummary",
        "notes", "laborAmount", "travelAmount",
        "grandTotal", "pdfUrl", "pdfGeneratedOn",
        "approvedOn", "rejectedOn", "canceledOn",
        "Created", "Modified", "authorization/Id",
        "authorization/Title", "currentWorkflowRun/Id", "currentWorkflowRun/Title",
        "effectiveApprovedRun/Id", "effectiveApprovedRun/Title"
    ];

    private static readonly expandQuery: string[] = ["authorization", "currentWorkflowRun", "effectiveApprovedRun"];

    static getByAuthorization(authorizationId: number): Promise<IModItem[]> {
        return new Promise<IModItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Mods).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["modNumber asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IModItem[]),
                (error) => reject(new Error(`Error fetching Mods by Authorization: ${formatError(error)}`))
            );
        });
    }
}
