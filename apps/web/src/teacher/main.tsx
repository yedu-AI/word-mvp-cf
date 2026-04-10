import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TeacherDashboard from "./TeacherDashboard";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TeacherDashboard />
  </StrictMode>
);

