import * as React from "react";
import { DatePicker } from "@mui/x-date-pickers";
import { Dayjs } from "dayjs";
import { fontSizeDefault, minInputHeight } from "../styles/theme.base";

export const CompactDateField = ({
    label,
    value,
    onChange,
    error,
    helperText,
    maxWidth
}: {
    label: string;
    value: Dayjs | undefined;
    onChange: (value: Dayjs | undefined) => void;
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
                    error,
                    helperText,
                    size: "small",
                    sx: {
                        "& .MuiPickersOutlinedInput-root": {
                            minHeight: minInputHeight,
                            fontSize: fontSizeDefault
                        },
                        "& .MuiInputBase-input": {
                            fontSize: fontSizeDefault
                        },
                        "& .MuiInputLabel-root": {
                            fontSize: fontSizeDefault
                        },
                        maxWidth
                    }
                }
            }}
        />
    );
};
