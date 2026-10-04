// backend-node/server.js
import { createStore } from "./src/store.js";
import { createService } from "./src/service.js";
import { createApp } from "./src/app.js";

// Config from environment, with sensible defaults.
const PORT = process.env.PORT || 4000;
const DATA_FILE = process.env.DATA_FILE || "./tasks.json";

// Wire the layers: store (state) -> service (logic) -> app (routes).
const store = createStore(DATA_FILE);
await store.init();                 // load state before accepting requests
const app = createApp(createService(store));
app.listen(PORT, () => console.log(`Node backend on http://localhost:${PORT}`));
