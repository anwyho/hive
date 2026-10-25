/* The module entry. index.html loads only this; everything else is reached by
   import, which is what lets the service worker precache a graph rather than a
   hand-kept list of script tags. */

import { h, render } from "../vendor/preact.module.js";
import { App } from "./App.js";

render(<App />, document.getElementById("root")!);
