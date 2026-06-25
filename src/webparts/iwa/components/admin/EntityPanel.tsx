import * as React from "react";
import { Box, Button, Grid, IconButton, Paper, Stack, Typography } from "@mui/material";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { IEntityItem } from "../data/props";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { PeoplePickerContext } from "./ApproversPanel";
import { toPickerValue, firstOrUndefined, run } from "./ApproversPanel";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatError } from "../common/utils";
import { ConfigEditDialog } from "./ConfigEditDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface EntityDefaultsSectionProps {
    entities: IEntityItem[];
    peoplePickerContext: PeoplePickerContext;
    savingKey: string;
    onChangeGm: (entityId: number, entityTitle: string, label: string, person?: IPersonaProps) => Promise<void>;
    onEditTitle: (entityId: number, abbr: string, currentTitle: string, nextTitle: string) => Promise<void>;
    onCreate: (title: string, abbr: string, gmId?: number) => Promise<void>;
    onDelete: (entityId: number, title: string) => Promise<void>;
    errors: Record<string, string>;
    clearError: (key: string) => void;
}

export const EntityDefaultsSection: React.FC<EntityDefaultsSectionProps> = ({
    entities,
    peoplePickerContext,
    savingKey,
    onChangeGm,
    onEditTitle,
    onCreate,
    onDelete,
    errors,
    clearError
}) => {

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
    const [editingEntityId, setEditingEntityId] = React.useState<number | undefined>(undefined);
    const [entityTitle, setEntityTitle] = React.useState("");
    const [entityAbbr, setEntityAbbr] = React.useState("");
    const [entityGm, setEntityGm] = React.useState<IPersonaProps | undefined>(undefined);
    const [dialogError, setDialogError] = React.useState("");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState("");

    const openAddDialog = (): void => {
        setDialogMode("add");
        setEditingEntityId(undefined);
        setEntityTitle("");
        setEntityAbbr("");
        setEntityGm(undefined);
        setDialogError("");
        setDialogOpen(true);
    };

    const openEditDialog = (entity: IEntityItem): void => {
        setDialogMode("edit");
        setEditingEntityId(entity.Id);
        setEntityTitle(entity.Title ?? "");
        setEntityAbbr(entity.abbr ?? "");
        setEntityGm(
            entity.GM
                ? {
                    id: String(entity.GM.Id),
                    text: entity.GM.Title,
                    secondaryText: entity.GM.EMail
                }
                : undefined
        );
        setDialogError("");
        setDialogOpen(true);
    };

    const closeDialog = (): void => {
        if (!!savingKey) return;

        setDialogOpen(false);
        setEditingEntityId(undefined);
        setEntityTitle("");
        setEntityAbbr("");
        setEntityGm(undefined);
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
        const trimmedTitle = entityTitle.trim();
        const trimmedAbbr = entityAbbr.trim();

        if (!trimmedTitle) {
            setDialogError("Entity title is required.");
            return;
        }

        if (!trimmedAbbr) {
            setDialogError("Entity abbreviation is required.");
            return;
        }

        const duplicate = entities.some(e =>
            e.Title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
            e.Id !== editingEntityId
        );

        const duplicateAbbr = entities.some(e =>
            e.abbr?.trim().toLowerCase() === trimmedAbbr.toLowerCase() &&
            e.Id !== editingEntityId
        );

        if (duplicate) {
            setDialogError("An Entity with that title already exists.");
            return;
        }

        if (duplicateAbbr) {
            setDialogError("An Entity with that abbreviation already exists.");
            return;
        }

        const gmId = entityGm?.id ? Number(entityGm.id) : undefined;
        if (!gmId || Number.isNaN(gmId)) {
            setDialogError("GM is required.");
            return;
        }

        // preserve state in case save fails
        const mode = dialogMode;
        const entityId = editingEntityId;
        const abbr = entityAbbr;
        const title = entityTitle;
        const gm = entityGm;

        // close first so backdrop is top layer
        setDialogOpen(false);
        setDialogError("");

        try {
            if (mode === "add") {
                await onCreate(trimmedTitle, trimmedAbbr, gmId);
            } else if (entityId) {
                const current = entities.find(e => e.Id === entityId);
                await onEditTitle(entityId, trimmedAbbr, current?.Title ?? trimmedTitle, trimmedTitle);
            }

            // clear after success
            setEditingEntityId(undefined);
            setEntityTitle("");
            setEntityAbbr("");
            setEntityGm(undefined);
        } catch (e) {
            // reopen and restore values if save fails
            setDialogMode(mode);
            setEditingEntityId(entityId);
            setEntityTitle(title);
            setEntityAbbr(abbr);
            setEntityGm(gm);
            setDialogError(formatError(e));
            setDialogOpen(true);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!editingEntityId) return;

        const current = entities.find(e => e.Id === editingEntityId);
        if (!current) {
            setDeleteError("Entity not found.");
            return;
        }

        try {
            setConfirmDeleteOpen(false);
            setDialogOpen(false);

            await onDelete(current.Id, current.Title);

            setEditingEntityId(undefined);
            setEntityTitle("");
            setEntityAbbr("");
            setEntityGm(undefined);
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
                    <Typography fontWeight={700}>Entity Defaults</Typography>
                    <Typography variant="body2" color="text.secondary">
                        GM is stored per Entity
                    </Typography>
                </Box>

                <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openAddDialog} aria-label="Add Entity" title="Add Entity">
                    Add Entity
                </Button>
            </Box>

            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                {entities.map((ent) => {
                    const rowKey = `entity-${ent.Id}`;
                    const errKey = `entity-${ent.Id}-gm`;

                    return (
                        <Paper key={ent.Id} sx={{ p: 1.5, minWidth: 0}}>
                            <Grid container spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                                <Grid size={{ sm: 12, md: 6, lg: 4 }} sx={{ minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                        <Typography fontWeight={700} noWrap>
                                            {ent.combinedTitle || ent.Title}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            aria-label={`Edit ${ent.Title}`}
                                            title={`Edit ${ent.Title}`}
                                            onClick={() => openEditDialog(ent)}
                                            disabled={savingKey === rowKey || !!savingKey}
                                        >
                                            <EditOutlinedIcon fontSize="small" />
                                        </IconButton>

                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                        {ent.abbr}
                                    </Typography>
                                </Grid>

                                <Grid size={{ sm: 12, md: 6, lg: 8 }} sx={{ minWidth: 0 }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <MuiPeoplePicker
                                            label=""
                                            context={peoplePickerContext}
                                            value={toPickerValue(ent.GM)}
                                            selectionLimit={1}
                                            error={!!errors[errKey]}
                                            helperText={errors[errKey]}
                                            onChange={(items: IPersonaProps[]) => {
                                                const selected = firstOrUndefined(items, 1);
                                                if (selected?.id) clearError(errKey);
                                                run(onChangeGm(ent.Id, ent.Title, `${ent.Title} GM`, selected));
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
                itemLabel="Entity"
                titleLabel="Entity Title"
                personLabel="GM"
                personRequired
                showPersonPicker
                showAbbrField
                abbrValue={entityAbbr}
                titleValue={entityTitle}
                personValue={
                    entityGm
                        ? {
                            Id: Number(entityGm.id),
                            Title: entityGm.text ?? "",
                            EMail: entityGm.secondaryText ?? ""
                        }
                        : undefined
                }
                peoplePickerContext={peoplePickerContext}
                saving={!!savingKey}
                error={dialogError}
                onTitleChange={(value) => {
                    setEntityTitle(value);
                    if (dialogError) setDialogError("");
                }}
                onAbbrChange={(value) => {
                    setEntityAbbr(value);
                    if (dialogError) setDialogError("");
                }}
                onPersonChange={(person) => {
                    setEntityGm(person);
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
                message={`Are you sure you want to delete "${entityTitle}"? This cannot be undone.`}
                confirmLabel="Delete"
                error={deleteError}
                busy={!!savingKey}
                onClose={closeDeleteConfirm}
                onConfirm={handleDelete}
            />

        </Stack>
    );
};
