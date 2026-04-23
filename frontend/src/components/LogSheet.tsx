import type { JSX } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material";
import type { DayLog, DutyStatus, PlanInputs, TripEvent } from "../types";

interface LogSheetProps {
  day: DayLog;
  inputs: PlanInputs;
  totalDays: number;
}

interface RowDef {
  key: DutyStatus;
  label: string;
}

interface Segment {
  x1: number;
  x2: number;
  event: TripEvent;
}

interface RowWithSegments extends RowDef {
  segs: Segment[];
}

interface Transition {
  t: number;
  from: DutyStatus;
  to: DutyStatus;
}

interface RemarkEvent {
  t: number;
  label: string;
  status: DutyStatus;
  time: number;
}

const ROWS: RowDef[] = [
  { key: "off_duty",           label: "1. Off Duty" },
  { key: "sleeper_berth",      label: "2. Sleeper Berth" },
  { key: "driving",            label: "3. Driving" },
  { key: "on_duty_not_driving", label: "4. On Duty (not driving)" },
];

const LEFT       = 150;
const RIGHT_PAD  = 60;
const TOP        = 20;
const ROW_H      = 22;
const WIDTH      = 960;
const REMARKS_H  = 55;
const HEIGHT     = TOP + ROWS.length * ROW_H + REMARKS_H + 140;
const HOUR_W     = (WIDTH - LEFT - RIGHT_PAD) / 24;
const GRID_BOTTOM = TOP + ROWS.length * ROW_H;

function hourX(h: number): number { return LEFT + h * HOUR_W; }
function rowY(i: number):  number { return TOP + i * ROW_H + ROW_H / 2; }

