import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material";
import type { Plan, PlanSummary } from "../types";

interface TripSummaryProps {
  plan: Plan;
}

function fmtHours(h: number | null | undefined): string {
  if (h == null) return "—";
  return `${Number(h).toFixed(1)} h`;
}

function fmtDate(iso: string): string {
  try {
    const d: Date = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const statSx: SxProps<Theme> = {
  border: 1,
  borderColor: "border.main",
  borderRadius: "6px",
  p: "10px 12px",
  bgcolor: "background.paper",
};

function TripStat({ label, value, sx }: { label: string; value: string; sx?: SxProps<Theme> }) {
  return (
    <Box sx={[statSx, sx ?? {}] as SxProps<Theme>}>
      <Typography sx={{ fontSize: 11, color: "text.disabled", fontWeight: 500, mb: "2px" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function TripSummary({ plan }: TripSummaryProps): JSX.Element {
  const s: PlanSummary = plan.summary;
  const startCycle: number = plan.inputs?.current_cycle_used_hours ?? 0;
  const finalCycle: number = s.final_cycle_used_hours ?? 0;
  const addedCycle: number = Math.max(0, finalCycle - startCycle);
  const pct: number = Math.min(100, (finalCycle / 70) * 100);
  const pctStart: number = Math.min(100, (startCycle / 70) * 100);
  const remaining: number = Math.max(0, 70 - finalCycle);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
      <TripStat label="Total distance" value={`${s.total_distance_miles} mi`} />
      <TripStat label="Driving time" value={fmtHours(s.total_driving_hours)} />
      <TripStat label="On-duty time" value={fmtHours(s.total_on_duty_hours)} />
      <TripStat label="Elapsed" value={fmtHours(s.elapsed_hours)} />
      <TripStat label="Trip days" value={String(s.num_days)} />
      <TripStat label="Remaining cycle" value={fmtHours(remaining)} />

      {/* 70-hour / 8-day cycle bar */}
      <Box sx={[statSx, { gridColumn: "span 2" }] as SxProps<Theme>}>
        <Typography sx={{ fontSize: 11, color: "text.disabled", fontWeight: 500, mb: "2px" }}>
          70-hour / 8-day cycle
        </Typography>

        <Box
          title={`${finalCycle.toFixed(2)} / 70 hours used`}
          sx={{
            position: "relative",
            height: 10,
            bgcolor: "surface.subtle",
            border: 1,
            borderColor: "border.main",
            borderRadius: "999px",
            mt: "10px",
            mb: "6px",
            overflow: "hidden",
          }}
        >
          <Box sx={{ position: "absolute", inset: 0, height: "100%", bgcolor: "#c6dbf2", width: `${pctStart}%` }} />
          <Box sx={{ position: "absolute", top: 0, bottom: 0, bgcolor: "primary.main", left: `${pctStart}%`, width: `${pct - pctStart}%` }} />
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "text.disabled", mt: "2px", fontVariantNumeric: "tabular-nums" }}>
          <span>0 h</span>
          <span>35 h</span>
          <span>70 h</span>
        </Box>

        <Box sx={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: 11.5, color: "text.secondary", mt: "4px" }}>
          <span>
            <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "2px", verticalAlign: "-1px", mr: "6px", bgcolor: "#c6dbf2" }} />
            Before: {fmtHours(startCycle)}
          </span>
          <span>
            <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: "2px", verticalAlign: "-1px", mr: "6px", bgcolor: "primary.main" }} />
            This trip: {fmtHours(addedCycle)}
          </span>
          <span>Total: {fmtHours(finalCycle)} / 70 h</span>
        </Box>
      </Box>

      <TripStat sx={{ gridColumn: "span 2" }} label="Window" value={`${fmtDate(s.trip_start)} → ${fmtDate(s.trip_end)}`} />
    </Box>
  );
}
