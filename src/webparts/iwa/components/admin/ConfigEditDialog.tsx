import * as React from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { PeoplePickerContext, toPickerValue, firstOrUndefined } from "./ApproversPanel";
import { IPeoplePicker } from "../data/props";

interface ConfigEditDialogProps {
    open: boolean;
    mode: "add" | "edit";
    showDelete?: boolean;

    itemLabel: string;            // "LOB", "Entity", "Operating Group"
    titleLabel: string;           // "LOB Title", "Entity Title"
    personLabel?: string;         // "COO", "GM", "President"
    personRequired?: boolean;
    showPersonPicker?: boolean;

    showAbbrField?: boolean;
    onAbbrChange?: (value: string) => void;
    abbrValue?: string;

    titleValue: string;
    personValue?: IPeoplePicker;
    peoplePickerContext: PeoplePickerContext;

    saving: boolean;
    error: string;

    onTitleChange: (value: string) => void;
    onPersonChange: (person?: IPersonaProps) => void;
    onClose: () => void;
    onSave: () => Promise<void>;
    onDeleteClick?: () => void;
}

export const ConfigEditDialog: React.FC<ConfigEditDialogProps> = ({
    open,
    mode,
    showDelete = false,
    itemLabel,
    titleLabel,
    personLabel,
    personRequired = false,
    showPersonPicker = true,
    showAbbrField = false,
    onAbbrChange,
    abbrValue,
    titleValue,
    personValue,
    peoplePickerContext,
    saving,
    error,
    onTitleChange,
    onPersonChange,
    onClose,
    onSave,
    onDeleteClick
}) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{mode === "add" ? `Add ${itemLabel}` : `Edit ${itemLabel}`}</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    {error && (
                        <Alert severity="error">
                            {error}
                        </Alert>
                    )}

                    <TextField
                        label={titleLabel}
                        value={titleValue}
                        onChange={(e) => onTitleChange(e.target.value)}
                        fullWidth
                        size="small"
                        autoFocus
                    />

                    {showAbbrField && (
                        <TextField
                            label="Abbreviation"
                            value={abbrValue}
                            onChange={(e) => onAbbrChange?.(e.target.value)}
                            fullWidth
                            size="small"
                        />
                    )}

                    {showPersonPicker && (
                        <MuiPeoplePicker
                            label={personLabel ?? ""}
                            context={peoplePickerContext}
                            value={toPickerValue(personValue)}
                            required={personRequired}
                            selectionLimit={1}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);
                                onPersonChange(selected);
                            }}
                        />
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ justifyContent: "space-between" }}>
                <Box>
                    {showDelete && (
                        <Button
                            color="error"
                            variant="outlined"
                            onClick={onDeleteClick}
                            disabled={saving}
                            aria-label={`Delete ${itemLabel}`}
                            title={`Delete ${itemLabel}`}
                        >
                            Delete
                        </Button>
                    )}
                </Box>

                <Stack direction="row" spacing={1}>
                    <Button onClick={onClose} disabled={saving} aria-label={`Cancel ${itemLabel} changes`} title={`Cancel ${itemLabel} changes`}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            onSave().catch((err) => console.error(`${itemLabel} dialog save failed`, err));
                        }}
                        disabled={saving}
                        aria-label={mode === "add" ? `Add ${itemLabel}` : `Save ${itemLabel}`}
                        title={mode === "add" ? `Add ${itemLabel}` : `Save ${itemLabel}`}
                    >
                        {mode === "add" ? "Add" : "Save"}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};
