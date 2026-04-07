import { useEffect, useState } from "react";
import { View, Text, FlatList, Image } from "react-native";
import { fetchLogs } from "../api/logs";
import { Log } from "../types/log";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from '@clerk/clerk-expo'
export default function LogListScreen() {
  // Holds data returned from the API
  const [logs, setlogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const {getToken} = useAuth(); 
  // Runs once when the screen loads
  useEffect(() => {
    async function loadLogs() {
      try {
        const token = await getToken();
        console.log("token: ", token);
        console.log("load videos function")
        const data = await fetchLogs(token!);
        console.log(data.results)
        setlogs(data.results);
        console.log("set videos: ", data);
      } catch (error) {
        console.error("Failed to load videos:", error);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
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
            {item.owner.user.id}
          </ThemedText>
          {item.essay_details.title && (
              <ThemedText> 
              {item.essay_details.title}
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
