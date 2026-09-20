import { Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})