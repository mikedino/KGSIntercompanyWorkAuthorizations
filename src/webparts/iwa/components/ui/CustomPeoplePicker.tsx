import * as React from "react";
import { IPersonaProps } from "@fluentui/react";
import { SxProps, Theme } from "@mui/material";
import { FormControl, FormHelperText, FormLabel, useTheme } from "@mui/material";
import { PeoplePicker, PrincipalType, IPeoplePickerContext } from "@pnp/spfx-controls-react/lib/PeoplePicker";
import { fontSizeDefault, minInputHeight } from "../styles/theme.base";

export interface MuiPeoplePickerProps {
  label: string;
  context: IPeoplePickerContext;
  value?: string[];
  required?: boolean;
  disabled?: boolean;
  onChange: (items: IPersonaProps[]) => void;
  selectionLimit?: number;
  sx?: SxProps<Theme>;
  showtooltip?: boolean;
  tooltipMessage?: string;
  error?: boolean;
  helperText?: string;
}

export const MuiPeoplePicker: React.FC<MuiPeoplePickerProps> = ({
  label,
  context,
  value,
  required = false,
  disabled = false,
  onChange,
  selectionLimit = 1,
  sx,
  showtooltip = false,
  tooltipMessage,
  error = false,
  helperText
}) => {
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);

  const borderColor = error
    ? theme.palette.error.main
    : focused
      ? theme.palette.info.main
      : theme.palette.secondary.light;

  const borderThickness = focused || error ? '2px' : '1px';

  return (
    <FormControl
      fullWidth
      required={required}
      disabled={disabled}
      error={error}
      sx={{ position: "relative", m: 0, p: 0, minWidth: 0, ...sx }}
    >
      <FormLabel
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translate(14px, -9px) scale(0.75)",
          transformOrigin: "top left",
          color: focused ? theme.palette.info.main : theme.palette.text.secondary,
          fontWeight: 400,
          fontSize: fontSizeDefault,
          backgroundColor: theme.palette.background.paper,
          lineHeight: "1.4375em",
          px: "4px",
          zIndex: 1,
          pointerEvents: "none",
          maxWidth: "calc(133% - 32px)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {label}
      </FormLabel>

      {/* wrapper div lets us control focus + border */}
      <div
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
        style={{
          border: `${borderThickness} solid ${borderColor}`,
          borderRadius: theme.shape.borderRadius,          
          padding: "5px 10px",
          minHeight: minInputHeight,
          maxHeight: minInputHeight,
          boxSizing: "border-box",
          width: "100%",
          minWidth: 0
        }}
      >
        <PeoplePicker
          context={context}
          personSelectionLimit={selectionLimit}
          principalTypes={[PrincipalType.User]}
          ensureUser
          showtooltip={showtooltip}
          tooltipMessage={tooltipMessage}
          disabled={disabled}
          defaultSelectedUsers={value}
          resolveDelay={1000}
          onChange={onChange}
          styles={{
            root: {
              width: "100%",
              minWidth: 0,
              selectors: {
                ".ms-BasePicker-text": {
                  border: "none",
                  minHeight: "unset",
                  background: "transparent"
                },
                ".ms-PickerPersona-container": {
                  background: theme.palette.background.paper,
                  color: theme.palette.text.primary
                },
                ".ms-Persona-primaryText": { color: theme.palette.text.primary },
                ".ms-BasePicker-input": { 
                  color: theme.palette.text.primary,
                  border: "0 !important",
                  fontSize: fontSizeDefault,
                  height: minInputHeight - 10
                },
                "input::placeholder": {
                  color: theme.palette.text.secondary,
                  opacity: 1
                }
              }
            }
          }}
        />
      </div>

      {!!helperText && (
        <FormHelperText sx={{ mt: 0.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};
