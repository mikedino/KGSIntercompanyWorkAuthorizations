import * as React from "react";
import {
    Box, Button, Grid, IconButton, Paper, Stack, Typography
} from "@mui/material";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { ILobItem } from "../data/props";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { PeoplePickerContext } from "./ApproversPanel";
import { toPickerValue, firstOrUndefined, run } from "./ApproversPanel";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from '@mui/icons-material/Add';
import { ConfigEditDialog } from "./ConfigEditDialog";
import { formatError } from "../common/utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface LobDefaultsSectionProps {
    lobs: ILobItem[];
    peoplePickerContext: PeoplePickerContext;
    savingKey: string;
    onChangeCoo: (lobId: number, lobTitle: string, label: string, person?: IPersonaProps) => Promise<void>;
    onEditTitle: (lobId: number, currentTitle: string, nextTitle: string) => Promise<void>;
    onCreate: (title: string, cooId?: number) => Promise<void>;
    onDelete: (lobId: number, title: string) => Promise<void>;
    errors: Record<string, string>;
    clearError: (key: string) => void;
}

export const LobDefaultsSection: React.FC<LobDefaultsSectionProps> = ({
    lobs,
    peoplePickerContext,
    savingKey,
    onChangeCoo,
    onEditTitle,
    onCreate,
    onDelete,
    errors,
    clearError
}) => {

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
    const [editingLobId, setEditingLobId] = React.useState<number | undefined>(undefined);
    const [lobTitle, setLobTitle] = React.useState("");
    const [lobCoo, setLobCoo] = React.useState<IPersonaProps | undefined>(undefined);
    const [dialogError, setDialogError] = React.useState("");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState("");


    const openAddDialog = (): void => {
        setDialogMode("add");
        setEditingLobId(undefined);
        setLobTitle("");
        setLobCoo(undefined);
        setDialogError("");
        setDialogOpen(true);
    };

    const openEditDialog = (lob: ILobItem): void => {
        setDialogMode("edit");
        setEditingLobId(lob.Id);
        setLobTitle(lob.Title ?? "");
        setLobCoo(
            lob.coo
                ? {
                    id: String(lob.coo.Id),
                    text: lob.coo.Title,
                    secondaryText: lob.coo.EMail
                }
                : undefined
        );
        setDialogError("");
        setDialogOpen(true);
    };

    const closeDialog = (): void => {
        if (!!savingKey) return;

        setDialogOpen(false);
        setEditingLobId(undefined);
        setLobTitle("");
        setLobCoo(undefined);
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

    const handleDialogSave = async (): Promise<void> => {
        const trimmedTitle = lobTitle.trim();

        if (!trimmedTitle) {
            setDialogError("LOB title is required.");
            return;
        }

        const duplicate = lobs.some(l =>
            l.Title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
            l.Id !== editingLobId
        );

        if (duplicate) {
            setDialogError("A LOB with that title already exists.");
            return;
        }

        const cooId = lobCoo?.id ? Number(lobCoo.id) : undefined;
        if (!cooId || Number.isNaN(cooId)) {
            setDialogError("COO is required.");
            return;
        }

        // preserve state in case save fails
        const mode = dialogMode;
        const lobId = editingLobId;
        const title = lobTitle;
        const coo = lobCoo;

        // close first so backdrop is top layer
        setDialogOpen(false);
        setDialogError("");

        try {
            if (mode === "add") {
                await onCreate(trimmedTitle, cooId);
            } else if (lobId) {
                const current = lobs.find(l => l.Id === lobId);
                await onEditTitle(lobId, current?.Title ?? trimmedTitle, trimmedTitle);
            }

            // clear after success
            setEditingLobId(undefined);
            setLobTitle("");
            setLobCoo(undefined);
        } catch (e) {
            // reopen and restore values if save fails
            setDialogMode(mode);
            setEditingLobId(lobId);
            setLobTitle(title);
            setLobCoo(coo);
            setDialogError(formatError(e));
            setDialogOpen(true);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!editingLobId) return;

        const current = lobs.find(l => l.Id === editingLobId);
        if (!current) {
            setDeleteError("LOB not found.");
            return;
        }

        try {
            setConfirmDeleteOpen(false);
            setDialogOpen(false);

            await onDelete(current.Id, current.Title);

            setEditingLobId(undefined);
            setLobTitle("");
            setLobCoo(undefined);
            setDialogError("");
            setDeleteError("");
        } catch (e) {
            setDeleteError(formatError(e));
            setConfirmDeleteOpen(true);
        }
    };

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
                    <Typography fontWeight={700}>LOB Defaults</Typography>
                    <Typography variant="body2" color="text.secondary">
                        COO is stored per LOB
                    </Typography>
                </Box>

                <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openAddDialog}>
                    Add LOB
                </Button>
            </Box>

            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                {lobs.map((lob) => {
                    const rowKey = `lob-${lob.Id}`;
                    const errKey = `lob-${lob.Id}-coo`;

                    return (
                        <Paper key={lob.Id} sx={{ p: 1.5, minWidth: 0 }}>
                            <Grid container spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                                <Grid size={{ sm: 12, md: 6, lg: 4 }} sx={{ minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                        <Typography fontWeight={700} noWrap>
                                            {lob.Title}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            aria-label={`Edit ${lob.Title}`}
                                            onClick={() => openEditDialog(lob)}
                                            disabled={savingKey === rowKey || !!savingKey}
                                        >
                                            <EditOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>

                                    <Typography variant="caption" color="text.secondary">
                                        COO
                                    </Typography>
                                </Grid>

                                <Grid size={{ sm: 12, md: 6, lg: 8 }} sx={{ minWidth: 0 }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <MuiPeoplePicker
                                            label=""
                                            context={peoplePickerContext}
                                            value={toPickerValue(lob.coo)}
                                            required={false}
                                            error={!!errors[errKey]}
                                            helperText={errors[errKey]}
                                            selectionLimit={1}
                                            onChange={(items: IPersonaProps[]) => {
                                                const selected = firstOrUndefined(items, 1);

                                                if (selected?.id) clearError(errKey);

                                                run(onChangeCoo(lob.Id, lob.Title, `${lob.Title} COO`, selected));
                                            }}
                                            disabled={savingKey === rowKey || !!savingKey}
                                        />
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    );
                })}
            </Stack>

            <ConfigEditDialog
                open={dialogOpen}
                mode={dialogMode}
                itemLabel="LOB"
                titleLabel="LOB Title"
                personLabel="COO"
                personRequired
                showPersonPicker
                titleValue={lobTitle}
                personValue={
                    lobCoo
                        ? {
                            Id: Number(lobCoo.id),
                            Title: lobCoo.text ?? "",
                            EMail: lobCoo.secondaryText ?? ""
                        }
                        : undefined
                }
                peoplePickerContext={peoplePickerContext}
                saving={!!savingKey}
                error={dialogError}
                onTitleChange={(value) => {
                    setLobTitle(value);
                    if (dialogError) setDialogError("");
                }}
                onPersonChange={(person) => {
                    setLobCoo(person);
                    if (dialogError) setDialogError("");
                }}
                onClose={closeDialog}
                onSave={handleDialogSave}
                showDelete={dialogMode === "edit"}
                onDeleteClick={openDeleteConfirm}
            />

            <ConfirmDeleteDialog
                open={confirmDeleteOpen}
                title="Delete LOB"
                message={`Are you sure you want to delete "${lobTitle}"? This cannot be undone.`}
                confirmLabel="Delete"
                error={deleteError}
                busy={!!savingKey}
                onClose={closeDeleteConfirm}
                onConfirm={handleDelete}
            />

        </Stack>
    );
};
