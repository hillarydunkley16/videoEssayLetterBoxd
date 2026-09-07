// api/auth.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./client";

export async function login(username: string, password: string) {
  const response = await axios.post(`${API_BASE_URL}/login/`, {
    username,
    password,
  });

  await SecureStore.setItemAsync("authToken", response.data.token);
  return response.data;
}
