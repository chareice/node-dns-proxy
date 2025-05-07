import { AsyncLocalStorage } from "node:async_hooks";
import http from "node:http";
import { v4 as uuidv4 } from "uuid";

const context = new AsyncLocalStorage();

const server = http.createServer((req, res) => {
  const reqId = uuidv4();
  const store = { reqId };
  context.run(store, async () => {
    log("Request started");
    log("Request finished");
    res.end("Hello World");
  });
});

function log(msg) {
  const store = context.getStore();
  const id = store?.reqId || "unknown";
  console.log(`[${id}] ${msg}`);
}

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
