export type NfcPermission =
  | "nfc.attendance.operate"
  | "nfc.gate.view"
  | "nfc.gate.scan"
  | "nfc.canteen.view"
  | "nfc.canteen.charge"
  | "nfc.canteen.transactions.view"
  | "nfc.canteen.reconciliation.view"
  | "nfc.canteen.reconciliation.submit"
  | "nfc.fee-holds.manage"
  | "nfc.tags.manage"
  | "nfc.wallets.topup"
  | "nfc.wallets.pin.manage"
  | "nfc.devices.manage"
  | "staff.manage"
  | "app.admin"
  | "communications.view"
  | "communications.create"
  | "communications.edit"
  | "communications.validate"
  | "communications.requestApproval"
  | "communications.approve"
  | "communications.send"
  | "communications.pause"
  | "communications.retry"
  | "communications.cancel"
  | "communications.templates.manage"
  | "communications.audiences.manage"
  | "communications.replies.view"
  | "communications.settings.manage"
  | "inventory.view"
  | "inventory.items.manage"
  | "inventory.stock.receive"
  | "inventory.stock.issue"
  | "inventory.reconcile"
  | "inventory.reporting.register";

export const rolePermissions: Record<string, string[]> = {
  ADMIN_OPERATOR: ["*"],
  TEACHER: [],
  SECURITY: ["nfc.attendance.operate", "nfc.gate.view", "nfc.gate.scan"],
  GATE_SECURITY: ["nfc.attendance.operate", "nfc.gate.view", "nfc.gate.scan"],
  CANTEEN: ["nfc.canteen.view", "nfc.canteen.charge", "nfc.canteen.transactions.view", "nfc.canteen.reconciliation.view", "nfc.canteen.reconciliation.submit"],
  CASHIER: ["nfc.canteen.view", "nfc.canteen.charge", "nfc.canteen.transactions.view", "nfc.wallets.topup", "nfc.fee-holds.manage", "nfc.canteen.reconciliation.view", "nfc.canteen.reconciliation.submit", "communications.view", "communications.create"],
};

export function hasPermission(role: string | null | undefined, permission: string): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasExplicitPermission(role: string | null | undefined, permission: string): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes(permission);
}

export function canOperateAttendance(role: string | null | undefined): boolean {
  return hasExplicitPermission(role, "nfc.attendance.operate");
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN_OPERATOR: "Administrator",
  TEACHER: "Teacher",
  SECURITY: "Gate Security",
  GATE_SECURITY: "Gate Security",
  CANTEEN: "Canteen Operator",
  CASHIER: "Bursar / Cashier",
};

export function getDefaultRouteForRole(role: string | null | undefined): string {
  if (role === "CASHIER" || role === "CANTEEN") return "/nfc/canteen";
  if (role === "SECURITY" || role === "GATE_SECURITY") return "/nfc/gate";
  return "/dashboard";
}
