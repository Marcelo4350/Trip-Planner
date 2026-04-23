import type {
  ApiError,
  GeocodedLocation,
  Plan,
  TripPlanRequest,
} from "./types";

const API_BASE: string =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";

async function postJSON<TRequest extends object, TResponse>(
  path: string,
  body: TRequest,
): Promise<TResponse> {
  const res: Response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text: string = await res.text();
  let data: TResponse | ApiError;
  try {
    data = (text ? JSON.parse(text) : {}) as TResponse | ApiError;
  } catch {
    data = { error: text } as ApiError;
  }
  if (!res.ok) {
    const err: ApiError = data as ApiError;
    throw new Error(
      err.error || err.detail || `Request failed (${res.status})`,
    );
  }
  return data as TResponse;
}

export function planTrip(payload: TripPlanRequest): Promise<Plan> {
  return postJSON<TripPlanRequest, Plan>("/api/plan-trip/", payload);
}

export function geocode(query: string): Promise<GeocodedLocation> {
  return postJSON<{ query: string }, GeocodedLocation>("/api/geocode/", {
    query,
  });
}
