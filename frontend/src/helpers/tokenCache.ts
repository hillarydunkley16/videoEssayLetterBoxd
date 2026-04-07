// src/helpers/tokenCache.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const tokenCache = {
    async getToken(key: string) {
        try {
            return Platform.OS !== 'web' 
                ? await SecureStore.getItemAsync(key)
                : null;
        } catch {
            return null;
        }
    },
    async saveToken(key: string, value: string) {
        try {
            if (Platform.OS !== 'web') {
                await SecureStore.setItemAsync(key, value);
            }
        } catch (err) {
            console.error('SecureStore error:', err);
        }
    },
    async clearToken(key: string) {
        try {
            if (Platform.OS !== 'web') {
                await SecureStore.deleteItemAsync(key);
            }
        } catch (err) {
            console.error('SecureStore error:', err);
        }
    }
};