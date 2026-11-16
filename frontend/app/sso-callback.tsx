import * as WebBrowser from 'expo-web-browser'

// Web only: the Google OAuth popup lands here. Completing the auth session hands the result back
// to the opener and closes the popup. Native never routes here.
WebBrowser.maybeCompleteAuthSession()

export default function SsoCallback() {
  return null
}
