import type { RouteObject } from "react-router-dom";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { RouteErrorPage } from "../../pages/RouteErrorPage";
import { OwnerDashboardPage } from "../../pages/owner/OwnerDashboardPage";
import { OwnerReaderDetailPage, OwnerReaderManagementPage } from "../../pages/owner/OwnerReaderManagementPage";
import { OwnerSchoolsPage } from "../../pages/owner/OwnerSchoolsPage";
import { OwnerUsersPage } from "../../pages/owner/OwnerUsersPage";

export const ownerRoutes: RouteObject[] = [
  {
    path: "/owner",
    element: <OwnerShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "schools", element: <OwnerSchoolsPage /> },
      { path: "readers", element: <OwnerReaderManagementPage /> },
      { path: "readers/:readerId", element: <OwnerReaderDetailPage /> },
      { path: "users", element: <OwnerUsersPage /> },
    ],
  },
];
