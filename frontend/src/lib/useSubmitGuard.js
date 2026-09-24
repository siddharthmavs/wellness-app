import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Prevents duplicate submissions (QA #11). `run(key, fn)` ignores calls while a
 * previous call with the same key is still in flight — checked synchronously via
 * a ref, because a fast second click can arrive before React re-renders the
 * disabled button. `busy[key]` drives the disabled/loading UI.
 */
export function useSubmitGuard() {
  const inFlight = useRef(new Set());
  const [busy, setBusy] = useState({});

  const run = useCallback(async (key, fn) => {
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      return await fn();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Something went wrong. Please try again.");
      return undefined;
    } finally {
      inFlight.current.delete(key);
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }, []);

  return [busy, run];
}
