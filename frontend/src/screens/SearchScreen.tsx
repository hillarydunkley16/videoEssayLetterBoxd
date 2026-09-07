import React, { useState } from 'react';
import { SearchBar } from '@rneui/themed';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator  } from 'react-native';
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { searchDataBase} from "../api/videos";
import { VideoEssay } from '../types/videoEssay';
import { SearchResult } from '../types/youtubeResult';

import { FlatList } from 'react-native';
import { Link } from 'expo-router'
import {router, useLocalSearchParams} from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useVideoApi } from '../api/videos';
import { Image } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
type SearchBarComponentProps = {};
/** if id is null create new video object in database when logging 
 *  
 * 
*/
const SwitchComponent: React.FunctionComponent<SearchBarComponentProps> = () => {
const {convertYouTubeResultToVideoEssay} = useVideoApi();
const [search, setSearch] = useState("");
const [videos, setVideos] = useState<VideoEssay[]>([]);
const [loading, setLoading] = useState(false);
const [database, setDatabase] = useState<SearchResult[]>([]);
const {getToken} = useAuth(); 
const updateSearch = async (search: string) => {
    const token = await getToken();
    setSearch(search);
    setLoading(true);  // start loading
    try {
        const data = await searchDataBase(search, token!);
        setDatabase(data);
    } finally {
        setLoading(false);  // stop loading
    }
};
console.log("search: ", search);

{loading && <ActivityIndicator size="large" color="#0000ff" />}
return (

  <SafeAreaProvider>
    <SafeAreaView style={styles.safeArea}>
      <SearchBar
        placeholder="Search videos or logs"
        onSubmitEditing={() => updateSearch(search)}
        value={search}
        onChangeText={setSearch}
        containerStyle={styles.searchContainer}
        inputContainerStyle={styles.searchInputContainer}
        inputStyle={styles.searchInput}
        lightTheme
      />
      <FlatList
        data={database}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item, index) =>
          item.source === "database"
            ? item.video.public_id.toString()
            : `api-${index}`
        }
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {search.trim() ? 'No results found' : 'Search for video essays by title'}
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultCard}
            onPress={async () => {
              if (item.source === "database") {
                router.push({
                  pathname: "/logVideoModal",
                  params: { essayId: item.video.public_id },
                });
              } else {
                const result = await convertYouTubeResultToVideoEssay(item.video);
                if (result.source === 'database') {
                  router.push({
                    pathname: "/logVideoModal",
                    params: {
                      essayId: result.video.public_id,
                    },
                  });
                }
              }
            }}
          >
            <ThemedText style={styles.resultTitle}>
              {item.video.title}
            </ThemedText>
            {item.video.thumbnail && (
              <Image
                source={{ uri: item.video.thumbnail }}
                style={styles.thumbnail}
              />
            )}
            {item.source === "api" && (
              <Text style={styles.sourceText}>
                From YouTube
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  </SafeAreaProvider>
    
  
    
  
);
};

const styles = StyleSheet.create({
safeArea: {
  flex: 1,
  backgroundColor: '#f8fafc',
  paddingHorizontal: 16,
  paddingTop: 16,
},
searchContainer: {
  backgroundColor: 'transparent',
  paddingHorizontal: 0,
  paddingBottom: 12,
},
searchInputContainer: {
  backgroundColor: '#ffffff',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#d1d5db',
  height: 46,
},
searchInput: {
  fontSize: 16,
},
listContent: {
  paddingBottom: 24,
},
resultCard: {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
},
resultTitle: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 10,
},
thumbnail: {
  width: '100%',
  height: 200,
  borderRadius: 12,
  marginBottom: 10,
},
sourceText: {
  opacity: 0.7,
  fontSize: 12,
},
emptyText: {
  textAlign: 'center',
  color: '#6b7280',
  marginTop: 32,
  fontSize: 16,
},
});

export default SwitchComponent;