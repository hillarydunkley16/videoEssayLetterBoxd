import { View, Text, Image, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, useColorScheme } from 'react-native'
import { getAVideoEssay } from '../api/videos'
import { VideoEssay } from '../types/videoEssay'
import { useEffect, useState } from 'react'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@clerk/clerk-expo'
import { Colors, Fonts } from '@/constants/theme'

type Props = {
  id: string;
  onTitleLoaded? : (title: string) => void;
  // Small horizontal reference row (thumb + title) for log-creation flows,
  // instead of the full vertical detail card.
  compact?: boolean;
}

export default function GetVideoEssayScreen({ id, onTitleLoaded, compact }: Props) {
  const [video, setVideo] = useState<VideoEssay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken } = useAuth()
  const theme = Colors[useColorScheme() ?? 'light']

  useEffect(() => {
    if (!id) return

    let active = true
    async function loadVideo() {
      try {
        const token = await getToken()
        if (!active) return
        const data = await getAVideoEssay(id, token!)

        setVideo(data.video)
        onTitleLoaded?.(data.video.title);
      } catch (err) {
        console.error('GetVideoEssayScreen error:', err)
        setError('Failed to load video')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadVideo()
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <ActivityIndicator size="large" color={theme.accent} />
  if (error) return <Text style={{ color: theme.text }}>{error}</Text>
  if (!video) return <Text style={{ color: theme.text }}>Video not found</Text>

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <View style={[styles.compactThumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {video.thumbnail ? (
            <Image source={{ uri: video.thumbnail }} style={styles.fillThumb} resizeMode="cover" />
          ) : null}
          {video.duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{video.duration}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.compactMeta}>
          <Text
            style={[styles.compactTitle, { color: theme.text, fontFamily: Fonts?.displayMedium }]}
            numberOfLines={2}
          >
            {video.title}
          </Text>
          {video.channel_name ? (
            <Text style={[styles.compactSub, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              {video.channel_name}
            </Text>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <ThemedView style={styles.container}>
      {video.thumbnail ? (
        <TouchableOpacity onPress={() => Linking.openURL(video.youtube_url)} style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Image source={{ uri: video.thumbnail }} style={styles.fillThumb} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      <ThemedText style={{ fontWeight: 'bold', marginTop: 8 }}>{video.title}</ThemedText>
      {video.channel_name ? <ThemedText>{video.channel_name}</ThemedText> : null}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'flex-start',
    gap: 12,
  },
  // Fixed aspect ratio instead of a hardcoded web height, so the image
  // never stretches regardless of viewport width (same fix as the search
  // grid and RecentLogsScreen thumbnails).
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fillThumb: {
    width: '100%',
    height: '100%',
  },
  compactRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    width: '100%',
  },
  compactThumbWrap: {
    width: 104,
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    flexShrink: 0,
    position: 'relative',
  },
  compactMeta: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  compactTitle: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  compactSub: {
    fontSize: 12,
  },
  durationBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    backgroundColor: 'rgba(20,21,26,0.78)',
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  durationText: {
    color: '#F1F1EE',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
})
