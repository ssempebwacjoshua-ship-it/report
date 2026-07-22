import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { PermissionGuard } from "../../components/PermissionGuard";
import { NfcAttendancePage } from "../../pages/NfcAttendancePage";
import { NfcBulkAllocationPage } from "../../pages/NfcBulkAllocationPage";
import { NfcBulkIssuingPage } from "../../pages/NfcBulkIssuingPage";
import { NfcCanteenChargePage } from "../../pages/NfcCanteenChargePage";
import { NfcCanteenReconciliationPage } from "../../pages/NfcCanteenReconciliationPage";
import { NfcCanteenTransactionsPage } from "../../pages/NfcCanteenTransactionsPage";
import { NfcFeeHoldsPage } from "../../pages/NfcFeeHoldsPage";
import { NfcGateOperationsPage } from "../../pages/NfcGateOperationsPage";
import { NfcGateSecurityPage } from "../../pages/NfcGateSecurityPage";
import { NfcOfflinePage } from "../../pages/NfcOfflinePage";
import { NfcOperationsPage } from "../../pages/NfcOperationsPage";
import { NfcSettingsPage } from "../../pages/NfcSettingsPage";
import { NfcWalletTopUpPage } from "../../pages/NfcWalletTopUpPage";
import { NfcWalletsPage } from "../../pages/NfcWalletsPage";
import { StaffUsersPage } from "../../pages/StaffUsersPage";
import { StudentCredentialsPage } from "../../pages/StudentCredentialsPage";
import { StudentWalletPage } from "../../pages/StudentWalletPage";
import { StudentWalletTopUpPage } from "../../pages/StudentWalletTopUpPage";

export const nfcRoutes: RouteObject[] = [
  { path: "nfc/wristbands", element: <PermissionGuard permission="nfc.tags.manage"><NfcOperationsPage /></PermissionGuard> },
  { path: "nfc/wristbands/register", element: <PermissionGuard permission="nfc.tags.manage"><StudentCredentialsPage /></PermissionGuard> },
  { path: "nfc/wristbands/bulk-issue", element: <PermissionGuard permission="nfc.tags.manage"><NfcBulkIssuingPage /></PermissionGuard> },
  { path: "nfc/wristbands/bulk-allocate", element: <PermissionGuard permission="nfc.tags.manage"><NfcBulkAllocationPage /></PermissionGuard> },
  { path: "nfc/attendance", element: <PermissionGuard permission="nfc.devices.manage"><NfcAttendancePage /></PermissionGuard> },
  { path: "nfc/wallets", element: <PermissionGuard permission="nfc.wallets.pin.manage"><NfcWalletsPage /></PermissionGuard> },
  { path: "nfc/wallets/top-up", element: <PermissionGuard permission="nfc.wallets.topup"><NfcWalletTopUpPage /></PermissionGuard> },
  { path: "nfc/wallets/transactions", element: <PermissionGuard permission="nfc.canteen.transactions.view"><NfcCanteenTransactionsPage /></PermissionGuard> },
  { path: "nfc/wallets/reconcile", element: <PermissionGuard permission="nfc.canteen.reconciliation.view"><NfcCanteenReconciliationPage /></PermissionGuard> },
  { path: "students/:studentId/wallet", element: <PermissionGuard permission="nfc.canteen.transactions.view"><StudentWalletPage /></PermissionGuard> },
  { path: "students/:studentId/wallet/top-up", element: <PermissionGuard permission="nfc.wallets.topup"><StudentWalletTopUpPage /></PermissionGuard> },
  { path: "nfc/canteen", element: <PermissionGuard permission="nfc.canteen.charge"><NfcCanteenChargePage /></PermissionGuard> },
  { path: "nfc/settings", element: <PermissionGuard permission="app.admin"><NfcSettingsPage /></PermissionGuard> },
  { path: "nfc/fee-holds", element: <PermissionGuard permission="nfc.fee-holds.manage"><NfcFeeHoldsPage /></PermissionGuard> },
  { path: "nfc/gate", element: <PermissionGuard permission="nfc.gate.view"><NfcGateSecurityPage /></PermissionGuard> },
  { path: "nfc/gate-admin", element: <PermissionGuard permission="app.admin"><NfcGateOperationsPage /></PermissionGuard> },
  { path: "nfc/staff-users", element: <PermissionGuard permission="staff.manage"><StaffUsersPage /></PermissionGuard> },
  { path: "nfc/offline", element: <PermissionGuard permission="nfc.devices.manage"><NfcOfflinePage /></PermissionGuard> },
  { path: "student-credentials", element: <Navigate to="/nfc/wristbands/register" replace /> },
  { path: "nfc-tags", element: <Navigate to="/nfc/wristbands" replace /> },
  { path: "nfc/bulk-issuing", element: <Navigate to="/nfc/wristbands/bulk-issue" replace /> },
  { path: "nfc/bulk-allocation", element: <Navigate to="/nfc/wristbands/bulk-allocate" replace /> },
  { path: "nfc-attendance", element: <Navigate to="/nfc/attendance" replace /> },
  { path: "nfc-wallets", element: <Navigate to="/nfc/wallets" replace /> },
  { path: "nfc/canteen/transactions", element: <Navigate to="/nfc/wallets/transactions" replace /> },
  { path: "nfc/canteen/reconciliation", element: <Navigate to="/nfc/wallets/reconcile" replace /> },
  { path: "canteen-charge", element: <Navigate to="/nfc/canteen" replace /> },
  { path: "gate-security", element: <Navigate to="/nfc/gate" replace /> },
  { path: "canteen/nfc/:token", element: <PermissionGuard permission="nfc.canteen.charge"><NfcCanteenChargePage /></PermissionGuard> },
  { path: "gate/nfc/:token", element: <PermissionGuard permission="nfc.gate.scan"><NfcGateSecurityPage /></PermissionGuard> },
];
