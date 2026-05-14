import { IAuthorizationItem, IAppUserItem, IWorkflowRunItem } from "../data/props";
import { getBackupCoverageMap } from "../workflow/workflowAccess";

export const canViewCompensation = (
    currentUser: IAppUserItem | undefined,
    authorization: IAuthorizationItem | undefined
): boolean => {
    const role = currentUser?.role;
    const currentUserId = currentUser?.user?.Id;

    if (!currentUserId || !authorization) {
        return false;
    }

    if (role === "admin" || role === "hr") {
        return true;
    }

    return authorization.pm?.Id === currentUserId;
};

export const canEditCompensation = (
    currentUser: IAppUserItem | undefined,
    currentRun?: IWorkflowRunItem,
    appUsers: IAppUserItem[] = []
): boolean => {
    const currentUserId = currentUser?.user?.Id;
    const role = currentUser?.role;

    if (role === "admin" || role === "hr") {
        return true;
    }

    if (!currentUserId || !currentRun?.hr?.Id) {
        return false;
    }

    if (currentRun.hr.Id === currentUserId) {
        return true;
    }

    return getBackupCoverageMap(appUsers, currentUserId).has(currentRun.hr.Id);
};
