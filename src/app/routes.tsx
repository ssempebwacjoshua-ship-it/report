import { createBrowserRouter } from "react-router-dom";
import { ownerRoutes } from "./routes/ownerRoutes";
import { protectedRoutes } from "./routes/protectedRoutes";
import { publicRoutes } from "./routes/publicRoutes";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export const router = createBrowserRouter([
  ...publicRoutes,
  ...ownerRoutes,
  ...protectedRoutes,
], {
  basename: routerBasename,
});
