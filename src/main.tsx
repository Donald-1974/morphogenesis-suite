import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "@/components/lab/LabApp";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
);
