type LogArgs = unknown[];

interface Logger {
  debug: (...args: LogArgs) => void;
  info: (...args: LogArgs) => void;
  warn: (...args: LogArgs) => void;
  error: (...args: LogArgs) => void;
}

const noop = (...args: LogArgs) => {
  void args;
};

const getHostConsole = (): Console | undefined => {
  // Avoid referencing the global `console` identifier directly (eslint `no-console`),
  // but still allow logging in dev when needed.
  const host = globalThis as unknown as { console?: Console };
  return host.console;
};

const isProd = (() => {
  try {
    const env = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
    if (typeof env?.PROD === "boolean") return env.PROD;
  } catch {
    // ignore
  }

  const proc = globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } };
  return proc.process?.env?.NODE_ENV === "production";
})();

export const logger: Logger = {
  debug: isProd ? noop : (...args) => getHostConsole()?.debug?.(...args),
  info: isProd ? noop : (...args) => getHostConsole()?.info?.(...args),
  warn: (...args) => getHostConsole()?.warn?.(...args),
  error: (...args) => getHostConsole()?.error?.(...args),
};
