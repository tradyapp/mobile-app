import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "konsta/react";
import { BrowserRouter } from "react-router-dom";
import Home from "./App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App theme="ios" dark safeAreas iosHoverHighlight={false}>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </App>
  </StrictMode>
);
