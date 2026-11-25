import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { WebShellSkeleton } from '@/components/ui/WebShellSkeleton'
import { clearSignedInHint, setSignedInHint } from '@/src/lib/signedInHint'

// Signed-out branch of the home screen. Clerk's <SignedOut> renders nothing until Clerk has
// loaded, which kept the hero (the page's largest element) off screen for ~12s on Slow 4G.
// On web this also shows while Clerk loads, so the hero is in the statically exported HTML
// and survives hydration; a signed-in user gets the feed once Clerk reports it. Native
// keeps SignedOut's behavior (and never renders before Clerk is loaded anyway).
//
// A returning signed-in visitor shouldn't see the marketing hero flash before the feed. An
// inline script in +html sets data-returning on <html> from a localStorage hint before first
// paint, and CSS then hides the hero and shows the skeleton rendered beside it. Both are always
// in the DOM (static HTML too), so there is nothing to hydrate-mismatch. If Clerk says the
// visitor is not signed in after all, the attribute is removed and the hero comes back.
export function HeroGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const isWeb = Platform.OS === 'web'

  useEffect(() => {
    if (!isWeb || !isLoaded) return
    if (isSignedIn) {
      setSignedInHint()
    } else {
      clearSignedInHint()
      globalThis.document?.documentElement?.removeAttribute('data-returning')
    }
  }, [isWeb, isLoaded, isSignedIn])

  const show = isWeb ? !isSignedIn : isLoaded && !isSignedIn
  if (!show) return null
  if (!isWeb) return <>{children}</>
  return (
    <>
      <View testID="home-hero" style={styles.fill}>
        {children}
      </View>
      <View testID="home-returning-skeleton" style={styles.fill}>
        <WebShellSkeleton />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
