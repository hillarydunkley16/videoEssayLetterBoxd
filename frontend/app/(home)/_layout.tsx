import { Stack, Tabs } from 'expo-router'
import { SafeAreaView, StyleSheet, Platform } from 'react-native'
import { HomeTopNav } from '@/components/ui/HomeTopNav'

export default function Layout() {
  return (
    <Stack screenOptions={{
        headerShown: Platform.OS === 'web' ? false : true,
        header: () => <HomeTopNav/>,
    }}/>
  )
  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})