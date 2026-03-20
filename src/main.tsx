import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "konsta/react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "./App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App theme="ios" dark safeAreas iosHoverHighlight={false}>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        duration={3800}
        visibleToasts={3}
        offset={{ top: "max(12px, env(safe-area-inset-top))", left: "16px", right: "16px" }}
      />
    </App>
  </StrictMode>
);
