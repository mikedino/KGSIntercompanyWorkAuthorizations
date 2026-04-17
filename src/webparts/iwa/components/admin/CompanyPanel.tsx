import * as React from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { MuiPeoplePicker } from "../ui/CustomPeoplePicker";
import { IConfigItem } from "../data/props";
import { IPersonaProps } from "@fluentui/react/lib/Persona";
import { PeoplePickerContext } from "./ApproversPanel";
import { toPickerValue, firstOrUndefined, run, ConfigKey } from "./ApproversPanel";

interface CompanyDefaultsSectionProps {
    hr?: IConfigItem;
    cfo?: IConfigItem;
    peoplePickerContext: PeoplePickerContext;
    savingKey: ConfigKey | string;
    onChangeHr: (person?: IPersonaProps) => Promise<void>;
    onChangeCfo: (person?: IPersonaProps) => Promise<void>;
    errors: Record<string, string>;
    clearError: (key: ConfigKey) => void;
}

export const CompanyDefaultsSection: React.FC<CompanyDefaultsSectionProps> = ({
    hr,
    cfo,
    peoplePickerContext,
    savingKey,
    onChangeHr,
    onChangeCfo,
    errors,
    clearError
}) => {
    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Typography fontWeight={700}>Company Defaults (Config)</Typography>

            <Grid container spacing={2} sx={{ minWidth: 0 }}>
                <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        HR
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                        <MuiPeoplePicker
                            label=""
                            context={peoplePickerContext}
                            value={toPickerValue(hr?.User)}
                            selectionLimit={1}
                            error={!!errors["config-hr"]}
                            helperText={errors["config-hr"]}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);

                                // clear red state immediately when user picks someone
                                if (selected?.id) clearError("config-hr");

                                run(onChangeHr(selected));
                            }}
                            disabled={savingKey === "config-hr" || !!savingKey}
                        />
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        CFO
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                        <MuiPeoplePicker
                            label=""
                            context={peoplePickerContext}
                            value={toPickerValue(cfo?.User)}
                            selectionLimit={1}
                            error={!!errors["config-cfo"]}
                            helperText={errors["config-cfo"]}
                            onChange={(items: IPersonaProps[]) => {
                                const selected = firstOrUndefined(items, 1);

                                // clear red state immediately when user picks someone
                                if (selected?.id) clearError("config-cfo");

                                run(onChangeCfo(selected));
                            }}
                            disabled={savingKey === "config-cfo" || !!savingKey}
                        />
                    </Box>
                </Grid>
            </Grid>
        </Stack>
    );
};
