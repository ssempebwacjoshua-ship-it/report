export type NfcPermission =
  | "nfc.gate.view"
  | "nfc.gate.scan"
  | "nfc.canteen.view"
  | "nfc.canteen.charge"
  | "nfc.canteen.transactions.view"
  | "nfc.tags.manage"
  | "nfc.wallets.topup"
  | "nfc.wallets.pin.manage"
  | "nfc.devices.manage"
  | "staff.manage"
  | "app.admin";

export const rolePermissions: Record<string, string[]> = {
  ADMIN_OPERATOR: ["*"],
  TEACHER: [],
  SECURITY: ["nfc.gate.view", "nfc.gate.scan"],
  GATE_SECURITY: ["nfc.gate.view", "nfc.gate.scan"],
  CANTEEN: ["nfc.canteen.view", "nfc.canteen.charge", "nfc.canteen.transactions.view"],
  CASHIER: ["nfc.canteen.view", "nfc.canteen.charge", "nfc.canteen.transactions.view"],
};

export function hasPermission(role: string | null | undefined, permission: string): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN_OPERATOR: "Administrator",
  TEACHER: "Teacher",
  SECURITY: "Gate Security",
  GATE_SECURITY: "Gate Security",
  CANTEEN: "Canteen Operator",
  CASHIER: "Cashier",
};

export function getDefaultRouteForRole(role: string | null | undefined): string {
  if (role === "CASHIER" || role === "CANTEEN") return "/nfc/canteen";
  if (role === "SECURITY" || role === "GATE_SECURITY") return "/nfc/gate";
  return "/dashboard";
}
