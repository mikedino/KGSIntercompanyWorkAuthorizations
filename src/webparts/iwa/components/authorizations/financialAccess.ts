import { IAppUserItem, IAuthorizationItem, IPeoplePicker, IWorkflowRunItem } from "../data/props";
import { DataSource } from "../data/ds";

export const maskedCurrencyText = "$xxxx.xx";

const addPersonAndBackups = (
    authorizedIds: Set<number>,
    appUsers: IAppUserItem[],
    person?: IPeoplePicker
): void => {
    const personId = person?.Id;

    if (!personId) {
        return;
    }

    authorizedIds.add(personId);

    const profile = appUsers.find((appUser) => appUser.user?.Id === personId);
    (profile?.backups?.results ?? []).forEach((backup) => {
        if (backup.Id) {
            authorizedIds.add(backup.Id);
        }
    });
};

export const getFinancialViewerIds = (
    authorization: IAuthorizationItem | undefined,
    workflowRuns: IWorkflowRunItem[],
    appUsers: IAppUserItem[]
): Set<number> => {
    const authorizedIds = new Set<number>();

    addPersonAndBackups(authorizedIds, appUsers, authorization?.pm);

    workflowRuns.forEach((run) => {
        addPersonAndBackups(authorizedIds, appUsers, run.pendingApprover);
        addPersonAndBackups(authorizedIds, appUsers, run.hr);
        addPersonAndBackups(authorizedIds, appUsers, run.cfo);
    });

    return authorizedIds;
};

export const canViewFinancialAmounts = (
    currentUser: IAppUserItem | undefined,
    authorization: IAuthorizationItem | undefined,
    workflowRuns: IWorkflowRunItem[],
    appUsers: IAppUserItem[]
): boolean => {
    const currentUserId = currentUser?.user?.Id;
    const isAdmin = DataSource.isAdmin || (currentUser?.role ?? "user").toLowerCase() === "admin";
    const isOGP = DataSource.isOGP;

    if (!authorization) {
        return false;
    }

    if (isAdmin || isOGP) {
        return true;
    }

    if (!currentUserId) {
        return false;
    }

    return getFinancialViewerIds(authorization, workflowRuns, appUsers).has(currentUserId);
};
