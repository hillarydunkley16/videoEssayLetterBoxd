import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { Colors, Fonts } from '@/constants/theme'
import { fetchACollection, removeFromWatchlist, deleteCollection } from '@/src/api/collection'
import { useAuthDelete } from '@/src/api/authDelete'
import { Collection } from '@/src/types/collection'
import { VideoEssay } from '@/src/types/videoEssay'

export default function CollectionInfo({ public_id }: { public_id: string }) {
  const theme = Colors[useColorScheme() ?? 'light']
  const { getToken } = useAuth()
  const authDelete = useAuthDelete()

  const [collection, setCollection] = useState<Collection>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!public_id) return
    try {
      const token = await getToken()
      const data = await fetchACollection(public_id, token!)
      setCollection(data)
    } catch (err) {
      console.error(`Load collection error: ${err}`)
      setError('Failed to load this list.')
    } finally {
      setLoading(false)
    }
    // getToken's identity changes on every Clerk render; excluding it keeps
    // this callback (and the mount effect below) stable across re-renders
    // instead of re-fetching in an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [public_id])

  // Reload on focus so essays added from the addEssayToList modal show up.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  function handleBack() {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }

  const isOwner = !!collection?.is_owner

  async function handleRemoveEssay(essayPublicId: string) {
    if (!collection || removingId) return
    setRemovingId(essayPublicId)
    try {
      await removeFromWatchlist(essayPublicId, collection.public_id, authDelete)
      setCollection((current) =>
        current ? { ...current, essays: current.essays.filter((e) => e.public_id !== essayPublicId) } : current
      )
    } catch (err) {
      console.error('Failed to remove essay from list:', err)
    } finally {
      setRemovingId(null)
    }
  }

  async function handleDeleteList() {
    if (!collection || deleting) return
    setDeleting(true)
    try {
      await deleteCollection(collection.public_id, authDelete)
      handleBack()
    } catch (err) {
      console.error('Failed to delete list:', err)
      setDeleting(false)
    }
  }

  if (loading) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />
  }
  if (error || !collection) {
    return <Text style={[styles.error, { color: theme.text }]}>{error ?? 'List not found.'}</Text>
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topnav, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={handleBack} accessibilityLabel="Back" style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: theme.text }]}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={collection.essays}
        keyExtractor={(item) => item.public_id}
        contentContainerStyle={styles.listContent}
        style={styles.page}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>
              {collection.name}
            </Text>
            {collection.description ? (
              <Text style={[styles.description, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                {collection.description}
              </Text>
            ) : null}
            <Text style={[styles.meta, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              By {collection.owner} · {collection.essays.length}{' '}
              {collection.essays.length === 1 ? 'essay' : 'essays'}
            </Text>
            {isOwner ? (
              <TouchableOpacity
                style={[styles.addEssayBtn, { backgroundColor: theme.accent }]}
                onPress={() => router.push(`/addEssayToList?publicId=${collection.public_id}`)}
              >
                <Text style={[styles.addEssayText, { fontFamily: Fonts?.sansSemiBold }]}>+ Add essay</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            Nothing here yet — add an essay above or from its page.
          </Text>
        }
        ListFooterComponent={
          isOwner && !collection.is_watchlist ? (
            <TouchableOpacity
              style={[styles.deleteListBtn, { borderColor: theme.border, opacity: deleting ? 0.6 : 1 }]}
              onPress={handleDeleteList}
              disabled={deleting}
            >
              <Text style={[styles.deleteListText, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>
                {deleting ? 'Deleting…' : 'Delete list'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <EssayRow
            essay={item}
            theme={theme}
            canRemove={isOwner}
            removing={removingId === item.public_id}
            onRemove={() => handleRemoveEssay(item.public_id)}
          />
        )}
      />
    </View>
  )
}

function EssayRow({
  essay,
  theme,
  canRemove,
  removing,
  onRemove,
}: {
  essay: VideoEssay
  theme: (typeof Colors)['light']
  canRemove: boolean
  removing: boolean
  onRemove: () => void
}) {
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <TouchableOpacity
        style={styles.rowTouch}
        onPress={() => router.push(`/videoInfo?essayId=${essay.public_id}`)}
      >
        <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {essay.thumbnail ? (
            <Image source={{ uri: essay.thumbnail }} style={styles.thumbnail} />
          ) : null}
        </View>
        <View style={styles.body}>
          <Text
            style={[styles.rowTitle, { color: theme.text, fontFamily: Fonts?.sansSemiBold }]}
            numberOfLines={2}
          >
            {essay.title}
          </Text>
          <Text style={[styles.rowChannel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            {essay.channel_name}
          </Text>
        </View>
      </TouchableOpacity>
      {canRemove ? (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} disabled={removing}>
          <Text style={{ color: theme.muted, fontSize: 16 }}>{removing ? '…' : '×'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
  error: {
    flex: 1,
    textAlign: 'center',
    marginTop: 32,
  },
  topnav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 26,
    lineHeight: 26,
  },
  page: {
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 480,
        alignSelf: 'center',
      },
    }),
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
  },
  addEssayBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 3,
    alignItems: 'center',
  },
  addEssayText: {
    color: '#fff',
    fontSize: 13,
  },
  empty: {
    fontSize: 13,
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowTouch: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  thumbWrap: {
    width: 96,
    aspectRatio: 16 / 9,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  rowTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  rowChannel: {
    fontSize: 12,
  },
  removeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteListBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 3,
    alignItems: 'center',
  },
  deleteListText: {
    fontSize: 13,
  },
})
