import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import AgeConfirmation from '@/src/components/AgeConfirmation'
import { getClerkErrorMessage } from '@/src/helpers/clerkErrors'
import { useUsernameAvailability } from '@/src/hooks/useUsernameAvailability'
import { useSignUp } from '@clerk/clerk-expo'
import { Redirect, useRouter } from 'expo-router'
import * as React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

/**
 * Where a brand-new Google user picks a username. Clerk needs one to finish the sign-up, and
 * there is no session until it's saved. Cancel (or quitting) just abandons the half-finished
 * sign-up: nothing is activated and no Django user exists yet. See SPEC-google-signin.md.
 */
export default function Page() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()
  const [username, setUsername] = React.useState('')
  const [errors, setErrors] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  // Always starts unchecked: a new Google account is only created from this screen once it is ticked.
  const [ageConfirmed, setAgeConfirmed] = React.useState(false)
  const {
    checking: checkingUsername,
    available: usernameAvailable,
    suggestions: usernameSuggestions,
  } = useUsernameAvailability(username)

  // Reached directly (reload, deep link) with no Google sign-up waiting: nothing to finish.
  if (isLoaded && signUp?.status !== 'missing_requirements') {
    return <Redirect href="/sign-in" />
  }

  const onSubmit = async () => {
    if (!isLoaded || submitting || !ageConfirmed) return
    setSubmitting(true)
    try {
      const result = await signUp.update({ username: username.trim() })
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(result, null, 2))
        setErrors("We couldn't finish creating your account. Please try again.")
      }
    } catch (err) {
      setErrors(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled =
    !ageConfirmed || !username.trim() || checkingUsername || usernameAvailable === false || submitting

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.subcontainer}>
        <ThemedText type="title" style={styles.title}>
          Pick a username
        </ThemedText>
        <ThemedText style={styles.description}>
          This is how other people will find you.
        </ThemedText>
        {errors ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{errors}</ThemedText>
          </View>
        ) : null}
        <ThemedText style={styles.label}>Username</ThemedText>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={username}
          placeholder="Enter username"
          placeholderTextColor="#666666"
          onChangeText={(text) => {
            setUsername(text)
            setErrors('')
          }}
        />
        {checkingUsername ? (
          <ThemedText style={styles.usernameHint}>Checking…</ThemedText>
        ) : usernameAvailable === true ? (
          <ThemedText style={[styles.usernameHint, styles.usernameAvailable]}>✓ Available</ThemedText>
        ) : usernameAvailable === false ? (
          <View>
            <ThemedText style={[styles.usernameHint, styles.usernameTaken]}>
              That username is taken. Try:
            </ThemedText>
            <View style={styles.suggestions}>
              {usernameSuggestions.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setUsername(suggestion)}>
                  <ThemedText type="link">{suggestion}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <AgeConfirmation checked={ageConfirmed} onChange={setAgeConfirmed} />
        <Pressable
          testID="choose-username-submit"
          style={({ pressed }) => [
            styles.button,
            submitDisabled && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={onSubmit}
          disabled={submitDisabled}
        >
          <ThemedText style={styles.buttonText}>Continue</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.replace('/sign-in')} style={styles.cancel}>
          <ThemedText type="link">Cancel</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcontainer: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111',
  },
  usernameHint: {
    fontSize: 13,
    marginTop: -6,
  },
  usernameAvailable: {
    color: '#16a34a',
  },
  usernameTaken: {
    color: '#dc2626',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancel: {
    alignItems: 'center',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
})
