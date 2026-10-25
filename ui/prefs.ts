/* Device preferences that are not the theme. localStorage throws in private
   windows and under some embeddings, so every access is guarded and a failure
   means the defaults. */

const KEY = "hive.prefs";

/* Every field is `unknown`: the value is whatever an older build, or a
   hand-edited localStorage, left behind. */
export interface StoredPrefs {
  installDismissed?: unknown;
}

export interface PrefsPatch {
  installDismissed?: boolean;
}

export function readPrefs(): StoredPrefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePrefs(patch: PrefsPatch): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch {}
}
