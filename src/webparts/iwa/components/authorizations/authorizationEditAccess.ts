import { IAppUserItem, IAuthorizationItem, IModItem, IPeoplePicker } from "../data/props";
import { DataSource } from "../data/ds";

const samePerson = (left?: IPeoplePicker, rightId?: number): boolean => {
    return !!left?.Id && !!rightId && left.Id === rightId;
};

export const canUserEditAuthorization = (
    authorization: IAuthorizationItem | undefined,
    currentUser: IAppUserItem | undefined,
    appUsers: IAppUserItem[],
    mod?: IModItem
): boolean => {
    const currentUserId = DataSource.CurrentUserId;

    if (!authorization || !currentUserId) {
        return false;
    }

    if (DataSource.isAdmin) {
        return true;
    }

    if (
        samePerson(authorization.Author, currentUserId) ||
        samePerson(mod?.Author, currentUserId) ||
        samePerson(authorization.backupRequestor, currentUserId) ||
        samePerson(authorization.pm, currentUserId)
    ) {
        return true;
    }

    const creatorProfile = appUsers.find((profile) => profile.user?.Id === authorization.Author?.Id);

    return (creatorProfile?.backups?.results ?? []).some((backup) => backup.Id === currentUserId);
};
