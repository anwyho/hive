import { h } from "../vendor/preact.module.js";
import { InstallHint } from "./components/InstallHint.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { UpdateRow } from "./components/UpdateRow.js";
import { useInstallHint } from "./hooks/useInstallHint.js";

export function App() {
  const install = useInstallHint();

  return (
    <div class="shell">
      <main class="main">
        <h1>Hive</h1>
      </main>
      <div class="panel">
        {install.shown ? <InstallHint onDismiss={install.dismiss} /> : null}
        <div class="actions">
          <ThemeToggle />
        </div>
        <UpdateRow />
      </div>
    </div>
  );
}
