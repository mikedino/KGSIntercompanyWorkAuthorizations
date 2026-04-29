import { Web } from "gd-sprest";
import { IResourceItem, LineScope } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";

export class ResourceService {

    private static readonly selectQuery: string[] = [
        "Id", "Title", "lineScope",
        "lineNumber", "displayOrder", "isActive",
        "state", "laborCategory", "comments", "authorization/Id",
        "authorization/Title", "mod/Id", "mod/Title",
        "employee/Id", "employee/Title", "employee/EMail"
    ];

    private static readonly expandQuery: string[] = ["authorization", "mod", "employee"];

    static async replaceForAuthorization(
        authorizationId: number,
        rows: Array<{
            title: string;
            lineNumber: number;
            displayOrder: number;
            employeeId: number;
            state: string;
            laborCategory: string;
            comments?: string;
        }>,
        options?: {
            lineScope?: LineScope;
            modId?: number;
        }
    ): Promise<IResourceItem[]> {
        const lineScope = options?.lineScope ?? "base";
        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            const matchesScope = item.lineScope === lineScope;
            const matchesMod = lineScope === "base" || item.mod?.Id === options?.modId;

            if (matchesScope && matchesMod) {
                await Web().Lists(Strings.Sites.main.lists.Resources).Items(item.Id).recycle().executeAndWait();
            }
        }

        for (const row of rows) {
            const addBody: Record<string, unknown> = {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Resources)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope,
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                employeeId: row.employeeId,
                state: row.state,
                laborCategory: row.laborCategory,
                comments: row.comments ?? ""
            };

            if (options?.modId) {
                addBody.modId = options.modId;
            }

            await Web().Lists(Strings.Sites.main.lists.Resources).Items().add(addBody).executeAndWait();
        }

        return this.getByAuthorization(authorizationId);
    }

    static getByAuthorization(authorizationId: number): Promise<IResourceItem[]> {
        return new Promise<IResourceItem[]>((resolve, reject) => {
            Web().Lists(Strings.Sites.main.lists.Resources).Items().query({
                Select: this.selectQuery,
                Expand: this.expandQuery,
                Filter: `authorization/Id eq ${authorizationId}`,
                OrderBy: ["displayOrder asc", "Id asc"],
                Top: 5000
            }).execute(
                (items) => resolve((items?.results ?? []) as unknown as IResourceItem[]),
                (error) => reject(new Error(`Error fetching Resources by Authorization: ${formatError(error)}`))
            );
        });
    }
}
