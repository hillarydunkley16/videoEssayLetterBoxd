import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Image, Pressable, TouchableOpacity, TextInput, Button, } from "react-native";
import { fetchUsers } from "../api/users";
import { User} from "../types/user";
import {Link} from "@react-navigation/native";
import {router} from 'expo-router';
export default function UserListScreen() {
  // Holds data returned from the API
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
    
  // Runs once when the screen loads
  useEffect(() => {
    async function loadVideos() {
      try {
        console.log("load videos function")
        const data = await fetchUsers();
        console.log(data.results)
        setUsers(data.results);
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
    return <ActivityIndicator size="large" color="#0000ff" />;
  }


  return (

    <FlatList
    data={users}
    horizontal
    keyExtractor={(item) => item.id.toString()}
    renderItem={({ item }) => (
    //   <TouchableOpacity onPress={() => router.push(`/modal?essayId=${item.id}`)}>
    //       <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
    //       <View style={{ padding: 12 }}>
    //     {item.thumbnail && (
    //       <Image
    //         source={{ uri: item.thumbnail }}
    //         style={{ width: "100%", height: 180 }}
    //       />
    //     )}

    //     <Text style={{ fontWeight: "bold", marginTop: 8 }}>
    //       {item.title}
    //     </Text>

    //     {item.channel_name && (
    //       <Text>{item.channel_name}</Text>
    //     )}
    //   </View>
    //   </TouchableOpacity>
        <Text>{item.username}</Text>
    )}
  />
  );
}

