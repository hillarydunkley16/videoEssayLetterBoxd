import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { recordAgeConfirmation } from "../api/users";
import { clearAgeConfirmation, readAgeConfirmation } from "../lib/ageConfirmation";

// Module-level, not component state or refs, for the same reason as usePendingLogReplay: signing
// in remounts the subtree that owns this hook, so React state resets while sign-in is settling.
let syncInFlight = false;
// confirmedAt of a tick whose report failed. It is skipped until the app is reopened (no retry
// loop), but a newer tick has a different confirmedAt and is still reported.
let failedConfirmedAt: number | null = null;

export function __resetAgeConfirmationSyncForTests() {
  syncInFlight = false;
  failedConfirmedAt = null;
}

// Reports the age tick made on the sign-up form to the server once the visitor is signed in, then
// clears it. Cleared only after the server accepted it, so a failure keeps it for the next open.
// Silent on failure: the visitor did nothing wrong and can't act on it.
export function useAgeConfirmationSync() {
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isSignedIn || syncInFlight) return;
    syncInFlight = true; // claim before the first await so a concurrent trigger can't double-run

    (async () => {
      let confirmedAt: number | null = null;
      try {
        const held = await readAgeConfirmation();
        if (!held || held.confirmedAt === failedConfirmedAt) return;
        confirmedAt = held.confirmedAt;

        const token = await getToken();
        if (!token) return;

        await recordAgeConfirmation(token);
        await clearAgeConfirmation();
      } catch {
        failedConfirmedAt = confirmedAt;
      } finally {
        syncInFlight = false;
      }
    })();
    // getToken changes identity on every Clerk render; depending on it would restart the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
}
