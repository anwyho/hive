import { useState } from "../../vendor/hooks.module.js";
import { installContext } from "../../pwa/install.js";
import { readPrefs, savePrefs } from "../prefs.js";

export function useInstallHint() {
  const [dismissed, setDismissed] = useState(
    () => readPrefs().installDismissed === true,
  );
  const [{ standalone, touch }] = useState(installContext);
  return {
    shown: touch && !standalone && !dismissed,
    dismiss() {
      setDismissed(true);
      savePrefs({ installDismissed: true });
    },
  };
}
