import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  useColorScheme,
  FlatList,
  Image,
} from 'react-native';
import { searchDataBase, callSerpAPI, useVideoApi } from "../api/videos";
import { SearchResult } from '../types/youtubeResult';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Colors, Fonts } from '@/constants/theme';

type SearchBarComponentProps = Record<string, never>;

// Minimum column width a result tile is allowed to shrink to before the
// grid drops another column — keeps thumbnails a legible 16:9 box instead
// of stretching a single full-width card (the old bug on wide web viewports).
const MIN_TILE_WIDTH = 220;
const PAGE_PADDING = 16;
const ROW_GAP = 16;

// How long to wait after the last keystroke before filtering the DB, so
// typing doesn't fire a request per character.
const DB_FILTER_DEBOUNCE_MS = 250;

/** if id is null create new video object in database when logging
 *
 *
*/
const SwitchComponent: React.FunctionComponent<SearchBarComponentProps> = () => {
// WebNav's top-nav search bar is the only search input now (see WebNav.tsx) —
// it lives outside this screen's render tree, so it hands typed text down
// via the `q` route param and signals "run the full API search" via a
// `submittedAt` param bump (set on Enter), rather than this screen owning
// its own text field.
const { q: initialQuery, submittedAt, mode } = useLocalSearchParams<{ q?: string; submittedAt?: string; mode?: string }>();
// `mode=log` comes from the mobile Log tab: picking a result opens the quick-log
// sheet instead of the full log modal.
const isLogMode = mode === 'log';
const logPathname = isLogMode ? "/quickLog" : "/logVideoModal";
const {convertYouTubeResultToVideoEssay} = useVideoApi();
const [search, setSearch] = useState(initialQuery ?? "");
const [loading, setLoading] = useState(false);
const [database, setDatabase] = useState<SearchResult[]>([]);
const {getToken} = useAuth();
const { width } = useWindowDimensions();
const theme = Colors[useColorScheme() ?? 'light'];
const numColumns = Math.max(1, Math.floor(width / MIN_TILE_WIDTH));
// Fixed per-column width (instead of flex: 1) so a lone result in the last row
// keeps normal tile size rather than stretching across the whole page.
const tileWidth = numColumns > 1
    ? (width - PAGE_PADDING * 2 - ROW_GAP * (numColumns - 1)) / numColumns
    : undefined;

// Guards against a slow request from an earlier keystroke/submit clobbering
// the result of a newer one that finished first.
const requestIdRef = useRef(0);

// Keep local state synced to the URL param as WebNav updates it on every
// keystroke, so the debounced DB filter below keeps firing while typing.
useEffect(() => {
    setSearch(initialQuery ?? "");
}, [initialQuery]);

// Typing filters the DB only (debounced) — cheap and instant. Hitting enter
// is what reaches out to YouTube, since that's the slow/rate-limited call.
useEffect(() => {
    const query = search.trim();
    if (!query) {
        requestIdRef.current += 1;
        setDatabase([]);
        setLoading(false);
        return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
        let dbResults: SearchResult[] = [];
        try {
            const token = await getToken();
            if (token) {
                dbResults = (await searchDataBase(query, token)) ?? [];
            }
        } catch (err) {
            console.warn("database search failed", err);
        }
        if (requestIdRef.current !== requestId) return;
        setDatabase(dbResults);
        setLoading(false);
    }, DB_FILTER_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // getToken (Clerk's useAuth()) is a new function identity every render,
    // not a stable callback — depending on it here re-fires this effect on
    // every state update the debounced search itself causes, so it never
    // actually stops re-searching. It's read fresh from the closure either way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [search]);

const runFullSearch = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);

    // Existing video essays (needs auth) and a YouTube search run independently
    // so one failing doesn't take out the other.
    let dbResults: SearchResult[] = [];
    try {
        const token = await getToken();
        if (token) {
            dbResults = (await searchDataBase(query, token)) ?? [];
        }
    } catch (err) {
        console.warn("database search failed", err);
    }

    let ytResults: SearchResult[] = [];
    try {
        ytResults = await callSerpAPI(query);
    } catch (err) {
        console.warn("youtube search failed", err);
    }

    if (requestIdRef.current !== requestId) return;

    const seenTitles = new Set(
        dbResults.map((r) => (r.video.title ?? "").toLowerCase())
    );
    const merged = [
        ...dbResults,
        ...ytResults.filter(
            (r) => !seenTitles.has((r.video.title ?? "").toLowerCase())
        ),
    ];
    setDatabase(merged);
    setLoading(false);
};

// WebNav bumps `submittedAt` (a timestamp) when the user presses Enter in
// the top-nav search bar — that's the only thing that should trigger the
// slower DB + YouTube search; plain typing only drives the debounced
// DB-only filter above.
const lastSubmitRef = useRef<string | undefined>(undefined);
useEffect(() => {
    if (submittedAt && submittedAt !== lastSubmitRef.current) {
        lastSubmitRef.current = submittedAt;
        runFullSearch(initialQuery ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [submittedAt]);

return (
  <SafeAreaProvider>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {search.trim() ? (
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            <Text style={{ color: theme.text, fontFamily: Fonts?.sansSemiBold }}>{database.length}</Text>
            {" "}result{database.length === 1 ? "" : "s"} for &ldquo;{search.trim()}&rdquo;
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={database}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          keyExtractor={(item, index) =>
            item.source === "database"
              ? item.video.public_id.toString()
              : `api-${index}`
          }
          ListEmptyComponent={() => (
            <Text style={[styles.emptyText, { color: theme.muted, fontFamily: Fonts?.sans }]}>
              {search.trim()
                ? 'No results found'
                : isLogMode
                ? 'Search for the essay you want to log'
                : 'Search for video essays by title. Press enter to search YouTube.'}
            </Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tile, tileWidth ? { width: tileWidth } : styles.tileSingleColumn]}
              onPress={async () => {
                if (item.source === "database") {
                  router.push({
                    pathname: logPathname,
                    params: { essayId: item.video.public_id },
                  });
                } else {
                  const result = await convertYouTubeResultToVideoEssay(item.video);
                  if (result.source === 'database') {
                    router.push({
                      pathname: logPathname,
                      params: {
                        essayId: result.video.public_id,
                      },
                    });
                  }
                }
              }}
            >
              <View style={[styles.thumbWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                {item.video.thumbnail ? (
                  <Image source={{ uri: item.video.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbnail, { backgroundColor: theme.surface }]} />
                )}
                {item.source === "database" ? (
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>LOGGED</Text>
                  </View>
                ) : null}
                {item.video.duration ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.video.duration}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.resultTitle, { color: theme.text, fontFamily: Fonts?.sansMedium }]}
                numberOfLines={2}
              >
                {item.video.title}
              </Text>
              <Text style={[styles.sourceText, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                {item.source === "api" ? "from YouTube" : item.video.channel_name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  </SafeAreaProvider>
);
};

const styles = StyleSheet.create({
safeArea: {
  flex: 1,
  paddingHorizontal: 16,
  paddingTop: 16,
},
metaRow: {
  paddingVertical: 12,
},
metaText: {
  fontSize: 13,
},
loading: {
  marginTop: 32,
},
listContent: {
  paddingBottom: 24,
  paddingTop: 4,
},
row: {
  gap: ROW_GAP,
},
tile: {
  marginBottom: 22,
  maxWidth: '100%',
},
tileSingleColumn: {
  width: '100%',
  maxWidth: 480,
},
thumbWrap: {
  width: '100%',
  aspectRatio: 16 / 9,
  borderRadius: 2,
  overflow: 'hidden',
  borderWidth: 1,
},
thumbnail: {
  width: '100%',
  height: '100%',
},
sourceBadge: {
  position: 'absolute',
  left: 6,
  top: 6,
  backgroundColor: 'rgba(20,21,26,0.78)',
  borderRadius: 2,
  paddingHorizontal: 6,
  paddingVertical: 2,
},
sourceBadgeText: {
  color: '#F1F1EE',
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 0.3,
},
durationBadge: {
  position: 'absolute',
  right: 6,
  bottom: 6,
  backgroundColor: 'rgba(20,21,26,0.78)',
  borderRadius: 2,
  paddingHorizontal: 4,
  paddingVertical: 1,
},
durationText: {
  color: '#F1F1EE',
  fontSize: 11,
  fontVariant: ['tabular-nums'],
},
resultTitle: {
  fontSize: 13,
  lineHeight: 17,
  marginTop: 10,
},
sourceText: {
  fontSize: 12,
  marginTop: 3,
},
emptyText: {
  textAlign: 'center',
  marginTop: 32,
  fontSize: 15,
},
});

export default SwitchComponent;
