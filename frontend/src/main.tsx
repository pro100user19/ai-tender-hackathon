import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const mount = document.getElementById("dashboard-root");

if (mount) {
  createRoot(mount).render(
    <App
      apiUrl={mount.dataset.apiUrl || "/api/results"}
      defaultPages={mount.dataset.defaultPages || "12"}
      initialTenderId={mount.dataset.initialTenderId || ""}
    />
  );
}
