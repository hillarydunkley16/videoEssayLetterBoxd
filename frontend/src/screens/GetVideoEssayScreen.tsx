import { View, Text, Image, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Platform } from 'react-native'
import { getAVideoEssay } from '../api/videos'
import { VideoEssay } from '../types/videoEssay'
import { useEffect, useState } from 'react'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@clerk/clerk-expo'

type Props = {
  id: string; 
  onTitleLoaded? : (title: string) => void;
}

export default function GetVideoEssayScreen({ id,  onTitleLoaded}: Props) {
  const [video, setVideo] = useState<VideoEssay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken } = useAuth()

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

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />
  if (error) return <Text>{error}</Text>
  if (!video) return <Text>Video not found</Text>

  return (
    <ThemedView style={styles.container}>
      {video.thumbnail ? (
        <TouchableOpacity onPress={() => Linking.openURL(video.youtube_url)}>
          <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
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
    maxWidth: 350,
    alignItems: 'flex-start',
    gap: 12,
    ...Platform.select({
      web: {
        width: 350,
      },
    }),
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 2.25 / 1.25,
    borderRadius: 12,
    ...Platform.select({
      web: {
        width: 350,
        height: 233,
      },
    }),
  },
})