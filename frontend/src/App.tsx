import { useState } from "react";
import type { JSX } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import TripForm from "./components/TripForm";
import MapView from "./components/MapView";
import TripSummary from "./components/TripSummary";
import StopsList from "./components/StopsList";
import LogSheet from "./components/LogSheet";
import { planTrip } from "./api";
import type { DayLog, Plan, TripPlanRequest } from "./types";
import AppHeader from "./components/AppHeader";

const panelSx = {
  bgcolor: "background.paper",
  border: 1,
  borderColor: "border.main",
  borderRadius: 1,
  pt: "18px",
  px: "18px",
  pb: "16px",
} as const;

function AppAside({plan, loading, error, handlePlan}: {
  plan: Plan | null;
  loading: boolean;
  error: string;
  handlePlan: (form: TripPlanRequest) => Promise<void>;
}): JSX.Element {
  return (
    <Box component="aside" sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Paper elevation={1} sx={panelSx}>
        <TripForm onSubmit={handlePlan} loading={loading} />
        {error && <Box sx={{ 
          background: '#fdecea', 
          color: 'error.main', 
          border: '1px solid #f5bfbb', 
          borderRadius: 'var(--radius-sm)', 
          fontSize: 13, 
          marginTop: 10,
          padding: '10px 12px',
          }}>
            {error} 
          </Box>}
      </Paper>

      {plan && (
        <Paper elevation={1} sx={panelSx}>
          <Typography
            component="h2"
            sx={{ m: 0, fontSize: 14, fontWeight: 600, color: "text.primary", letterSpacing: 0 }}
          >
            Summary
          </Typography>
          <Typography
            sx={{ mt: 0.5, mb: 1.75, fontSize: 12.5, color: "text.disabled" }}
          >
            Calculated from 49 CFR Part 395 (Hours of Service).
          </Typography>
          <TripSummary plan={plan} />
          <StopsList stops={plan.stops} events={plan.events} />
        </Paper>
      )}
    </Box>
  )
}

function MapPanel({ plan }: { plan: Plan | null }): JSX.Element {
  const { palette } = useTheme();

  const legendItems = [
    { color: palette.stopColors.current, label: "Current" },
    { color: palette.stopColors.pickup,  label: "Pickup" },
    { color: palette.stopColors.dropoff, label: "Drop-off" },
    { color: palette.stopColors.fuel,    label: "Fuel" },
    { color: palette.stopColors.rest,    label: "10-hr rest" },
    { color: palette.stopColors.break,   label: "30-min break" },
    { color: palette.stopColors.restart, label: "34-hr restart" },
  ];

  return (
    <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Paper
        elevation={1}
        sx={{
          bgcolor: "background.paper",
          border: 1,
          borderColor: "border.main",
          borderRadius: 1,
          p: 0,
          height: 560,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <MapView plan={plan} />
        <Paper
          elevation={1}
          sx={{
            position: "absolute",
            bottom: 14,
            left: 14,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "border.main",
            borderRadius: "6px",
            py: "8px",
            px: "10px",
            fontSize: 12,
            color: "text.secondary",
            zIndex: 500,
          }}
        >
          {legendItems.map(({ color, label }) => (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1, my: "2px" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.15)", bgcolor: color, flexShrink: 0 }} />
              {label}
            </Box>
          ))}
        </Paper>
      </Paper>

      {plan ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            {plan.days.map((d: DayLog) => (
              <LogSheet
                key={d.day_number}
                day={d}
                inputs={plan.inputs}
                totalDays={plan.days.length}
              />
            ))}
          </Box>
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            border: "1px dashed",
            borderColor: "border.main",
            borderRadius: 1,
            py: "44px",
            px: 3,
            textAlign: "center",
            color: "text.disabled",
            boxShadow: "none",
          }}
        >
          <Typography
            component="h3"
            sx={{ m: 0, mb: 0.75, fontSize: 15, fontWeight: 600, color: "text.primary" }}
          >
            No trip planned yet
          </Typography>
          <Typography
            component="p"
            sx={{ m: 0, maxWidth: 420, mx: "auto", fontSize: 13 }}
          >
            Fill in the form on the left to see the route, required rest
            and fuel stops, and auto-drawn daily log sheets.
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default function App(): JSX.Element {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handlePlan(form: TripPlanRequest): Promise<void> {
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const data: Plan = await planTrip(form);
      setPlan(data);
    } catch (e: unknown) {
      const message: string =
        e instanceof Error ? e.message : "Failed to plan trip";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader plan={plan} />
      <Box
        component="main"
        sx={{
          maxWidth: 1580,
          mx: "auto",
          pt: { xs: 2, md: 2.5 },
          px: { xs: 2, md: 3 },
          pb: { xs: 2, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
          gap: 2.5,
        }}
      >
        <AppAside plan={plan} loading={loading} error={error} handlePlan={handlePlan} />
        <MapPanel plan={plan} />
      </Box>
    </>
  );
}
