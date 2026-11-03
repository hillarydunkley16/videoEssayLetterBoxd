import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { WebShellSkeleton } from '@/components/ui/WebShellSkeleton'
import { clearSignedInHint, hasSignedInHint, setSignedInHint } from '@/src/lib/signedInHint'

// Signed-out branch of the home screen. Clerk's <SignedOut> renders nothing until Clerk has
// loaded, which kept the hero (the page's largest element) off screen for ~12s on Slow 4G.
// On web this also shows while Clerk loads, so the hero is in the statically exported HTML
// and survives hydration; a signed-in user gets the feed once Clerk reports it. Native
// keeps SignedOut's behavior (and never renders before Clerk is loaded anyway).
//
// A returning signed-in visitor shouldn't see the marketing hero while Clerk loads, so a
// browser hint (set once Clerk says signed in) swaps it for the feed skeleton. The hint is
// read after mount: the server render and the first client render must both show the hero
// so hydration matches.
export function HeroGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const isWeb = Platform.OS === 'web'
  const [returning, setReturning] = useState(false)

  useEffect(() => {
    if (!isWeb) return
    if (!isLoaded) {
      setReturning(hasSignedInHint())
    } else if (isSignedIn) {
      setSignedInHint()
    } else {
      clearSignedInHint()
    }
  }, [isWeb, isLoaded, isSignedIn])

  if (isWeb && !isLoaded && returning) return <WebShellSkeleton />
  const show = isWeb ? !isSignedIn : isLoaded && !isSignedIn
  return show ? <>{children}</> : null
}
