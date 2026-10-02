/** Close an orphaned MCode window, allowing brief stream interruptions to heal. */
export function createCompanionLifetime(close: () => void, timeoutMs = 5000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { if (timer) clearTimeout(timer); timer = undefined; };
  return {
    connectionChanged(connected: boolean) {
      cancel();
      if (!connected) timer = setTimeout(close, timeoutMs);
    },
    dispose: cancel,
  };
}
