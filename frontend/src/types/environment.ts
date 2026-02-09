export interface EnvironmentVariables {
    SERPAPI_KEY: string; 
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
}

const env = process.env as unknown as EnvironmentVariables;