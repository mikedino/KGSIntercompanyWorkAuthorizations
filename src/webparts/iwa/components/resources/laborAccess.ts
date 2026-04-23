import { IAuthorizationItem, IAppUserItem } from "../data/props";

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
    currentUser: IAppUserItem | undefined
): boolean => {
    return currentUser?.role === "admin" || currentUser?.role === "hr";
};
