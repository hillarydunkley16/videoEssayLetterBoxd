import { useEffect } from "react";
import { router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useAuth } from "@clerk/clerk-expo";
import { extractYoutubeId } from "../lib/shareIntent";
import { getOrCreateVideoEssayByYoutubeId } from "../api/videos";

// Wires a received share intent (from the OS share sheet) to the quick-log flow.
// Signed-out shares are dropped here — resuming into quickLog after sign-in is T6.
export function useShareIntentRouter() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!hasShareIntent) return;

    const sharedText = shareIntent.webUrl ?? shareIntent.text ?? "";
    const youtubeId = extractYoutubeId(sharedText);

    if (!youtubeId || !isSignedIn) {
      resetShareIntent();
      return;
    }

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
  }, [hasShareIntent, shareIntent, isSignedIn]);
}