function hourOfDay(iso: string, dateISO: string): number {
  const dt   = new Date(iso);
  const base = new Date(`${dateISO}T00:00:00`);
  return (dt.getTime() - base.getTime()) / (1000 * 60 * 60);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function totalH(events: TripEvent[], status: DutyStatus): number {
  return events
    .filter((e) => e.status === status)
    .reduce((a, b) => a + b.duration_hours, 0);
}

function fmtHM(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function shortLoc(name: string | undefined | null): string {
  if (!name) return "";
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length <= 2) return name;
  if (parts.length <= 3) return `${parts[0]}, ${parts[1]}`;
  return `${parts[0]}, ${parts[parts.length - 3] || parts[parts.length - 2]}`;
}

function remarkLabel(event: TripEvent): string {
  const loc  = shortLoc(event.start_location) || shortLoc(event.end_location);
  const note = event.note || "";
  if (event.status === "on_duty_not_driving") {
    if (/pickup/i.test(note)) return loc ? `Pickup — ${loc}` : "Pickup";
    if (/drop/i.test(note))   return loc ? `Drop-off — ${loc}` : "Drop-off";
    if (/fuel/i.test(note))   return loc ? `Fuel — ${loc}` : "Fuel stop";
    return note || "On duty";
  }
  if (event.status === "off_duty") {
    if (/34/.test(note))       return "34-hr restart";
    if (/30-min/i.test(note))  return "30-min break";
    return "";
  }
  if (event.status === "sleeper_berth") return "10-hr rest";
  if (event.status === "driving")       return loc && loc !== "En route" ? `Depart ${loc}` : "";
  return "";
}

// .log-meta .m — single metadata field (label + underlined value)
function MetaField({
  label,
  children,
  signature = false,
  sx,
}: {
  label: string;
  children: React.ReactNode;
  signature?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={[{ flex: "1 1 0", minWidth: 0 }, sx ?? {}] as SxProps<Theme>}>
      <Box
        component="label"
        sx={{ color: "#444", fontSize: 9, fontStyle: "italic", display: "block", px: "2px" }}
      >
        {label}
      </Box>
      <Box
        sx={{
          pt: "4px", px: "4px", pb: "2px",
          borderBottom: "1px solid #111",
          minHeight: 16,
          fontWeight: 600,
          color: "#111",
          ...(signature && {
            fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive',
            fontSize: 13,
            fontWeight: 500,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

// .totals-footer div + .totals-footer .label
function FooterCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ p: "2px 4px" }}>
      <Box sx={{ color: "#555", fontWeight: 500, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Box>
      {value}
    </Box>
  );
}

export default function LogSheet({ day, inputs, totalDays }: LogSheetProps): JSX.Element {
  const { date, events, total_miles } = day;

  const segments: RowWithSegments[] = ROWS.map((r): RowWithSegments => {
    const row: Segment[] = [];
    events
      .filter((e) => e.status === r.key)
      .forEach((e) => {
        const x1 = clamp(hourOfDay(e.start, date), 0, 24);
        const x2 = clamp(hourOfDay(e.end,   date), 0, 24);
        if (x2 > x1) row.push({ x1, x2, event: e });
      });
    return { ...r, segs: row };
  });

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const transitions: Transition[] = [];
  sortedEvents.forEach((e, i) => {
    const next = sortedEvents[i + 1];
    if (!next || next.status === e.status) return;
    transitions.push({ t: clamp(hourOfDay(next.start, date), 0, 24), from: e.status, to: next.status });
  });

  const remarkEvents: RemarkEvent[] = [];
  sortedEvents.forEach((e, i) => {
    const prev = sortedEvents[i - 1];
    if (prev && prev.status === e.status) return;
    const label = remarkLabel(e);
    if (!label) return;
    const t = clamp(hourOfDay(e.start, date), 0, 24);
    remarkEvents.push({ t, label, status: e.status, time: t });
  });

  remarkEvents.sort((a, b) => a.t - b.t);
  const minGap = 0.35;
  for (let i = 1; i < remarkEvents.length; i++) {
    if (remarkEvents[i].t - remarkEvents[i - 1].t < minGap)
      remarkEvents[i].t = remarkEvents[i - 1].t + minGap;
  }

  const d     = new Date(date + "T00:00:00");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dd    = String(d.getDate()).padStart(2, "0");
  const yyyy  = d.getFullYear();

  const offH = totalH(events, "off_duty");
  const slpH = totalH(events, "sleeper_berth");
  const drvH = totalH(events, "driving");
  const onH  = totalH(events, "on_duty_not_driving");
  const sumH = offH + slpH + drvH + onH;

  return (
    // .log-sheet
    <Box
      sx={{
        bgcolor: "#fff",
        color: "#111",
        pt: "10px",
        px: "12px",
        pb: "8px",
        border: 1,
        borderColor: "border.main",
        borderRadius: 1,
        boxShadow: 1,
        fontFamily: '"Times New Roman", Times, Georgia, serif',
      }}
    >
      {/* .day-chip-row */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: "2px", mb: "4px" }}>
        {/* .day-chip */}
        <Box
          component="span"
          sx={{
            display: "inline-block",
            background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
            color: "#ffffff",
            border: "1px solid #1e40af",
            borderRadius: "999px",
            py: "2px",
            px: "10px",
            fontSize: 10,
            fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: "0.03em",
            boxShadow: "0 1px 3px rgba(30,64,175,0.35)",
          }}
        >
          Day {day.day_number} of {totalDays} · {month}/{dd}/{yyyy}
        </Box>
      </Box>

      {/* .log-meta */}
      <Box sx={{ display: "flex", flexWrap: "nowrap", gap: "10px", fontSize: 11, mb: "6px", overflowX: "auto" }}>
        <MetaField label="(Month) (Day) (Year)">
          {month} &nbsp;/&nbsp; {dd} &nbsp;/&nbsp; {yyyy}
        </MetaField>
        <MetaField label="Total miles driving today">
          {total_miles}
        </MetaField>
        <MetaField label="Vehicle numbers — (show each unit)" sx={{ gridColumn: "span 2" }}>
          {inputs.truck_number || "—"}
        </MetaField>
        <MetaField label="Name of carrier or carriers" sx={{ gridColumn: "span 2" }}>
          {inputs.carrier_name || "—"}
        </MetaField>
        <MetaField label="Driver's signature / certification" signature sx={{ gridColumn: "span 2" }}>
          {inputs.driver_name || ""}
          {" "}
          {/* .cert-note */}
          <Box
            component="span"
            sx={{ ml: 1, fontSize: 9, fontFamily: '"Times New Roman", Times, serif', fontStyle: "italic", color: "#555" }}
          >
            Certified.
          </Box>
        </MetaField>
        <MetaField label="Main office address" sx={{ gridColumn: "span 2" }}>
          {inputs.carrier_address || "—"}
        </MetaField>
        <MetaField label="Name of co-driver" sx={{ gridColumn: "span 2" }}>
          {inputs.co_driver_name || "—"}
        </MetaField>
      </Box>

      {/* .log-svg */}
      <Box
        component="svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        sx={{ border: "1px solid #111", bgcolor: "#fff", display: "block" }}
      >
        {/* Hour gridlines + labels */}
        {Array.from({ length: 25 }).map((_, h) => {
          const x = hourX(h);
          const label =
            h === 0 ? "Midnight" : h === 12 ? "Noon" : h === 24 ? "Midnight" : h;
          return (
            <g key={h}>
              <line x1={x} x2={x} y1={TOP} y2={GRID_BOTTOM}
                stroke={h % 6 === 0 ? "#000" : "#666"}
                strokeWidth={h % 6 === 0 ? 1.2 : 0.6} />
              <text x={x} y={TOP - 6} textAnchor="middle" fontSize="9" fill="#111">
                {label}
              </text>
            </g>
          );
        })}

        {/* Quarter-hour ticks */}
        {Array.from({ length: 24 * 4 + 1 }).map((_, i) => {
          if (i % 4 === 0) return null;
          const x = LEFT + (i / 4) * HOUR_W;
          return ROWS.map((_row, rIdx) => {
            const isHalf = i % 2 === 0;
            return (
              <line key={`q-${i}-${rIdx}`} x1={x} x2={x}
                y1={TOP + rIdx * ROW_H + (isHalf ? 14 : 22)}
                y2={TOP + rIdx * ROW_H + ROW_H - 2}
                stroke="#999" strokeWidth="0.35" />
            );
          });
        })}

        {/* Row separators + labels */}
        {ROWS.map((r, i) => (
          <g key={r.key}>
            <line x1={LEFT} x2={LEFT + 24 * HOUR_W}
              y1={TOP + i * ROW_H} y2={TOP + i * ROW_H}
              stroke="#000" strokeWidth="0.8" />
            <text x={LEFT - 8} y={rowY(i) + 4} textAnchor="end" fontSize="11" fill="#111">
              {r.label}
            </text>
          </g>
        ))}
        <line x1={LEFT} x2={LEFT + 24 * HOUR_W}
          y1={GRID_BOTTOM} y2={GRID_BOTTOM}
          stroke="#000" strokeWidth="1" />

        {/* Duty-status lines */}
        {segments.map((row, rIdx) =>
          row.segs.map((s, j) => (
            <line key={`${row.key}-${j}`}
              x1={hourX(s.x1)} x2={hourX(s.x2)}
              y1={rowY(rIdx)}  y2={rowY(rIdx)}
              stroke="#0b4bd6" strokeWidth="2.6" strokeLinecap="square" />
          )),
        )}

        {/* Vertical transition connectors */}
        {transitions.map((t, i) => {
          const fromIdx = ROWS.findIndex((r) => r.key === t.from);
          const toIdx   = ROWS.findIndex((r) => r.key === t.to);
          if (fromIdx < 0 || toIdx < 0) return null;
          return (
            <line key={`tr-${i}`}
              x1={hourX(t.t)} x2={hourX(t.t)}
              y1={rowY(fromIdx)} y2={rowY(toIdx)}
              stroke="#0b4bd6" strokeWidth="2.2" />
          );
        })}

        {/* Totals column */}
        <text x={WIDTH - RIGHT_PAD + 10} y={TOP - 6} fontSize="10" fill="#111" fontWeight="700">
          Total Hours
        </text>
        {[offH, slpH, drvH, onH].map((t, i) => (
          <g key={i}>
            <line x1={WIDTH - RIGHT_PAD} x2={WIDTH - 6}
              y1={TOP + i * ROW_H + ROW_H} y2={TOP + i * ROW_H + ROW_H}
              stroke="#bbb" strokeWidth="0.5" />
            <text x={WIDTH - RIGHT_PAD + 10} y={rowY(i) + 4}
              fontSize="12" fill="#111" fontWeight="700">
              {fmtHM(t)}
            </text>
          </g>
        ))}
        <text x={WIDTH - RIGHT_PAD + 10} y={GRID_BOTTOM + 16}
          fontSize="11" fill="#111" fontWeight="700">
          = {fmtHM(sumH)}
        </text>

        {/* Remarks section */}
        <text x={LEFT - 8} y={GRID_BOTTOM + 16} textAnchor="end" fontSize="11" fill="#111">
          REMARKS
        </text>
        {Array.from({ length: 25 }).map((_, h) => {
          const x = hourX(h);
          return (
            <line key={`r-${h}`} x1={x} x2={x}
              y1={GRID_BOTTOM + 2} y2={GRID_BOTTOM + 10}
              stroke="#888" strokeWidth="0.4" />
          );
        })}
        {remarkEvents.map((r, i) => {
          const x = hourX(r.t);
          const top = GRID_BOTTOM + 10;
          const bracketH = 14;
          return (
            <g key={`rk-${i}`}>
              <line x1={x} x2={x} y1={top} y2={top + bracketH}
                stroke="#0b4bd6" strokeWidth="1" />
              <line x1={x - 4} x2={x + 4}
                y1={top + bracketH} y2={top + bracketH}
                stroke="#0b4bd6" strokeWidth="1" />
              <text x={x + 4} y={top + bracketH + 6} fontSize="10" fill="#0b1220"
                transform={`rotate(55 ${x + 4} ${top + bracketH + 6})`}>
                {r.label}
              </text>
              <text x={x} y={top + bracketH - 2} fontSize="7" fill="#666" textAnchor="middle">
                {fmtHM(r.time)}
              </text>
            </g>
          );
        })}

        <text x={LEFT} y={HEIGHT - 6} fontSize="10" fill="#111">
          Pro or Shipping No. {inputs.shipping_doc_number || "________________"}
        </text>
      </Box>

      {/* .totals-footer */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          fontSize: 11,
          mt: "4px",
          borderTop: "1px solid #111",
          pt: "4px",
          color: "#111",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <FooterCell label="Off Duty" value={`${offH.toFixed(2)} h`} />
        <FooterCell label="Sleeper"  value={`${slpH.toFixed(2)} h`} />
        <FooterCell label="Driving"  value={`${drvH.toFixed(2)} h`} />
        <FooterCell label="On Duty"  value={`${onH.toFixed(2)} h`} />
        <FooterCell label="Miles"    value={String(total_miles)} />
        <FooterCell label="Σ"        value={`${sumH.toFixed(2)} h`} />
      </Box>
    </Box>
  );
}
