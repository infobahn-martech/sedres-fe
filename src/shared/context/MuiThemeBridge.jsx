import { useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useThemeStore } from '../store/themeStore';

// Syncs MUI's theme (used by @mui/x-date-pickers) with the app's existing
// data-theme dark mode, so the date/time picker calendar popups render dark
// instead of MUI's hardcoded default light palette.
function MuiThemeBridge({ children }) {
  const isDark = useThemeStore((state) => state.isDark);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: { main: '#00368c' },
          ...(isDark && {
            background: { paper: '#111a28', default: '#0b1220' },
          }),
        },
        typography: { fontFamily: "'Manrope', sans-serif" },
      }),
    [isDark]
  );

  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}

export default MuiThemeBridge;
