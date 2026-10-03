// backend-node/src/store.js
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DEFAULT_USERS = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
];

// The store holds the single source of truth in memory. Because Node runs on
// ONE thread, any synchronous mutation of `state` is atomic. The only async
// part is writing to disk, which we funnel through `persistQueue` so two writes
// can never interleave and clobber the file.
export function createStore(filePath) {
  let state = { users: [...DEFAULT_USERS], tasks: [] };
  let persistQueue = Promise.resolve();

  async function init() {
    if (existsSync(filePath)) {
      state = JSON.parse(await readFile(filePath, "utf8"));
      if (!state.users) state.users = [...DEFAULT_USERS];
      if (!state.tasks) state.tasks = [];
    } else {
      await persist();
    }
  }

  function persist() {
    persistQueue = persistQueue.then(() =>
      writeFile(filePath, JSON.stringify(state, null, 2))
    );
    return persistQueue;
  }

  return {
    init,
    getState: () => state,
    persist,
  };
}
