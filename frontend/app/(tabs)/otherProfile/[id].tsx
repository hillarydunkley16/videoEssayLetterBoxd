import { ThemedView } from '@/components/themed-view'
import { RatingDots } from '@/components/ui/RatingDots'
import { Colors, Fonts } from '@/constants/theme'
import { SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-expo'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { Log } from '@/src/types/log'
import { fetchAProfileById, followUser } from '@/src/api/users'
import { useAuthPost } from '@/src/api/authPost'
import { Profile } from '@/src/types/profile'
import { router, useLocalSearchParams } from 'expo-router'

type Theme = (typeof Colors)['light']

function formatShortDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Page() {
  const theme = Colors[(useColorScheme() ?? 'light') as 'light' | 'dark']
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const profileId = rawId ? Number(rawId) : undefined

  const { getToken } = useAuth()
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
  const [followingCount, setFollowingCount] = useState(0)
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
        setFollowersCount(profileData.followers_count)
        setFollowingCount(profileData.following_count)
        setIsFollowing(profileData.is_following)
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

  function openFollowList(tab: 'followers' | 'following') {
    router.push({ pathname: '/followList', params: { userId: String(profileId), tab } })
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={theme.accent} style={styles.center} />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={[styles.status, { color: theme.muted, fontFamily: Fonts?.sans }]}>{error}</Text>
      </SafeAreaView>
    )
  }

  const username = profile?.user.username ?? 'Profile'

  const header = (
    <View>
      <View style={[styles.identity, { borderColor: theme.border }]}>
        <View style={styles.idRow}>
          {profile?.user.imageUrl ? (
            <Image source={{ uri: profile.user.imageUrl }} style={[styles.avatar, { borderColor: theme.background }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.idText}>
            <Text
              style={[styles.displayName, { color: theme.text, fontFamily: Fonts?.displayMedium }]}
              numberOfLines={1}
            >
              {username}
            </Text>
            <Text style={[styles.handle, { color: theme.muted, fontFamily: Fonts?.sans }]}>@{username}</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="follow-button"
          style={[
            styles.followButton,
            isFollowing
              ? { borderColor: theme.border, backgroundColor: 'transparent' }
              : { borderColor: theme.accent, backgroundColor: theme.accent },
            followBusy && styles.followButtonBusy,
          ]}
          onPress={handleFollowPress}
          disabled={followBusy}
        >
          <Text
            style={[
              styles.followButtonText,
              { color: isFollowing ? theme.text : '#fff', fontFamily: Fonts?.sansSemiBold },
            ]}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.statsRow, { borderColor: theme.border }]}>
          <Stat n={numLogs} label="Logs" theme={theme} />
          <Stat n={numEssays} label="Essays" theme={theme} />
          <Stat
            n={followersCount}
            label="Followers"
            theme={theme}
            testID="followers-count"
            onPress={() => openFollowList('followers')}
          />
          <Stat
            n={followingCount}
            label="Following"
            theme={theme}
            testID="following-count"
            onPress={() => openFollowList('following')}
            isLast
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
        Logs <Text style={{ fontFamily: Fonts?.sans }}>{numLogs}</Text>
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.page}>
        <SignedIn>
          <FlatList
            data={userLogs}
            keyExtractor={(item) => item.public_id}
            ListHeaderComponent={header}
            renderItem={({ item }) => <LogRow log={item} theme={theme} />}
            ListEmptyComponent={
              <Text style={[styles.status, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                No logs yet.
              </Text>
            }
            contentContainerStyle={styles.listContent}
          />
        </SignedIn>

        <SignedOut>
          <Text style={[styles.status, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            Please sign in to view this profile.
          </Text>
        </SignedOut>
      </ThemedView>
    </SafeAreaView>
  )
}

function Stat({
  n,
  label,
  theme,
  isLast,
  onPress,
  testID,
}: {
  n: number
  label: string
  theme: Theme
  isLast?: boolean
  onPress?: () => void
  testID?: string
}) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper
      testID={testID}
      style={[styles.stat, !isLast && { borderColor: theme.border, borderRightWidth: StyleSheet.hairlineWidth }]}
      {...(onPress ? { onPress } : {})}
    >
      <Text style={[styles.statN, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>{n}</Text>
      <Text style={[styles.statLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>{label}</Text>
    </Wrapper>
  )
}

function LogRow({ log, theme }: { log: Log; theme: Theme }) {
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => router.push(`/videoInfo?essayId=${log.essay_details.public_id}`)}>
        <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {log.essay_details.thumbnail ? (
            <Image source={{ uri: log.essay_details.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.body} onPress={() => router.push(`/singleLog?logId=${log.public_id}`)}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]} numberOfLines={1}>
            {log.essay_details.title ?? 'Untitled'}
          </Text>
          <RatingDots value={log.rating} size={11} />
        </View>
        {log.essay_details.channel_name ? (
          <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {log.essay_details.channel_name}
          </Text>
        ) : null}
        {log.review_text ? (
          <Text style={[styles.rowReview, { color: theme.text, fontFamily: Fonts?.sans }]} numberOfLines={2}>
            {log.review_text}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <Text style={[styles.rowDate, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {formatShortDate(log.date)}
          </Text>
          {log.rewatch ? (
            <Text style={[styles.pill, { color: theme.accent2, backgroundColor: `${theme.accent2}22` }]}>Rewatch</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  listContent: { paddingBottom: 32 },
  status: { fontSize: 15, textAlign: 'center', marginTop: 32, paddingHorizontal: 20 },
  identity: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, borderBottomWidth: 1 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 28, fontFamily: Fonts?.display },
  idText: { flex: 1, minWidth: 0 },
  displayName: { fontSize: 22 },
  handle: { fontSize: 13, marginTop: 2 },
  followButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 18,
  },
  followButtonBusy: { opacity: 0.6 },
  followButtonText: { fontSize: 14 },
  statsRow: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: 18 },
  statLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumbWrap: { width: 96, aspectRatio: 16 / 9, borderRadius: 2, overflow: 'hidden', borderWidth: 1 },
  thumbnail: { width: '100%', height: '100%' },
  body: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 14, flex: 1 },
  rowChannel: { fontSize: 12 },
  rowReview: { fontSize: 13, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowDate: { fontSize: 11 },
  pill: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
})
