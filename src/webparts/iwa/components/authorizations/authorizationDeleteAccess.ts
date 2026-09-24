import { IAppUserItem, IAuthorizationItem, ILookupItem, IModItem, IPeoplePicker, ModStatus, IWorkflowRunItem } from "../data/props";
import { DataSource } from "../data/ds";

const addPerson = (peopleById: Map<number, IPeoplePicker>, person?: IPeoplePicker): void => {
    if (typeof person?.Id === "number" && person.Id > 0) {
        peopleById.set(person.Id, person);
    }
};

const addPersonAndBackups = (
    peopleById: Map<number, IPeoplePicker>,
    appUsers: IAppUserItem[],
    person?: IPeoplePicker
): void => {
    addPerson(peopleById, person);

    const profile = appUsers.find((candidate) => candidate.user?.Id === person?.Id);
    (profile?.backups?.results ?? []).forEach((backup) => addPerson(peopleById, backup));
};

export const getAuthorizationDeleteParticipants = (
    authorization: IAuthorizationItem | undefined,
    appUsers: IAppUserItem[]
): IPeoplePicker[] => {
    const peopleById = new Map<number, IPeoplePicker>();

    if (!authorization) {
        return [];
    }

    addPersonAndBackups(peopleById, appUsers, authorization.Author);
    addPersonAndBackups(peopleById, appUsers, authorization.pm);
    addPerson(peopleById, authorization.backupRequestor);

    return [...peopleById.values()];
};

const wasFullyApproved = (authorization: IAuthorizationItem): boolean => {
    return authorization.authorizationStatus === "approved" ||
        authorization.authorizationStatus === "closed" ||
        !!authorization.approvedOn ||
        !!authorization.effectiveApprovedRun?.Id;
};

export const canDeleteAuthorization = (
    authorization: IAuthorizationItem | undefined,
    currentUser: IAppUserItem | undefined,
    appUsers: IAppUserItem[],
    currentRun: IWorkflowRunItem | undefined
): boolean => {
    const currentUserId = DataSource.CurrentUserId;

    if (!authorization || !currentUserId || wasFullyApproved(authorization)) {
        return false;
    }

    if (DataSource.isAdmin) {
        return true;
    }

    const isActiveApprovalWorkflow = currentRun?.runStatus === "active";
    const isReturnedToSubmitter = isActiveApprovalWorkflow &&
        currentRun?.outcome === "rejected" &&
        currentRun.currentStepKey === "submitter";

    if (!isActiveApprovalWorkflow && !isReturnedToSubmitter) {
        return false;
    }

    return getAuthorizationDeleteParticipants(authorization, appUsers).some((person) => person.Id === currentUserId);
};

export const canCancelMod = (
    authorization: IAuthorizationItem | undefined,
    currentUser: IAppUserItem | undefined,
    appUsers: IAppUserItem[],
    currentRun: IWorkflowRunItem | undefined,
    mod: IModItem | (ILookupItem & { modStatus?: ModStatus }) | undefined
): boolean => {
    const currentUserId = DataSource.CurrentUserId;
    const modId = mod?.Id ?? currentRun?.mod?.Id;
    const modStatus = mod?.modStatus;

    if (!authorization || !currentUserId || currentRun?.runType !== "mod" || !modId) {
        return false;
    }

    if (mod?.Id && currentRun.mod?.Id !== mod.Id) {
        return false;
    }

    if (modStatus && modStatus !== "submitted" && modStatus !== "underReview" && modStatus !== "rejected") {
        return false;
    }

    const isActiveModWorkflow = currentRun.runStatus === "active";
    const isReturnedToSubmitter = isActiveModWorkflow &&
        currentRun.outcome === "rejected" &&
        currentRun.currentStepKey === "submitter";

    if (!isActiveModWorkflow && !isReturnedToSubmitter) {
        return false;
    }

    if (DataSource.isAdmin) {
        return true;
    }

    const modAuthorId = (mod as IModItem | undefined)?.Author?.Id;
    const isAssignedModSubmitter = isReturnedToSubmitter && currentRun.pendingApprover?.Id === currentUserId;

    if (modAuthorId === currentUserId || isAssignedModSubmitter) {
        return true;
    }

    return getAuthorizationDeleteParticipants(authorization, appUsers).some((person) => person.Id === currentUserId);
};
