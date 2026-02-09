import * as SecureStore from "expo-secure-store";
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzY5NDQyNzYxLCJpYXQiOjE3Njk0MzkxNjEsImp0aSI6IjExOGJhNzgwYmRlNzQyMWVhNDFlZjQ5Yzk0MTY3ZGFiIiwidXNlcl9pZCI6IjEifQ.RYIy1PLoJ0vml2LAdcjrbYDkILc4rKW75kc8hRJ9PM4";
const REFRESH_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc2OTUyNTU2MSwiaWF0IjoxNzY5NDM5MTYxLCJqdGkiOiI0OGI4Zjg5OThmNDg0ZjM4ODQ2Mjg5NDdiNjUzMjFiMCIsInVzZXJfaWQiOiIxIn0.lIax12sJFgm0GK7RKnkpWEawYkLyMZ9bKQg9RZXtXew";

export async function setTokens({ access, refresh }) {
  try { 
    if (Platform.OS === 'web'){
      await AsyncStorage.setItem(ACCESS_KEY, access);
      await AsyncStorage.setItem(REFRESH_KEY, refresh);
    }else {
      await SecureStore.setItemAsync(ACCESS_KEY, access);
      await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    }
  } catch (error){
    console.error("Error saving data: ", error)
  }
  
}
export async function getAccessToken(){
  try{
    if (Platform.OS === 'web'){
      return await AsyncStorage.getItem(ACCESS_KEY)
    } else {
      return await SecureStore.getItemAsync(ACCESS_KEY);
    }
} catch (error) {
  console.error("Error retrieving data:", error);
}
}

export async function getRefreshToken(){
  try { 
    if (Platform.OS === 'web'){
      return await AsyncStorage.getItem(REFRESH_KEY)
    }else {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    }
  } catch (error) {
    console.error("Error retrieving data:", error);
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
