/* The theme choice of the three, and the light or dark it currently means.
   Declared here rather than in an app module because pwa/theme-boot.ts
   compiles in its own program, and a module import from this file would pull
   that module into that program and emit it twice. */
export type ThemePref = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

declare global {
  interface ThemeApi {
    pref: ThemePref;
    resolved: Resolved;
    order: readonly string[];
    set(p: string): void;
    cycle(): void;
  }
  interface SwInfo {
    version: string | null;
    build?: string;
    update: boolean;
  }

  /* Dispatched at the document, but it bubbles, so a window listener sees it —
     which lib.dom's WindowEventMap does not say. */
  interface WindowEventMap {
    visibilitychange: Event;
  }

  interface Window {
    __theme: ThemeApi;
    __swInfo: SwInfo;
    __applyUpdate: () => void;
  }
}
