import * as React from 'react'
import { checkUsernameAvailability } from '@/src/api/users'

// Matches the backend's USERNAME_MIN_LENGTH (movie_csv/views/api.py) — under this, there's
// nothing meaningful to check yet, so we don't fire a request.
const USERNAME_MIN_LENGTH = 3
// Wait this long after the last keystroke so typing doesn't fire a request per character.
const DEBOUNCE_MS = 250

/**
 * Live username availability. `available` is `null` for "unknown" (too short, not checked yet,
 * or the check errored) — callers should only block submit when it's positively `false`, never
 * just because we're unsure; Clerk is still the final authority on submit either way.
 */
export function useUsernameAvailability(username: string) {
  const [checking, setChecking] = React.useState(false)
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  // Bumped on every keystroke, so a slow answer to an earlier candidate can't overwrite a
  // newer one's result.
  const checkId = React.useRef(0)

  React.useEffect(() => {
    const candidate = username.trim()
    const mine = ++checkId.current

    if (candidate.length < USERNAME_MIN_LENGTH) {
      setChecking(false)
      setAvailable(null)
      setSuggestions([])
      return
    }

    setChecking(true)
    const handle = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(candidate)
        if (mine !== checkId.current) return
        setAvailable(result.available)
        setSuggestions(result.available ? [] : result.suggestions)
      } catch (err) {
        if (mine !== checkId.current) return
        // Fail open: a network hiccup shouldn't block sign-up. Clerk checks again on submit.
        setAvailable(null)
        setSuggestions([])
      } finally {
        if (mine === checkId.current) setChecking(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [username])

  return { checking, available, suggestions }
}
