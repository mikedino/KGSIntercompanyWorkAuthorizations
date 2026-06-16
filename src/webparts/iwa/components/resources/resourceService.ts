import { Web } from "gd-sprest";
import { IPeoplePicker, IResourceItem, LineScope } from "../data/props";
import Strings from "../common/strings";
import { encodeListName, formatError } from "../common/utils";
import { SharePointUserResolver } from "../common/sharePointUserResolver";

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
            employee?: IPeoplePicker;
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
        if (lineScope === "mod" && !options?.modId) {
            throw new Error("Cannot save mod resources without a Mod lookup.");
        }

        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            const matchesScope = item.lineScope === lineScope;
            const matchesMod = lineScope === "base" || item.mod?.Id === options?.modId || !item.mod?.Id;

            if (matchesScope && matchesMod) {
                await Web().Lists(Strings.Sites.main.lists.Resources).Items(item.Id).recycle().executeAndWait();
            }
        }

        for (const row of rows) {
            const employeeId = await SharePointUserResolver.resolvePersonIdForCurrentWeb(
                row.employee,
                row.employeeId,
                "resource employee"
            );

            const addBody: Record<string, unknown> = {
                __metadata: { type: `SP.Data.${encodeListName(Strings.Sites.main.lists.Resources)}ListItem` },
                Title: row.title,
                authorizationId,
                lineScope,
                lineNumber: row.lineNumber,
                displayOrder: row.displayOrder,
                isActive: true,
                // Resource employees can come from copied prior rows or people
                // pickers. Resolve before saving because the numeric User Id is
                // scoped to the target list's site collection.
                employeeId,
                state: row.state,
                laborCategory: row.laborCategory,
                comments: row.comments ?? ""
            };

            if (options?.modId) {
                addBody.modId = options.modId;
            }

            await Web().Lists(Strings.Sites.main.lists.Resources).Items().add(addBody).executeAndWait();
        }

        const saved = await this.getByAuthorization(authorizationId);
        return saved.filter((item) => item.lineScope === lineScope && (lineScope === "base" || item.mod?.Id === options?.modId));
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

    static async deleteForMod(authorizationId: number, modId: number): Promise<void> {
        if (!authorizationId || !modId) {
            return;
        }

        const existing = await this.getByAuthorization(authorizationId);

        for (const item of existing) {
            if (item.lineScope === "mod" && item.mod?.Id === modId) {
                await Web().Lists(Strings.Sites.main.lists.Resources).Items(item.Id).recycle().executeAndWait();
            }
        }
    }
}
