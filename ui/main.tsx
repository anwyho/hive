/* The module entry. index.html loads only this; everything else is reached by
   import, which is what lets the service worker precache a graph rather than a
   hand-kept list of script tags. */

import { h, render } from "../vendor/preact.module.js";
import { App } from "./App.js";

/* iOS Safari ignores user-scalable=no; cancelling its gesture events is what
   keeps a pinch outside the board from zooming the whole page. */
document.addEventListener("gesturestart", (e) => e.preventDefault());

render(<App />, document.getElementById("root")!);
