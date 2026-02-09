import { useEffect, useState } from "react";
import { View, Text, FlatList, Image } from "react-native";
import { fetchLogs } from "../api/logs";
import { Log } from "../types/log";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
export default function LogListScreen() {
  // Holds data returned from the API
  const [logs, setlogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  // Runs once when the screen loads
  useEffect(() => {
    async function loadVideos() {
      try {
        console.log("load videos function")
        const data = await fetchLogs();
        console.log(data.results)
        setlogs(data.results);
        console.log("set videos: ", data);
      } catch (error) {
        console.error("Failed to load videos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, []);

  if (loading) {
    return <Text>Loading…</Text>;
  }


  return (
    <ThemedView> 
      {logs.length == 0 ? (
        <ThemedText>No logs yet...</ThemedText>
      ): 
      <FlatList
      data={logs}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <ThemedView style={{ padding: 12 }}>

          <ThemedText style={{ fontWeight: "bold", marginTop: 8 }}>
            {item.owner.username}
          </ThemedText>
          {item.essay.title && (
              <ThemedText> 
              {item.essay.title}
              </ThemedText>
          )}
          

          {item.review_text && (
            <ThemedText>{item.review_text}</ThemedText>
          )}
        </ThemedView>
      )}
    />
    }
       
    </ThemedView>
    
  );
}
// {logs.length == 0 ? (
//   <ThemedText>No logs yet...</ThemedText>
// ):<FlatList 
// data = {logs}
// keyExtractor={(item) => item.id.toString()}
// renderItem={({item}) => (
//   <>
//   <ThemedText>{item.date?.toString()}</ThemedText>
//   <ThemedText>{item.owner?.toString()}</ThemedText>
//   <ThemedText>{item.review_text}</ThemedText>
//   </>
// )}
// /> } 
