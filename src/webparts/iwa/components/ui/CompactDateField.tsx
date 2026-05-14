import * as React from "react";
import { DatePicker } from "@mui/x-date-pickers";
import { Dayjs } from "dayjs";
import { minInputHeight, fontSizeDefault } from "../styles/theme.base";

export const CompactDateField = ({
    label,
    value,
    onChange,
    required,
    error,
    helperText,
    maxWidth
}: {
    label: string;
    value: Dayjs | undefined;
    onChange: (value: Dayjs | undefined) => void;
    required?: boolean;
    error: boolean;
    helperText?: string;
    maxWidth?: number;
}): JSX.Element => {
    return (
        <DatePicker
            label={label}
            value={value ?? null}
            onChange={(nextValue) => {
                onChange(nextValue ?? undefined);
            }}
            slotProps={{
                textField: {
                    fullWidth: true,
                    required,
                    error,
                    helperText,
                    size: "small",
                    sx: {
                        maxWidth,
                        "& .MuiPickersOutlinedInput-root": (theme) => ({
                            minHeight: minInputHeight,
                            fontSize: fontSizeDefault,
                            "& .MuiPickersOutlinedInput-notchedOutline": {
                                borderColor: theme.palette.secondary.light,
                            },
                            "&:hover .MuiPickersOutlinedInput-notchedOutline": {
                                borderColor: theme.palette.action.hover,
                            },
                            "&.Mui-focused .MuiPickersOutlinedInput-notchedOutline": {
                                borderColor: `${theme.palette.info.main} !important`,
                                borderWidth: 2,
                            },
                            "&.Mui-focused:not(.Mui-error) .MuiPickersOutlinedInput-notchedOutline": {
                                borderColor: theme.palette.info.main,
                                borderWidth: 2,
                            }
                        }),
                        "& .MuiInputBase-input": (theme) => ({
                            fontSize: fontSizeDefault
                        }),
                        "& .MuiInputLabel-root": (theme) => ({
                            fontSize: fontSizeDefault
                        }),
                        "& .MuiInputAdornment-root .MuiIconButton-root": (theme) => ({
                            color: theme.palette.action.active,
                        }),
                        "& .MuiInputAdornment-root .MuiIconButton-root:hover": (theme) => ({
                            color: theme.palette.action.active,
                        }),
                        "& .MuiInputAdornment-root .MuiSvgIcon-root": (theme) => ({
                            color: theme.palette.action.active,
                        }),
                        "& .MuiPickersOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiIconButton-root": (theme) => ({
                            color: theme.palette.info.main,
                        }),
                        "& .MuiPickersOutlinedInput-root.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root": (theme) => ({
                            color: theme.palette.info.main,
                        }),
                    }
                }
            }}
        />
    );
};
