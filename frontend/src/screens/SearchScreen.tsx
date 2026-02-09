import React, { useState } from 'react';
import { SearchBar } from '@rneui/themed';
import { View, Text, StyleSheet, TouchableOpacity  } from 'react-native';
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
type SearchBarComponentProps = {};
/** if id is null create new video object in database when logging 
 *  
 * 
*/
const SwitchComponent: React.FunctionComponent<SearchBarComponentProps> = () => {
const {convertYouTubeResultToVideoEssay} = useVideoApi();
const [search, setSearch] = useState("");
const [videos, setVideos] = useState<VideoEssay[]>([]);
const [loading, setLoading] = useState(true);
const [database, setDatabase] = useState<SearchResult[]>([]);

const updateSearch = async (search: string) => {
  setSearch(search);
  const data = await searchDataBase(search)
  setDatabase(data)
    
};
console.log("search: ", search);

return (
  <SafeAreaProvider>
    <SafeAreaView>
   
    <SearchBar
        placeholder="Type Here..."
        onSubmitEditing={() => updateSearch(search)}
        value={search}
        onChangeText = {setSearch}
        />
    <FlatList
  data={database}
  keyExtractor={(item, index) =>
    item.source === "database"
      ? item.video.public_id.toString()
      : `api-${index}`
  }
  renderItem={({ item }) => (
    <TouchableOpacity
    onPress={async () => {
      if (item.source === "database") {
        router.push({
          pathname: "/logVideoModal",
          params: { essayId: item.video.public_id },
        });
      } else {
        console.log(item.source)
        const result = await convertYouTubeResultToVideoEssay(item.video);
        console.log("results: ", result);
        console.log("results source", result.source)
        console.log("result.video ", result.video)
        console.log("result video id ", result.video.public_id)
        router.push({
          pathname: "/logVideoModal",
          params: {
            essayId: result.video.public_id,
          },
        });
      }
    }}
  >
      <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
        {item.video.title}
      </ThemedText>

      {item.source === "api" && (
        <Text style={{ opacity: 0.6, fontSize: 12 }}>
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
view: {
  margin: 10,
},
});

export default SwitchComponent;