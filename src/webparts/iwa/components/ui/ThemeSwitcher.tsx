import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

export interface IThemeSwitcherProps {
    useDarkTheme: boolean;
    onToggle: () => void;
}

export const ThemeSwitcher: React.FC<IThemeSwitcherProps> = ({ useDarkTheme, onToggle }): JSX.Element => {
    const label = useDarkTheme ? "Switch to Light mode" : "Switch to Dark mode";

    return (
        <Tooltip title={label}>
            <IconButton onClick={onToggle} size="small" aria-label={label}>
                {useDarkTheme ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
        </Tooltip>
    );
};
