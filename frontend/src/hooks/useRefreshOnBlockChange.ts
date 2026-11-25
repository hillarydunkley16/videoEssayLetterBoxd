import { useEffect, useRef } from "react";
import { subscribeBlockChanged } from "@/src/helpers/blockEvents";

// Calls `reload` whenever the user blocks or unblocks someone. Always calls the latest
// `reload`, so callers needn't memoize it.
export function useRefreshOnBlockChange(reload: () => void) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => subscribeBlockChanged(() => latest.current()), []);
}
