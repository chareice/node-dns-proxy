import pino from "pino";
import { getContext } from "./context.mjs";

const baseLogger = pino({
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
  formatters: {
    log(obj) {
      const ctx = getContext();
      return {
        ...obj,
        reqId: ctx.reqId,
      };
    },
  },
});

export default baseLogger;
