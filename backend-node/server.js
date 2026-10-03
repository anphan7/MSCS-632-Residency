// backend-node/server.js
import { createStore } from "./src/store.js";
import { createService } from "./src/service.js";
import { createApp } from "./src/app.js";

const PORT = process.env.PORT || 4000;
const DATA_FILE = process.env.DATA_FILE || "./tasks.json";

const store = createStore(DATA_FILE);
await store.init();
const app = createApp(createService(store));
app.listen(PORT, () => console.log(`Node backend on http://localhost:${PORT}`));
