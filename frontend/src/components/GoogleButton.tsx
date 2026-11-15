import { ThemedText } from '@/components/themed-text'
import { getClerkErrorMessage } from '@/src/helpers/clerkErrors'
import { useSSO } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as React from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

// Web: closes the OAuth popup once it lands back on /sso-callback.
WebBrowser.maybeCompleteAuthSession()

/**
 * "Continue with Google" plus the "or" divider that separates it from the email form.
 * Owns the whole SSO call so sign-in and sign-up can't drift. See SPEC-google-signin.md.
 */
export default function GoogleButton() {
  const { startSSOFlow } = useSSO()
  const router = useRouter()
  const [error, setError] = React.useState('')
  // A ref, not state: a second tap can land before a state update re-renders.
  const inFlight = React.useRef(false)

  React.useEffect(() => {
    if (Platform.OS === 'web') return
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])

  // No `await` before startSSOFlow: web opens a popup, which browsers block if it isn't
  // opened straight from the tap.
  const onGooglePress = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setError('')
    try {
      const { createdSessionId, setActive, signUp, authSessionResult } = await startSSOFlow({
        strategy: 'oauth_google',
      })
      if (createdSessionId) {
        await setActive!({ session: createdSessionId })
        router.replace('/')
      } else if (authSessionResult?.type === 'success') {
        // New Google user. TODO T3: router.replace('/choose-username') when
        // signUp.status === 'missing_requirements'.
        // TEMPORARY (T1 manual check 2, remove once confirmed):
        console.log('[google-sso] signUp', signUp?.status, signUp?.missingFields)
      }
      // Anything else is a cancel/dismiss: stay put, no error.
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer} testID="google-error">
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onGooglePress}
        accessibilityRole="button"
      >
        <ThemedText style={styles.buttonText}>Continue with Google</ThemedText>
      </Pressable>
      <View style={styles.divider}>
        <View style={styles.line} />
        <ThemedText style={styles.dividerText}>or</ThemedText>
        <View style={styles.line} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  button: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#111',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
  },
  dividerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
})
