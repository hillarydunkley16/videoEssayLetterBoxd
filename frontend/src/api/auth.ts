// api/auth.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

export async function login(username: string, password: string) {
  const response = await axios.post("http://127.0.0.1:8000/api/login/", {
    username,
    password,
  });

  await SecureStore.setItemAsync("authToken", response.data.token);
  return response.data;
}
