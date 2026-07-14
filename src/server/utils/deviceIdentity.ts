const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string | null | undefined) {
  if (!value) return false;
  return UUID_PATTERN.test(value.trim());
}

export function buildDeviceIdentityWhere(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { deviceKey: trimmed };
  }

  if (isUuidLike(trimmed)) {
    return {
      OR: [
        { id: trimmed },
        { deviceKey: trimmed },
      ],
    };
  }

  return { deviceKey: trimmed };
}

export const RECENT_DEVICE_ORDER_BY = [
  { isActive: "desc" as const },
  { lastHeartbeatAt: "desc" as const },
  { lastSeenAt: "desc" as const },
  { updatedAt: "desc" as const },
];
