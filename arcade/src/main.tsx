import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArcadeApp } from "./ui/ArcadeApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArcadeApp />
  </StrictMode>,
);
