import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { InstallPrompt } from "../components/pwa/InstallPrompt";
import { router } from "./routes";

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <InstallPrompt />
    </AuthProvider>
  );
}
