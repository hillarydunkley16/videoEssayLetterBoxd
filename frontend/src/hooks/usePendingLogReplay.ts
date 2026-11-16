import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { createLog } from "../api/logs";
import { useAuthPost } from "../api/authPost";
import { getOrCreateVideoEssayByYoutubeId } from "../api/videos";
import { showToast } from "../helpers/toast";
import { clearPendingLog, readPendingLog } from "../lib/pendingLog";

// Module-level, not component state or refs, for the same reason as useShareIntentRouter:
// signing in remounts the subtree that owns this hook, so React state resets while the
// sign-in is still settling. These survive the remount within one JS process.
let replayInFlight = false;
// savedAt of a pending log whose replay failed. It is skipped until the app is reopened
// (no retry loop), but a newer pending log has a different savedAt and still replays.
let failedSavedAt: number | null = null;

export function __resetPendingLogReplayForTests() {
  replayInFlight = false;
  failedSavedAt = null;
}

// Saves the log a signed-out visitor made on the landing page once they have an account:
// resolve the essay, create the log, then clear the pending log. The pending log is cleared
// only after the log is created, so a failure keeps it for the next app open.
// The work is deliberately not cancelled on unmount: a remount mid-replay must not abandon
// a half-finished log, and the toast helper is a plain pub/sub, safe to call after unmount.
export function usePendingLogReplay() {
  const { isSignedIn, getToken } = useAuth();
  const authPost = useAuthPost();

  useEffect(() => {
    if (!isSignedIn || replayInFlight) return;
    replayInFlight = true; // claim before the first await so a concurrent trigger can't double-run

    (async () => {
      let savedAt: number | null = null;
      try {
        const pending = await readPendingLog();
        if (!pending || pending.savedAt === failedSavedAt) return;
        savedAt = pending.savedAt;

        const token = await getToken();
        if (!token) return;

        const essay = await getOrCreateVideoEssayByYoutubeId(pending.youtubeId, token);
        await createLog(authPost, {
          essay: essay.public_id,
          date: new Date().toISOString().split("T")[0],
          rating: pending.rating,
          ...(pending.reviewText ? { review_text: pending.reviewText } : {}),
        });
        await clearPendingLog();
        showToast("Log saved");
      } catch {
        failedSavedAt = savedAt;
        showToast("Couldn't save your log. We'll try again next time you open the app");
      } finally {
        replayInFlight = false;
      }
    })();
    // authPost and getToken change identity on every Clerk render; depending on them would
    // restart the effect. The in-flight claim above already makes re-runs harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
}
