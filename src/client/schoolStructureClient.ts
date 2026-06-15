import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();

export type SchoolSection = "NURSERY" | "PRIMARY" | "SECONDARY";

export type AvailableSection = {
  code: SchoolSection;
  label: string;
};

export type StreamRecord = {
  id: string;
  name: string;
  code: string;
};

export type CanonicalClassRecord = {
  id: string;
  name: string;
  code: string;
  level: number;
  section: SchoolSection;
  streams: StreamRecord[];
};

export type SchoolStructureData = {
  success: true;
  school: { id: string; code: string; name: string };
  selectedSections: SchoolSection[];
  availableSections: AvailableSection[];
  canonicalClasses: CanonicalClassRecord[];
  streamsByClass: Record<string, StreamRecord[]>;
  lockWarnings: Partial<Record<SchoolSection, string>>;
};

async function handleResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  const body: Record<string, unknown> = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : fallback;
    throw new Error(message);
  }
  return body as T;
}

export async function fetchSchoolStructure(schoolCode = "SCU-PREVIEW"): Promise<SchoolStructureData> {
  const res = await fetch(
    `${API_BASE}/api/settings/school-structure?schoolCode=${encodeURIComponent(schoolCode)}`,
  );
  return handleResponse<SchoolStructureData>(res, "Could not load school structure.");
}

export async function updateSchoolStructure(payload: {
  schoolCode?: string;
  selectedSections: SchoolSection[];
}): Promise<SchoolStructureData> {
  const res = await fetch(`${API_BASE}/api/settings/school-structure`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<SchoolStructureData>(res, "Could not update school structure.");
}

export async function createSchoolStream(payload: {
  schoolCode?: string;
  classId: string;
  name: string;
  code: string;
}): Promise<{ success: true; stream: StreamRecord; message: string }> {
  const res = await fetch(`${API_BASE}/api/settings/school-structure/streams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: true; stream: StreamRecord; message: string }>(
    res,
    "Could not create stream.",
  );
}

export async function deleteSchoolStream(
  streamId: string,
  schoolCode = "SCU-PREVIEW",
): Promise<{ success: true; message: string }> {
  const res = await fetch(
    `${API_BASE}/api/settings/school-structure/streams/${encodeURIComponent(streamId)}?schoolCode=${encodeURIComponent(schoolCode)}`,
    { method: "DELETE" },
  );
  return handleResponse<{ success: true; message: string }>(res, "Could not delete stream.");
}
