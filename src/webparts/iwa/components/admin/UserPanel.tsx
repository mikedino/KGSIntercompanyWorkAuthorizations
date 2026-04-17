import * as React from "react";
import { useMemo, useState } from "react";
import {
    Avatar, Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    IconButton, List, ListItem, MenuItem, Paper, Stack, TextField,
    Typography, Button, Alert, Grid
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
//import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"; // (not used yet)
import { IAppUserItem } from "../data/props";
import { IPersonaProps } from "@fluentui/react";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { IPeoplePickerContext } from "@pnp/spfx-controls-react/lib/PeoplePicker";

type RoleFilter = "all" | "admin" | "user";

interface UsersAdminPanelProps {
    users: IAppUserItem[];
    peoplePickerContext: IPeoplePickerContext;
    onRoleChanged: (appUserItemId: number, role: IAppUserItem["role"]) => Promise<void>;
    onAddUser: (
        person: IPersonaProps,
        role: IAppUserItem["role"],
        modePreference: IAppUserItem["modePreference"]
    ) => Promise<void>;
}

const getInitials = (displayName?: string): string => {
    const name = (displayName ?? "").trim();
    if (!name) return "?";

    // If format is "Last, First MI"
    if (name.includes(",")) {
        const [lastPart, firstPart] = name.split(",").map(s => s.trim());

        const firstInitial = firstPart?.[0] ?? "?";
        const lastInitial = lastPart?.[0] ?? "";

        return (firstInitial + lastInitial).toUpperCase();
    }

    // Fallback: normal "First Last"
    const parts = name.split(/\s+/).filter(Boolean);

    const first = parts[0]?.[0] ?? "?";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

    return (first + last).toUpperCase();
};

const formatLastVisit = (iso?: string): string => {
    if (!iso) return "—";
    // keep it simple; you can swap to date-fns later if you want
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
};

export const UsersAdminPanel: React.FC<UsersAdminPanelProps> = ({ users, peoplePickerContext, onRoleChanged, onAddUser }) => {
    const [search, setSearch] = useState<string>("");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

    const [editOpen, setEditOpen] = useState<boolean>(false);
    const [editUser, setEditUser] = useState<IAppUserItem | null>(null);
    const [editRole, setEditRole] = useState<IAppUserItem["role"]>("user");
    const [saving, setSaving] = useState<boolean>(false);

    const [addOpen, setAddOpen] = useState<boolean>(false);
    const [addPerson, setAddPerson] = useState<IPersonaProps | undefined>(undefined);
    const [addRole, setAddRole] = useState<IAppUserItem["role"]>("user");
    const [addModePreference, setAddModePreference] = useState<IAppUserItem["modePreference"]>("dark");
    const [addError, setAddError] = useState<string>("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return users.filter(u => {
            const role = (u.role ?? "user").toLowerCase() as IAppUserItem["role"];
            const name = (u.user?.Title ?? "").toLowerCase();
            const email = (u.user?.EMail ?? "").toLowerCase();

            const matchesSearch = !q || name.includes(q) || email.includes(q);

            const matchesRole =
                roleFilter === "all"
                    ? true
                    : role === roleFilter;

            return matchesSearch && matchesRole;
        });
    }, [users, search, roleFilter]);

    const adminCount = useMemo(() => {
        return users.filter(u => ((u.role ?? "user").toLowerCase() as IAppUserItem["role"]) === "admin").length;
    }, [users]);

    const currentEditRole = useMemo(() => {
        if (!editUser) return "user" as IAppUserItem["role"];
        return ((editUser.role ?? "user").toLowerCase() as IAppUserItem["role"]);
    }, [editUser]);

    const isDemotingLastAdmin = useMemo(() => {
        if (!editUser) return false;
        return currentEditRole === "admin" && adminCount <= 1 && editRole !== "admin";
    }, [editUser, currentEditRole, adminCount, editRole]);

    ///////////////////////////////// EDIT USER //////////////////////////////////
    const openEdit = (u: IAppUserItem): void => {
        setEditUser(u);
        setEditRole((u.role ?? "user").toLowerCase() as IAppUserItem["role"]);
        setEditOpen(true);
    };

    const closeEdit = (): void => {
        if (saving) return;
        setEditOpen(false);
        setEditUser(null);
    };

    const handleSave = async (): Promise<void> => {
        if (!editUser) return;

        setSaving(true);
        try {
            await onRoleChanged(editUser.Id, editRole);
            setEditOpen(false);
            setEditUser(null);
        } finally {
            setSaving(false);
        }
    };

    /////////////////////////////// ADD USER /////////////////////////////
    const openAdd = (): void => {
        setAddPerson(undefined);
        setAddRole("user");
        setAddModePreference("dark");
        setAddError("");
        setAddOpen(true);
    };

    const closeAdd = (): void => {
        if (saving) return;
        setAddOpen(false);
    };

    const handleAddSave = async (): Promise<void> => {
        if (!addPerson?.id) {
            setAddError("Please select a user.");
            return;
        }

        const duplicate = users.some(
            u => Number(u.user?.Id) === Number(addPerson.id)
        );

        if (duplicate) {
            setAddError("That user already exists in the Users list.");
            return;
        }

        setSaving(true);
        try {
            await onAddUser(addPerson, addRole, addModePreference);
            setAddOpen(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700}>User Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage admin access and user profiles
                    </Typography>
                </Box>

                <Button variant="contained" color="secondary" startIcon={<PersonAddIcon />} onClick={openAdd}>
                    Add User
                </Button>
            </Stack>

            <Grid container spacing={1.25} sx={{ mb: 2 }} alignItems="center">

                {/* Search */}
                <Grid size={{ xs: 12, md: 6, xl: 8 }}>
                    <TextField
                        size="small"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        fullWidth
                    />
                </Grid>

                {/* Chips */}
                <Grid size={{ xs: 12, md: 6, xl: 4 }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }} >
                        <Chip
                            label="All"
                            clickable
                            color={roleFilter === "all" ? "info" : "default"}
                            variant={roleFilter === "all" ? "filled" : "outlined"}
                            onClick={() => setRoleFilter("all")}
                        />
                        <Chip
                            label="Admins"
                            clickable
                            color={roleFilter === "admin" ? "info" : "default"}
                            variant={roleFilter === "admin" ? "filled" : "outlined"}
                            onClick={() => setRoleFilter("admin")}
                        />
                        <Chip
                            label="Users"
                            clickable
                            color={roleFilter === "user" ? "info" : "default"}
                            variant={roleFilter === "user" ? "filled" : "outlined"}
                            onClick={() => setRoleFilter("user")}
                        />
                    </Stack>
                </Grid>

            </Grid>

            <Divider sx={{ mb: 1 }} />

            <List disablePadding>
                {filtered.map((u) => {
                    const name = u.user?.Title ?? "(unknown)";
                    const email = u.user?.EMail ?? "";
                    const role = (u.role ?? "user").toLowerCase() as IAppUserItem["role"];

                    return (
                        <React.Fragment key={u.Id}>
                            <ListItem sx={{ py: 1.25, px: 1, borderRadius: 2 }}>
                                <Grid
                                    container
                                    spacing={1.5}
                                    alignItems="center"
                                    sx={{
                                        width: "100%",
                                        minWidth: 0,
                                        flexWrap: { xs: "wrap", sm: "nowrap" } // keep single row on sm+
                                    }}
                                >
                                    {/* Avatar column (fixed) */}
                                    <Grid size={{ xs: "auto" }} sx={{ flex: "0 0 auto" }}>
                                        <Avatar sx={{ width: 40, height: 40 }}>
                                            {getInitials(name)}
                                        </Avatar>
                                    </Grid>

                                    {/* Name/email column (flex, can shrink) */}
                                    <Grid
                                        size={{ xs: 12, sm: "grow" }}
                                        sx={{ minWidth: 0 }}
                                    >
                                        <Typography fontWeight={700} noWrap>
                                            {name}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                                            {email}
                                            {typeof u.visitCount === "number" ? ` • Visits: ${u.visitCount}` : ""}
                                        </Typography>
                                    </Grid>

                                    {/* Right column (fixed-ish, stays right) */}
                                    <Grid
                                        size={{ xs: 12, sm: "auto" }}
                                        sx={{
                                            minWidth: 0,
                                            flex: { xs: "1 1 100%", sm: "0 0 auto" }, // full width on xs, auto on sm+
                                            display: "flex",
                                            justifyContent: { xs: "flex-start", sm: "flex-end" }
                                        }}
                                    >
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            sx={{
                                                flexWrap: "wrap",
                                                justifyContent: { xs: "flex-start", sm: "flex-end" },
                                                maxWidth: "100%",
                                                minWidth: 0
                                            }}
                                        >
                                            <Chip
                                                size="small"
                                                label={role === "admin" ? "Admin" : "User"}
                                                variant="outlined"
                                                color={role === "admin" ? "warning" : "default"}
                                            />

                                            <Chip
                                                size="small"
                                                label={u.modePreference === "dark" ? "Dark" : "Light"}
                                                variant="outlined"
                                            />

                                            {/* keep last visit + edit together */}
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ whiteSpace: "nowrap" }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Last visit: {formatLastVisit(u.lastVisit)}
                                                </Typography>

                                                <IconButton size="small" onClick={() => openEdit(u)} aria-label="Edit user">
                                                    <EditOutlinedIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </ListItem>

                            <Divider sx={{ my: 0.5 }} />
                        </React.Fragment>
                    );
                })}

                {!filtered.length && (
                    <Box sx={{ py: 4, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                            No users found.
                        </Typography>
                    </Box>
                )}
            </List>

            {/* EDIT USER DIALOG */}
            <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="xs">
                <DialogTitle>Edit User</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {isDemotingLastAdmin && (
                            <Alert severity="warning">You can’t demote the last Admin.</Alert>
                        )}
                        <Box>
                            <Typography fontWeight={700}>{editUser?.user?.Title ?? "—"}</Typography>
                            <Typography variant="body2" color="text.secondary">{editUser?.user?.EMail ?? ""}</Typography>
                        </Box>

                        <TextField
                            select
                            label="Role"
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as IAppUserItem["role"])}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="cm">CM</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </TextField>

                        <Typography variant="caption" color="text.secondary">
                            Admins automatically have CM privileges.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEdit} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => handleSave()}
                        disabled={saving || !editUser || isDemotingLastAdmin}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ADD USER DIALOG */}
            <Dialog open={addOpen} onClose={closeAdd} fullWidth maxWidth="sm">
                <DialogTitle>Add User</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        {addError && (
                            <Alert severity="error">{addError}</Alert>
                        )}

                        <MuiPeoplePicker
                            label="User"
                            context={peoplePickerContext}
                            value={addPerson?.secondaryText ? [String(addPerson.secondaryText)] : []}
                            required
                            selectionLimit={1}
                            onChange={(items: IPersonaProps[]) => {
                                setAddError("");
                                setAddPerson(items?.[0]);
                            }}
                        />

                        <TextField
                            select
                            label="Role"
                            value={addRole}
                            onChange={(e) => setAddRole(e.target.value as IAppUserItem["role"])}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="cm">CM</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </TextField>

                        <TextField
                            select
                            label="Default Theme"
                            value={addModePreference}
                            onChange={(e) => setAddModePreference(e.target.value as IAppUserItem["modePreference"])}
                            fullWidth
                            size="small"
                        >
                            <MenuItem value="dark">Dark</MenuItem>
                            <MenuItem value="light">Light</MenuItem>
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAdd} disabled={saving}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => handleAddSave()}
                        disabled={saving}
                    >
                        Add
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};
