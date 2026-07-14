type AttendanceCapableReader = {
  mode?: string | null;
  locationType?: string | null;
  attendanceMode?: string | null;
  isActive?: boolean | null;
  status?: string | null;
  onlineStatus?: string | null;
  lastSeenAt?: string | Date | null;
  lastHeartbeatAt?: string | Date | null;
  name?: string | null;
  location?: string | null;
  locationName?: string | null;
  deviceKey?: string | null;
};

const CAPTURE_ONLINE_WINDOW_MS = 2 * 60 * 1000;

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasEffectiveAttendanceMode(reader: AttendanceCapableReader): boolean {
  if (reader.attendanceMode) return true;
  return reader.locationType === "GATE" || reader.locationType === "CLASSROOM";
}

export function isAttendanceCapableReader(reader: AttendanceCapableReader): boolean {
  return reader.mode === "ATTENDANCE" || Boolean(reader.locationType && hasEffectiveAttendanceMode(reader));
}

export function isActiveAttendanceCapableReader(reader: AttendanceCapableReader): boolean {
  return Boolean(reader.isActive) && reader.status === "ACTIVE" && isAttendanceCapableReader(reader);
}

export function isReaderRecentlyOnline(reader: AttendanceCapableReader, now = Date.now()): boolean {
  const lastContactAt = Math.max(
    toTimestamp(reader.lastHeartbeatAt) ?? 0,
    toTimestamp(reader.lastSeenAt) ?? 0,
  );
  if (lastContactAt) {
    return now - lastContactAt <= CAPTURE_ONLINE_WINDOW_MS;
  }
  return reader.onlineStatus === "ONLINE";
}

export function isReaderAvailableForCredentialCapture(reader: AttendanceCapableReader, now = Date.now()): boolean {
  return isActiveAttendanceCapableReader(reader) && isReaderRecentlyOnline(reader, now);
}

function cleanLabelPart(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatAttendanceReaderLabel(reader: AttendanceCapableReader): string {
  const name = cleanLabelPart(reader.name);
  const location = cleanLabelPart(reader.locationName) ?? cleanLabelPart(reader.location);
  const deviceKey = cleanLabelPart(reader.deviceKey);

  if (name && location && name.toLowerCase() !== location.toLowerCase()) {
    return `${name} (${location})`;
  }
  return name ?? location ?? deviceKey ?? "Attendance reader";
}
