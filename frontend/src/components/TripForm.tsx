import { useState } from "react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material";
import type { TripFormValues, TripPlanRequest } from "../types";

interface TripFormProps {
  onSubmit: (payload: TripPlanRequest) => void;
  loading: boolean;
}

interface PresetValues {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number;
}

interface Preset {
  label: string;
  v: PresetValues;
}

type FormField = keyof TripFormValues;

const initial: TripFormValues = {
  current_location: "",
  pickup_location: "",
  dropoff_location: "",
  current_cycle_used_hours: 0,
  start_time: "",
  driver_name: "",
  co_driver_name: "",
  carrier_name: "",
  carrier_address: "",
  truck_number: "",
  shipping_doc_number: "",
};

const PRESETS: Preset[] = [
  {
    label: "Chicago → Dallas → Miami",
    v: {
      current_location: "Chicago, IL",
      pickup_location: "Dallas, TX",
      dropoff_location: "Miami, FL",
      current_cycle_used_hours: 10,
    },
  },
];

// Shared input style — mirrors .form input from styles.css
const inputSx: SxProps<Theme> = {
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "border.main",
  borderRadius: "6px",
  py: "8px",
  px: "10px",
  fontSize: "13.5px",
  color: "text.primary",
  outline: "none",
  width: "100%",
  font: "inherit",
  transition: "border-color 0.12s, box-shadow 0.12s",
  "&::placeholder": { color: "text.disabled" },
  "&:hover":  { borderColor: "#d4d4d2" },
  "&:focus":  { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(42,108,196,0.15)" },
};

// .form .section-hdr
function SectionHeader({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 600,
        color: "text.disabled",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        mt: first ? 0 : "14px",
        mb: "8px",
        pb: "6px",
        borderBottom: "1px solid",
        borderColor: "border.soft",
      }}
    >
      {children}
    </Typography>
  );
}

// .form .field + label + input
function Field({ label, ...inputProps }: { label: string } & React.ComponentPropsWithoutRef<"input">) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", mb: "10px" }}>
      <Box component="label" sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary", mb: "4px" }}>
        {label}
      </Box>
      <Box component="input" sx={inputSx} {...(inputProps as object)} />
    </Box>
  );
}

export default function TripForm({ onSubmit, loading }: TripFormProps): JSX.Element {
  const [form, setForm] = useState<TripFormValues>(initial);

  function set<K extends FormField>(field: K, value: TripFormValues[K]): void {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function applyPreset(p: PresetValues): void {
    setForm((f) => ({ ...f, ...p }));
  }

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const cycle = Number(form.current_cycle_used_hours) || 0;
    const payload: TripPlanRequest = {
      current_location:        form.current_location,
      pickup_location:         form.pickup_location,
      dropoff_location:        form.dropoff_location,
      current_cycle_used_hours: cycle,
      driver_name:             form.driver_name,
      co_driver_name:          form.co_driver_name,
      carrier_name:            form.carrier_name,
      carrier_address:         form.carrier_address,
      truck_number:            form.truck_number,
      shipping_doc_number:     form.shipping_doc_number,
    };
    if (form.start_time) payload.start_time = form.start_time;
    onSubmit(payload);
  }

  const onText = (field: FormField) => (e: ChangeEvent<HTMLInputElement>) =>
    set(field, e.target.value);

  return (
    <Box component="form" onSubmit={submit}>

      {/* .preset-row */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mt: "2px", mb: "14px" }}>
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.v)}
            sx={{
              fontSize: 12,
              py: "5px",
              px: "10px",
              border: "1px solid",
              borderColor: "border.main",
              bgcolor: "background.paper",
              borderRadius: "999px",
              color: "text.secondary",
              minWidth: 0,
              textTransform: "none",
              fontWeight: 400,
              lineHeight: "inherit",
              "&:hover": { bgcolor: "primary.light", borderColor: "#c6dbf2", color: "primary.main" },
            }}
          >
            {p.label}
          </Button>
        ))}
      </Box>

      <SectionHeader first>Route</SectionHeader>
      <Field label="Current location" placeholder="e.g. Chicago, IL" value={form.current_location} onChange={onText("current_location")} required />
      <Field label="Pickup location"  placeholder="e.g. Dallas, TX"  value={form.pickup_location}  onChange={onText("pickup_location")}  required />
      <Field label="Drop-off location" placeholder="e.g. Miami, FL"  value={form.dropoff_location} onChange={onText("dropoff_location")} required />

      <SectionHeader>Schedule</SectionHeader>
      {/* .form .row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Field label="Cycle used (hrs, 70/8)" type="number" min="0" max="70" step="0.25" value={form.current_cycle_used_hours} onChange={onText("current_cycle_used_hours")} required />
        <Field label="Start time" type="datetime-local" value={form.start_time} onChange={onText("start_time")} />
      </Box>

      <SectionHeader>Driver &amp; vehicle (optional)</SectionHeader>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Field label="Driver name"    placeholder="—" value={form.driver_name}   onChange={onText("driver_name")} />
        <Field label="Truck / tractor #" placeholder="—" value={form.truck_number} onChange={onText("truck_number")} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Field label="Co-driver name"    placeholder="—" value={form.co_driver_name}      onChange={onText("co_driver_name")} />
        <Field label="Pro / shipping doc #" placeholder="—" value={form.shipping_doc_number} onChange={onText("shipping_doc_number")} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Field label="Carrier name"        placeholder="—" value={form.carrier_name}    onChange={onText("carrier_name")} />
        <Field label="Main office address" placeholder="—" value={form.carrier_address} onChange={onText("carrier_address")} />
      </Box>

      {/* .btn.btn-primary */}
      <Button
        type="submit"
        disabled={loading}
        fullWidth
        variant="contained"
        sx={{
          mt: 1,
          py: "10px",
          px: "14px",
          fontWeight: 600,
          textTransform: "none",
          fontSize: 13,
          bgcolor: "primary.main",
          "&:hover":    { bgcolor: "primary.dark" },
          "&:disabled": { bgcolor: "#9bb7dd", color: "#fff" },
        }}
      >
        {loading ? "Planning…" : "Plan trip"}
      </Button>

    </Box>
  );
}
