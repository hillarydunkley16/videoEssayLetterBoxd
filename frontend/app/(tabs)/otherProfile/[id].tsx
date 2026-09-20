import SignOutButton from '@/app/components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { StyleSheet, TouchableOpacity, Text, FlatList, Image, View, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useState, useEffect } from 'react'
import { Log } from '@/src/types/log'
import { fetchAProfileById, followUser } from '@/src/api/users'
import { useAuth } from '@clerk/clerk-expo'
import { useAuthUpdate } from '@/src/api/authUpdate'
import { useAuthPost } from '@/src/api/authPost'
import { useAuthDelete } from '@/src/api/authDelete'
import { Profile } from '@/src/types/profile'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const profileId = rawId ? Number(rawId) : undefined

  const { getToken } = useAuth()
  const authUpdate = useAuthUpdate()
  const authDelete = useAuthDelete()
  const authPost = useAuthPost()
  const { user } = useUser()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [userLogs, setUserLogs] = useState<Log[]>([])
  const [numLogs, setNumLogs] = useState(0)
  const [numEssays, setNumEssays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (!profileId || Number.isNaN(profileId)) {
        setError('Missing profile id')
        setLoading(false)
        return
      }

      try {
        const token = await getToken()
        const profileData = await fetchAProfileById(profileId, token!)
        setProfile(profileData)
        setUserLogs(profileData.user_logs)
        setNumLogs(profileData.user_logs.length)
        setNumEssays(new Set(profileData.user_logs.map((item) => item.essay)).size)
        setFollowersCount(profileData.followers?.length ?? 0)
        // The Django user's `username` is the Clerk user id (see
        // ClerkAuthentication.authenticate), so this is how a Clerk-side
        // user matches themselves in a followers list from the backend.
        setIsFollowing(
          profileData.followers?.some((follower) => follower.username === user?.id) ?? false
        )
      } catch (err) {
        console.error('Failed to load other profile:', err)
        setError('Unable to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
    // getToken's identity changes on every Clerk render; excluding it keeps
    // this effect from re-fetching in an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, user?.id])

  async function handleFollowPress() {
    if (!profileId || followBusy) return
    setFollowBusy(true)
    try {
      const result = await followUser(profileId, authPost)
      setIsFollowing(result.following)
      setFollowersCount(result.followers_count)
    } catch (err) {
      console.error('Failed to toggle follow:', err)
    } finally {
      setFollowBusy(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.page}>
        <SignedIn>
          <ThemedText style={styles.heading}>
            {profile?.user.username ?? 'Profile'}
          </ThemedText>

          {profile?.user.imageUrl ? (
            <Image source={{ uri: profile.user.imageUrl }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text>No image</Text>
            </View>
          )}

          <ThemedText style={styles.subheading}>
            {numLogs} Logs · {numEssays} Essays · {followersCount} Followers
          </ThemedText>

          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followButtonActive]}
            onPress={handleFollowPress}
            disabled={followBusy}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={userLogs}
            keyExtractor={(item) => item.public_id}
            renderItem={({ item }) => (
              <View style={styles.logCard}>
                <ThemedText style={styles.logTitle}>{item.essay_details.title ?? 'Untitled'}</ThemedText>
                {item.review_text ? <ThemedText style={styles.logText}>{item.review_text}</ThemedText> : null}
                <ThemedText style={styles.logMeta}>{item.owner}</ThemedText>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.statusText}>No logs available for this profile.</Text>
            }
            contentContainerStyle={styles.listContent}
          />
        </SignedIn>

        <SignedOut>
          <Text style={styles.statusText}>Please sign in to view this profile.</Text>
        </SignedOut>

        <SignOutButton />
      </ThemedView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  page: {
    flex: 1,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  followButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  followButtonActive: {
    backgroundColor: '#334155',
  },
  followButtonText: {
    fontWeight: '700',
    color: '#334155',
  },
  followButtonTextActive: {
    color: '#ffffff',
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  logText: {
    marginBottom: 8,
    color: '#475569',
  },
  logMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  statusText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    marginTop: 32,
  },
})