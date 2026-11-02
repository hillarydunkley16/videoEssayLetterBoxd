import { Platform } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'

// Signed-out branch of the home screen. Clerk's <SignedOut> renders nothing until Clerk has
// loaded, which kept the hero (the page's largest element) off screen for ~12s on Slow 4G.
// On web this also shows while Clerk loads, so the hero is in the statically exported HTML
// and survives hydration; a signed-in user gets the feed once Clerk reports it. Native
// keeps SignedOut's behavior (and never renders before Clerk is loaded anyway).
export function HeroGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const show = Platform.OS === 'web' ? !isSignedIn : isLoaded && !isSignedIn
  return show ? <>{children}</> : null
}
