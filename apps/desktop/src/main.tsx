import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, readStoredPreference, resolveTheme, systemPrefersDark } from "./theme/themes";
import "./styles/app.css";

// Apply the saved theme before the first paint, so the window never flashes the default one.
applyTheme(resolveTheme(readStoredPreference(), systemPrefersDark()));

createRoot(document.getElementById("root")!).render(<App />);
