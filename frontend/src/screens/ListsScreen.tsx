import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, useColorScheme, View } from "react-native";
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
// so it's fetched from there and always pinned above the user-created lists
// — including for a brand-new user who hasn't made any lists yet.
export default function ListsScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [watchlist, setWatchlist] = useState<Collection | null>(null);
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
      setWatchlist({ ...profileData.watchList, description: "", is_watchlist: true });
      setLists(collectionsPage.results.filter((c: Collection) => c.public_id !== profileData.watchList.public_id));
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
        numColumns={2}
        columnWrapperStyle={lists.length > 0 ? listsGridStyles.row : undefined}
        ListHeaderComponent={
          <View>
            {header}
            {watchlist ? (
              <View style={[listsGridStyles.row, styles.watchlistRow]}>
                <ListCard list={watchlist} theme={theme} />
              </View>
            ) : null}
            <NewListButton theme={theme} style={styles.newListSpacing} />
          </View>
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<ListsEmptyState theme={theme} />}
        renderItem={({ item }) => <ListCard list={item} theme={theme} />}
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
  watchlistRow: {
    marginTop: 4,
  },
});
