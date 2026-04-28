import { IAppUserItem, IPeoplePicker, IWorkflowRunItem } from "../data/props";

export interface IWorkflowActionPermission {
    canAct: boolean;
    isDirectApprover: boolean;
    isBackupApprover: boolean;
    isAdmin: boolean;
    actingFor?: IPeoplePicker;
}

export const isAdminUser = (user?: IAppUserItem): boolean => {
    return (user?.role ?? "user").toLowerCase() === "admin";
};

export const getBackupCoverageMap = (
    appUsers: IAppUserItem[],
    currentUserId?: number
): Map<number, IPeoplePicker> => {
    const coverage = new Map<number, IPeoplePicker>();

    if (!currentUserId) {
        return coverage;
    }

    appUsers.forEach((profile: IAppUserItem): undefined => {
        const primaryUser = profile.user;
        const isCoveredByCurrentUser = (profile.backups?.results ?? []).some((backup: IPeoplePicker): boolean => {
            return backup.Id === currentUserId;
        });

        if (isCoveredByCurrentUser && typeof primaryUser?.Id === "number" && primaryUser.Id > 0) {
            coverage.set(primaryUser.Id, primaryUser);
        }

        return undefined;
    });

    return coverage;
};

export const getWorkflowActionPermission = (
    run: IWorkflowRunItem | undefined,
    currentUser: IAppUserItem | undefined,
    appUsers: IAppUserItem[]
): IWorkflowActionPermission => {
    const currentUserId = currentUser?.user?.Id;
    const pendingApprover = run?.pendingApprover;
    const pendingApproverId = pendingApprover?.Id;
    const admin = isAdminUser(currentUser);

    if (!run || run.runStatus !== "active" || !currentUserId || !pendingApproverId) {
        return {
            canAct: false,
            isDirectApprover: false,
            isBackupApprover: false,
            isAdmin: admin
        };
    }

    const isDirectApprover = pendingApproverId === currentUserId;
    const backupCoverage = getBackupCoverageMap(appUsers, currentUserId);
    const backupFor = backupCoverage.get(pendingApproverId);
    const isBackupApprover = !!backupFor;
    const canAct = isDirectApprover || isBackupApprover || admin;

    return {
        canAct,
        isDirectApprover,
        isBackupApprover,
        isAdmin: admin,
        actingFor: !isDirectApprover && canAct ? pendingApprover : undefined
    };
};
