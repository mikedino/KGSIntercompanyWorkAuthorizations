import { IAppUserItem, IAuthorizationItem, IPeoplePicker } from "../data/props";

const samePerson = (left?: IPeoplePicker, rightId?: number): boolean => {
    return !!left?.Id && !!rightId && left.Id === rightId;
};

export const canUserEditAuthorization = (
    authorization: IAuthorizationItem | undefined,
    currentUser: IAppUserItem | undefined,
    appUsers: IAppUserItem[]
): boolean => {
    const currentUserId = currentUser?.user?.Id;

    if (!authorization || !currentUserId) {
        return false;
    }

    if (
        samePerson(authorization.Author, currentUserId) ||
        samePerson(authorization.backupRequestor, currentUserId) ||
        samePerson(authorization.pm, currentUserId)
    ) {
        return true;
    }

    const creatorProfile = appUsers.find((profile) => profile.user?.Id === authorization.Author?.Id);

    return (creatorProfile?.backups?.results ?? []).some((backup) => backup.Id === currentUserId);
};
