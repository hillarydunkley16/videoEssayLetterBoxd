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
    <Text>{item.username}</Text>
    )}
  />
  );
}

