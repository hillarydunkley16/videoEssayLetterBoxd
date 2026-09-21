import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { ListCard, ListsEmptyState, NewListButton, listsGridStyles } from "@/components/ui/ListsGrid";
import { fetchUsersCollections } from "@/src/api/collection";
import { fetchProfile } from "@/src/api/users";
import { Collection, PaginatedCollections } from "@/src/types/collection";

// The dedicated "Your Lists" page for the logged-in user — reachable from
// WebNav's "Lists" link and from the Profile screen's "Lists" tab button.
// Fetches its own collections rather than depending on ProfileScreen's
// profile load. The watchlist is auto-provisioned on the profile response
// (see ProfileSerializer.get_watchList) rather than on `/collections/user/`,
// so it's fetched from there and always shown as the first tile — including
// for a brand-new user who hasn't made any lists yet.
const MAX_CONTENT_WIDTH = 1000;
const MIN_CARD_WIDTH = 200;
const GUTTER = 20;
const GAP = 12;

export default function ListsScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);
  const numColumns = Math.max(2, Math.floor((contentWidth - GUTTER * 2 + GAP) / (MIN_CARD_WIDTH + GAP)));
  const cardWidth = Math.floor((contentWidth - GUTTER * 2 - GAP * (numColumns - 1)) / numColumns);
  const theme = Colors[useColorScheme() ?? "light"];
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [lists, setLists] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLists = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [profileData, collectionsPage] = await Promise.all([
        fetchProfile(token),
        fetchUsersCollections(token) as Promise<PaginatedCollections>,
      ]);
      const watchlist: Collection = { ...profileData.watchList, description: "", is_watchlist: true };
      // Watchlist is the first tile in the grid, so "New list" stays above all lists.
      setLists([
        watchlist,
        ...collectionsPage.results.filter((c: Collection) => c.public_id !== watchlist.public_id),
      ]);
    } catch (error) {
      console.error("Failed to load lists:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadLists();
  }, [isLoaded, isSignedIn, loadLists]);

  const header = (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.displayMedium }]}>Your Lists</Text>
          <Text style={[styles.subtitle, { color: theme.muted, fontFamily: Fonts?.sans }]}>
            Essays you&apos;ve grouped together — a rabbit hole, a double feature, a shelf for later.
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color={theme.accent} style={styles.loading} />;
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={lists}
        keyExtractor={(item) => item.public_id}
        key={`lists-${numColumns}`}
        numColumns={numColumns}
        columnWrapperStyle={lists.length > 0 ? listsGridStyles.row : undefined}
        ListHeaderComponent={
          <View>
            {header}
            <NewListButton theme={theme} style={styles.newListSpacing} />
          </View>
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<ListsEmptyState theme={theme} />}
        renderItem={({ item }) => <ListCard list={item} theme={theme} width={cardWidth} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
  },
  newListSpacing: {
    marginTop: 16,
  },
});
