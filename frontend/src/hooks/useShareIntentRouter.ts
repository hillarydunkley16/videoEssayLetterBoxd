import { useEffect } from "react";
import { router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useAuth } from "@clerk/clerk-expo";
import { extractYoutubeId } from "../lib/shareIntent";
import { getOrCreateVideoEssayByYoutubeId } from "../api/videos";

// Module-level, not component state: signing in remounts the subtree that owns this
// hook (observed live — Clerk's session activation resets useState/useRef here to their
// initial values), so a signed-out share held in React state is lost before isSignedIn
// ever flips true. A module-level variable survives that remount within the same JS
// process, which is all resuming after sign-in actually needs.
let pendingYoutubeId: string | null = null;

export function __resetPendingShareForTests() {
  pendingYoutubeId = null;
}

// Wires a received share intent (from the OS share sheet) to the quick-log flow.
// Effects depend on primitives (sharedText, isSignedIn), never the shareIntent object
// itself: expo-share-intent returns a new object reference on every render, and depending
// on it directly restarts (and cancels) the in-flight resolve on every unrelated
// re-render — e.g. the burst of renders sign-in produces reliably cancelled the fetch
// before it could complete.
export function useShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { isSignedIn, getToken } = useAuth();
  const sharedText = shareIntent.webUrl ?? shareIntent.text ?? "";

  useEffect(() => {
    if (!hasShareIntent) return;
    const youtubeId = extractYoutubeId(sharedText);
    if (youtubeId) {
      pendingYoutubeId = youtubeId;
    } else {
      resetShareIntent();
    }
  }, [hasShareIntent, sharedText]);

  useEffect(() => {
    const youtubeId = pendingYoutubeId;
    if (!youtubeId || !isSignedIn) return;
    pendingYoutubeId = null; // claim immediately so a concurrent trigger can't double-resolve

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const essay = await getOrCreateVideoEssayByYoutubeId(youtubeId, token);
        if (!cancelled) router.push(`/(modals)/quickLog?essayId=${essay.public_id}`);
      } finally {
        if (!cancelled) resetShareIntent();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, sharedText]);
}
