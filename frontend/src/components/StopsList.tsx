import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import type { DutyStatus, Stop, StopKind, TripEvent } from "../types";

interface StopsListProps {
  stops: Stop[];
  events: TripEvent[];
}

const LABELS: Record<DutyStatus, string> = {
  driving:             "Driving",
  on_duty_not_driving: "On Duty",
  sleeper_berth:       "Sleeper",
  off_duty:            "Off Duty",
};

const STOP_KIND_LABEL: Record<StopKind, string> = {
  pickup:      "Pickup",
  dropoff:     "Drop-off",
  fuel:        "Fuel (15 min)",
  rest_10h:    "10-hr rest",
  restart_34h: "34-hr restart",
  break_30m:   "30-min break",
  off_duty:    "Off duty",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortLoc(name: string | undefined | null): string {
  if (!name) return "";
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length <= 3) return name;
  return `${parts[0]}, ${parts[parts.length - 3] || parts[parts.length - 2]}`;
}

// .chip, coloured dot + label. Dot colour mirrors the .chip.<status>::before rules.
function StopChip({ status, label }: { status: DutyStatus; label: string }) {
  const { palette } = useTheme();

  const dotColor: Record<DutyStatus, string> = {
    driving:             palette.stopColors.current,
    on_duty_not_driving: palette.stopColors.pickup,
    sleeper_berth:       palette.stopColors.rest,
    off_duty:            palette.stopColors.break,
  };

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: 12,
        fontWeight: 500,
        color: "text.secondary",
        mr: 1,
      }}
    >
      {/* replaces .chip::before */}
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: dotColor[status] ?? palette.text.disabled,
          flexShrink: 0,
        }}
      />
      {label}
    </Box>
  );
}

// .stop row — shared grid layout
function StopRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: "12px",
        py: 1,
        borderBottom: "1px solid",
        borderColor: "border.soft",
        fontSize: 13,
        alignItems: "baseline",
        "&:last-child": { borderBottom: "none" },
      }}
    >
      {children}
    </Box>
  );
}

export default function StopsList({ stops, events }: StopsListProps): JSX.Element {
  const numbered = stops && stops.length ? stops : null;

  return (
    // .stops-list
    <Box sx={{ mt: "14px", pt: "10px", borderTop: "1px solid", borderColor: "border.soft", maxHeight: 380, overflowY: "auto" }}>

      {/* .stops-list h3 */}
      <Typography
        component="h3"
        sx={{ fontSize: 11, fontWeight: 600, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", m: 0, mb: 1 }}
      >
        Stops &amp; rests
      </Typography>

      {numbered ? (
        numbered.map((s) => (
          <StopRow key={s.number}>
            {/* .stop .time */}
            <Box sx={{ color: "text.disabled", display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
              {/* .num-badge */}
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 22,
                  height: 20,
                  px: "6px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "text.primary",
                  bgcolor: "surface.subtle",
                  border: 1,
                  borderColor: "border.main",
                  borderRadius: "999px",
                }}
              >
                #{s.number}
              </Box>
              {fmtTime(s.start)}
            </Box>

            <Box>
              <StopChip status={s.status} label={STOP_KIND_LABEL[s.kind] || LABELS[s.status]} />
              <span>
                {Number(s.duration_hours).toFixed(2)}h
                {s.location && s.location !== "En route" ? ` · ${shortLoc(s.location)}` : ""}
              </span>
            </Box>
          </StopRow>
        ))
      ) : (
        (events || [])
          .filter((e) => e.duration_hours > 0)
          .map((e, i) => (
            <StopRow key={i}>
              <Box sx={{ color: "text.disabled", display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                {fmtTime(e.start)}
              </Box>
              <Box>
                <StopChip status={e.status} label={LABELS[e.status]} />
                <span>
                  {e.duration_hours}h
                  {e.miles ? ` · ${e.miles} mi` : ""}
                  {e.note  ? ` · ${e.note}`    : ""}
                </span>
              </Box>
            </StopRow>
          ))
      )}
    </Box>
  );
}
