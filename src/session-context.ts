import { AsyncLocalStorage } from "node:async_hooks";

export interface SessionContext {
  sessionKey: string;
}

export const sessionContext = new AsyncLocalStorage<SessionContext>();

export function getSessionKey(): string | undefined {
  return sessionContext.getStore()?.sessionKey;
}
