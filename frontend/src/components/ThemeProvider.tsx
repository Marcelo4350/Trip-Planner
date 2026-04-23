import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import type { ReactNode } from 'react'

declare module '@mui/material/styles' {
  interface Palette {
    surface: { main: string; subtle: string }
    border: { main: string; soft: string }
    stopColors: {
      current: string
      pickup: string
      dropoff: string
      fuel: string
      rest: string
      break: string
      restart: string
    }
  }
  interface PaletteOptions {
    surface?: { main: string; subtle: string }
    border?: { main: string; soft: string }
    stopColors?: {
      current: string
      pickup: string
      dropoff: string
      fuel: string
      rest: string
      break: string
      restart: string
    }
  }
}

const theme = createTheme({
  palette: {
    background: {
      default: '#f7f7f5',
      paper:   '#ffffff',
    },
    text: {
      primary:   '#1f2328',
      secondary: '#545a63',
      disabled:  '#7a828e',
    },
    primary: {
      main:  '#2a6cc4',
      dark:  '#1f5aa8',
      light: '#eaf1fa',
    },
    secondary: {
      main: '#6b4aa7',
    },
    warning: {
      main: '#b3541e',
    },
    error: {
      main: '#b3261e',
    },
    success: {
      main: '#2f7a46',
    },
    divider: '#e5e5e3',
    surface: {
      main:   '#ffffff',
      subtle: '#fafafa',
    },
    border: {
      main: '#e5e5e3',
      soft: '#efefed',
    },
    stopColors: {
      current: '#2f7a46',
      pickup:  '#a07414',
      dropoff: '#b3261e',
      fuel:    '#c97a13',
      rest:    '#2a6cc4',
      break:   '#6b7280',
      restart: '#6b4aa7',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
  } as any,
})

// Override elevations with the project's custom shadow tokens
theme.shadows[1] = '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)'   // --shadow
theme.shadows[2] = '0 2px 4px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.08)'  // --shadow-lg

export { theme }

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  )
}