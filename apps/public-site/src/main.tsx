import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { stripPublicSwCleanupMarkerFromLocation } from "./publicSwCleanup";
import "./styles.css";

stripPublicSwCleanupMarkerFromLocation();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
