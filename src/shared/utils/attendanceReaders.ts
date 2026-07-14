type AttendanceCapableReader = {
  mode?: string | null;
  locationType?: string | null;
  attendanceMode?: string | null;
  isActive?: boolean | null;
  status?: string | null;
};

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
