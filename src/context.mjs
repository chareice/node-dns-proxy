import { AsyncLocalStorage } from "node:async_hooks";

export const contextStorage = new AsyncLocalStorage();

export function getContext() {
  return contextStorage.getStore();
}
