import * as React from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { ILobItem, IOgItem, IPeoplePicker } from "../data/props";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { PeoplePickerContext } from "./ApproversPanel";
import { firstOrUndefined, OgField } from "./ApproversPanel";
import { IOgPayload } from "./ogService";
import { formatError } from "../common/utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";

interface OgDefaultsSectionProps {
    ogs: IOgItem[];
    lobs: ILobItem[];
    peoplePickerContext: PeoplePickerContext;
    savingKey: string;
    onChangeOg: (ogId: number, ogTitle: string, label: string, changedField: OgField, presidentId?: number, cmId?: number) => Promise<void>;
    onUpdate: (item: IOgPayload) => Promise<void>;
    onCreate: (item: IOgPayload) => Promise<void>;
    onDelete: (ogId: number, title: string) => Promise<void>;
    errors: Record<string, string>;
    clearError: (key: string) => void;
}

export const OgDefaultsSection: React.FC<OgDefaultsSectionProps> = ({
    ogs,
    lobs,
    peoplePickerContext,
    savingKey,
    onChangeOg,
    onUpdate,
    onCreate,
    onDelete,
    errors,
    clearError
}) => {

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
    const [editingOg, setEditingOg] = React.useState<IOgItem | undefined>(undefined);
    const [ogTitle, setOgTitle] = React.useState("");
    const [lobId, setLobId] = React.useState<number | "">("");
    const [ogPresident, setOgPresident] = React.useState<IPersonaProps | undefined>(undefined);
    const [ogCm, setOgCm] = React.useState<IPersonaProps | undefined>(undefined);
    const [ogType, setOgType] = React.useState<"OG" | "SrOG">("OG");
    const [parentOgId, setParentOgId] = React.useState<number | "">("");
    const [isActive, setIsActive] = React.useState(true);
    const [isSelectable, setIsSelectable] = React.useState(true);
    const [ogScm, setOgScm] = React.useState<IPersonaProps | undefined>(undefined);

    const [dialogError, setDialogError] = React.useState("");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState("");

    const handleTitleChange = (val: string): void => {
        setOgTitle(val);
        if (dialogError) setDialogError("");
    }

    const handlePresidentChange = (person: IPersonaProps | undefined): void => {
        setOgPresident(person);
        if (dialogError) setDialogError("");
    }

    const handleCmChange = (person: IPersonaProps | undefined): void => {
        setOgCm(person);
        if (dialogError) setDialogError("");
    }

    const handleLobChange = (lobId: number | ""): void => {
        setLobId(lobId);
        if (dialogError) setDialogError("");
    }

    const convertPickerToPersona = (person: IPeoplePicker | undefined): IPersonaProps | undefined => {
        return person ?
            {
                id: String(person.Id),
                text: person.Title,
                secondaryText: person.EMail
            }
            : undefined
    }

    const handleOgTypeChange = (value: "OG" | "SrOG"): void => {
        setOgType(value);

        // SrOGs cannot have parent or CM/SCM requirements in the current model
        // for now, just clear parent OG 
        if (value === "SrOG") {
            setParentOgId("");
            //setOgCm(undefined);
            //setOgScm(undefined);
            //setIsSelectable(false);
        }

        if (dialogError) setDialogError("");
    };

    const handleParentOgChange = (value: number | ""): void => {
        setParentOgId(value);
        if (dialogError) setDialogError("");
    };

    const handleIsActiveChange = (value: boolean): void => {
        setIsActive(value);
        if (dialogError) setDialogError("");
    };

    const handleIsSelectableChange = (value: boolean): void => {
        setIsSelectable(value);
        if (dialogError) setDialogError("");
    };

    const handleScmChange = (person: IPersonaProps | undefined): void => {
        setOgScm(person);
        if (dialogError) setDialogError("");
    };

    const openAddDialog = (): void => {
        setDialogMode("add");
        setEditingOg(undefined);
        setOgTitle("");
        setLobId("");
        setOgType("OG");
        setParentOgId("");
        setIsActive(true);
        setIsSelectable(true);
        setOgPresident(undefined);
        setOgCm(undefined);
        setOgScm(undefined);
        setDialogError("");
        setDialogOpen(true);
    };

    const openEditDialog = (og: IOgItem): void => {
        setDialogMode("edit");
        setEditingOg(og);
        setOgTitle(og.Title ?? "");
        setLobId(og.lob?.Id ?? "");
        setOgType(og.ogType);
        setParentOgId(og.parentOg?.Id ?? "");
        setIsActive(og.isActive);
        setIsSelectable(og.isSelectable);
        setOgPresident(convertPickerToPersona(og.president));
        setOgCm(convertPickerToPersona(og.CM));
        setOgScm(convertPickerToPersona(og.SCM));
        setDialogError("");
        setDialogOpen(true);
    };

    const closeDialog = (): void => {
        if (!!savingKey) return;

        setDialogOpen(false);
        setEditingOg(undefined);
        setOgTitle("");
        setLobId("");
        setOgType("OG");
        setParentOgId("");
        setIsActive(true);
        setIsSelectable(true);
        setOgCm(undefined);
        setOgScm(undefined);
        setOgPresident(undefined);
        setDialogError("");
    };

    const openDeleteConfirm = (): void => {
        setDeleteError("");
        setConfirmDeleteOpen(true);
    };

    const closeDeleteConfirm = (): void => {
        if (!!savingKey) return;
        setConfirmDeleteOpen(false);
        setDeleteError("");
    };

    const srOgOptions = React.useMemo<IOgItem[]>(() => {
        return ogs.filter((og) => og.ogType === "SrOG" && og.isActive);
    }, [ogs]);

    const isSrOg = ogType === "SrOG";

    const handleDialogSave = async (): Promise<void> => {
        const trimmedTitle = ogTitle.trim();

        if (!trimmedTitle) {
            setDialogError("OG title is required.");
            return;
        }

        const duplicate = ogs.some((e) =>
            e.Title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
            e.Id !== editingOg?.Id
        );

        if (duplicate) {
            setDialogError("An OG with that title already exists.");
            return;
        }

        const presidentId = ogPresident?.id ? Number(ogPresident.id) : undefined;
        if (!presidentId || Number.isNaN(presidentId)) {
            setDialogError(isSrOg ? "SrOG President is required." : "OG President is required.");
            return;
        }

        const thisLobId = lobId ? Number(lobId) : undefined;
        if (!thisLobId || Number.isNaN(thisLobId)) {
            setDialogError("LOB is required.");
            return;
        }

        const thisParentOgId = parentOgId ? Number(parentOgId) : undefined;
        if (thisParentOgId && editingOg?.Id === thisParentOgId) {
            setDialogError("An OG cannot be its own parent.");
            return;
        }

        let cmId: number | undefined = undefined;
        let scmId: number | undefined = undefined;

        if (!isSrOg) {
            cmId = ogCm?.id ? Number(ogCm.id) : undefined;
            if (!cmId || Number.isNaN(cmId)) {
                setDialogError("CM is required.");
                return;
            }

            scmId = ogScm?.id ? Number(ogScm.id) : undefined;
        }

        // preserve state in case save fails
        const mode = dialogMode;
        const og = editingOg;
        const title = ogTitle;
        const lob = thisLobId;
        const type = ogType;
        const parentId = parentOgId;
        const active = isActive;
        const selectable = isSelectable;
        const president = ogPresident;
        const cm = ogCm;
        const scm = ogScm;

        // close first so backdrop is top layer
        setDialogOpen(false);
        setDialogError("");

        const fullItem: IOgPayload = {
            Id: og?.Id ?? 0,
            Title: trimmedTitle,
            presidentId,
            lobId: thisLobId,
            ogType,
            parentOgId: isSrOg ? undefined : thisParentOgId,
            isActive,
            isSelectable: isSelectable,
            CMId: cmId,
            SCMId: scmId
        };

        try {
            if (mode === "add") {
                await onCreate(fullItem);
            } else if (og) {
                await onUpdate(fullItem);
            }

            // clear after success
            setEditingOg(undefined);
            setOgTitle("");
            setLobId("");
            setOgType("OG");
            setParentOgId("");
            setIsActive(true);
            setIsSelectable(true);
            setOgCm(undefined);
            setOgScm(undefined);
            setOgPresident(undefined);
        } catch (e) {
            // reopen and restore values if save fails
            setDialogMode(mode);
            setEditingOg(og);
            setOgTitle(title);
            setLobId(lob);
            setOgType(type);
            setParentOgId(parentId);
            setIsActive(active);
            setIsSelectable(selectable);
            setOgPresident(president);
            setOgCm(cm);
            setOgScm(scm);
            setDialogError(formatError(e));
            setDialogOpen(true);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!editingOg?.Id) return;

        const current = ogs.find(e => e.Id === editingOg.Id);
        if (!current) {
            setDeleteError("OG not found.");
            return;
        }

        try {
            setConfirmDeleteOpen(false);
            setDialogOpen(false);

            await onDelete(current.Id, current.Title);

            setEditingOg(undefined);
            setOgTitle("");
            setLobId("");
            setOgCm(undefined);
            setOgPresident(undefined);
            setDialogError("");
            setDeleteError("");
        } catch (e) {
            setDeleteError(formatError(e));
            setConfirmDeleteOpen(true);
        }
    };

    // simulate a grouped list of sr og's and children og's
    const sortedOgs = React.useMemo<IOgItem[]>(() => {
        if (!ogs?.length) return [];

        // top-level items = SrOGs + OGs without a parent
        const topLevelOgs = ogs
            .filter((og) => og.ogType === "SrOG" || !og.parentOg?.Id)
            .sort((a, b) => a.Title.localeCompare(b.Title));

        const childOgs = ogs.filter((og) => og.ogType === "OG" && !!og.parentOg?.Id);

        const result: IOgItem[] = [];

        topLevelOgs.forEach((topOg) => {
            result.push(topOg);

            // only SrOGs should have children shown beneath them
            if (topOg.ogType === "SrOG") {
                const children = childOgs
                    .filter((child) => child.parentOg?.Id === topOg.Id)
                    .sort((a, b) => a.Title.localeCompare(b.Title));

                result.push(...children);
            }
        });

        return result;
    }, [ogs]);

    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box
                sx={{
                    minWidth: 0,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                    flexWrap: "wrap"
                }}
            >
                <Box>
                    <Typography fontWeight={700}>Operating Group Defaults</Typography>
                    <Typography variant="body2" color="text.secondary">
                        OG President + Contract Manager are stored per OG
                    </Typography>
                </Box>

                <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openAddDialog} aria-label="Add OG" title="Add OG">
                    Add OG
                </Button>
            </Box>

            <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                {sortedOgs.map((og) => {
                    const rowKey = `og-${og.Id}`;
                    const isSrOg = og.ogType === "SrOG";
                    const isChildOg = og.ogType === "OG" && !!og.parentOg?.Id;

                    return (
                        <Paper
                            key={og.Id}
                            sx={{
                                p: 1.5,
                                minWidth: 0,
                                pl: isChildOg ? 3 : 1.5
                            }}
                        >
                            <Box
                                sx={{
                                    minWidth: 0,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: 2,
                                    flexWrap: "wrap"
                                }}
                            >
                                <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ minWidth: 0, flexWrap: "wrap" }}
                                    >
                                        {isChildOg && (
                                            <SubdirectoryArrowRightIcon
                                                fontSize="small"
                                                sx={{ opacity: 0.6 }}
                                            />
                                        )}

                                        <Typography fontWeight={isChildOg ? 500 : 700} noWrap>
                                            {og.Title}
                                        </Typography>

                                        <Chip
                                            size="small"
                                            label={isSrOg ? "SrOG" : "OG"}
                                            color={isSrOg ? "secondary" : "default"}
                                            variant={isSrOg ? "filled" : "outlined"}
                                        />
                                    </Stack>

                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        LOB: {og.lob?.Title ?? "—"}
                                    </Typography>

                                    {isChildOg && (
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            Parent SrOG: {og.parentOg?.Title}
                                        </Typography>
                                    )}
                                </Stack>

                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
                                >
                                    <Chip
                                        size="small"
                                        label={og.isActive ? "Active" : "Inactive"}
                                        color={og.isActive ? "success" : "default"}
                                        variant={og.isActive ? "filled" : "outlined"}
                                    />

                                    <Chip
                                        size="small"
                                        label={og.isSelectable ? "Selectable" : "Hidden"}
                                        color={og.isSelectable ? "info" : "default"}
                                        variant={og.isSelectable ? "filled" : "outlined"}
                                    />

                                    <IconButton
                                        size="small"
                                        aria-label={`Edit ${og.Title}`}
                                        title={`Edit ${og.Title}`}
                                        onClick={() => openEditDialog(og)}
                                        disabled={savingKey === rowKey || !!savingKey}
                                    >
                                        <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Box>
                        </Paper>
                    );
                })}
            </Stack>

            <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
                <DialogTitle>{dialogMode === "add" ? `Add OG` : `Edit OG`}</DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        {dialogError && (
                            <Alert severity="error">
                                {dialogError}
                            </Alert>
                        )}

                        <TextField
                            label="OG Title"
                            value={ogTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            fullWidth
                            size="small"
                            autoFocus
                        />

                        <TextField
                            select
                            label="Type"
                            required
                            fullWidth
                            value={ogType}
                            onChange={(e) => handleOgTypeChange(e.target.value as "OG" | "SrOG")}
                        >
                            <MenuItem value="OG">OG</MenuItem>
                            <MenuItem value="SrOG">SrOG</MenuItem>
                        </TextField>

                        <TextField
                            select
                            label="LOB"
                            required
                            fullWidth
                            value={lobId}
                            onChange={(e) => {
                                const selected = e.target.value;
                                handleLobChange(selected === "" ? "" : Number(selected));
                            }}
                        >
                            {lobs.map((lob) => (
                                <MenuItem key={lob.Id} value={lob.Id}>
                                    {lob.Title}
                                </MenuItem>
                            ))}
                        </TextField>

                        <MuiPeoplePicker
                            label={isSrOg ? "SrOG President" : "OG President"}
                            context={peoplePickerContext}
                            value={ogPresident?.secondaryText ? [ogPresident.secondaryText] : []}
                            required
                            selectionLimit={1}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);
                                handlePresidentChange(selected);
                            }}
                        />

                        <MuiPeoplePicker
                            label="Contract Manager"
                            context={peoplePickerContext}
                            value={ogCm?.secondaryText ? [ogCm.secondaryText] : []}
                            required
                            selectionLimit={1}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);
                                handleCmChange(selected);
                            }}
                        />

                        <MuiPeoplePicker
                            label="Subcontract Manager"
                            context={peoplePickerContext}
                            value={ogScm?.secondaryText ? [ogScm.secondaryText] : []}
                            selectionLimit={1}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);
                                handleScmChange(selected);
                            }}
                        />

                        {!isSrOg && (
                            <TextField
                                select
                                label="Parent SrOG"
                                fullWidth
                                value={parentOgId}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    handleParentOgChange(selected === "" ? "" : Number(selected));
                                }}
                            >
                                <MenuItem value="">None</MenuItem>
                                {srOgOptions
                                    .filter((e) => e.Id !== editingOg?.Id)
                                    .map((e) => (
                                        <MenuItem key={e.Id} value={e.Id}>
                                            {e.Title}
                                        </MenuItem>
                                    ))}
                            </TextField>
                        )}

                        <TextField
                            select
                            label="Active"
                            fullWidth
                            value={isActive ? "true" : "false"}
                            onChange={(e) => handleIsActiveChange(e.target.value === "true")}
                        >
                            <MenuItem value="true">Active</MenuItem>
                            <MenuItem value="false">Inactive</MenuItem>
                        </TextField>

                        <TextField
                            select
                            label="Selectable in Forms"
                            fullWidth
                            value={isSelectable}
                            error={isSrOg && isSelectable}
                            //disabled={isSrOg}
                            onChange={(e) => handleIsSelectableChange(e.target.value === "true")}
                                    helperText={isSrOg ? "SrOG rows should not be selectable in authorization forms." : undefined}
                        >
                            <MenuItem value="true">Yes</MenuItem>
                            <MenuItem value="false">No</MenuItem>
                        </TextField>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ justifyContent: "space-between" }}>
                    <Box>
                        {dialogMode === "edit" && (
                            <Button
                                color="error"
                                variant="outlined"
                                onClick={openDeleteConfirm}
                                disabled={!!savingKey}
                                aria-label="Delete OG"
                                title="Delete OG"
                            >
                                Delete
                            </Button>
                        )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                        <Button onClick={closeDialog} disabled={!!savingKey} aria-label="Cancel OG changes" title="Cancel OG changes">
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => {
                                handleDialogSave().catch((err) => console.error(`OG dialog save failed`, err));
                            }}
                            disabled={!!savingKey}
                            aria-label={dialogMode === "add" ? "Add OG" : "Save OG"}
                            title={dialogMode === "add" ? "Add OG" : "Save OG"}
                        >
                            {dialogMode === "add" ? "Add" : "Save"}
                        </Button>
                    </Stack>
                </DialogActions>
            </Dialog>

            <ConfirmDeleteDialog
                open={confirmDeleteOpen}
                title="Delete OG"
                message={`Are you sure you want to delete "${ogTitle}"? This cannot be undone.`}
                confirmLabel="Delete"
                error={deleteError}
                busy={!!savingKey}
                onClose={closeDeleteConfirm}
                onConfirm={handleDelete}
            />

        </Stack>
    );
};
