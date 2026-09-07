export interface EnvironmentVariables {
    SERPAPI_KEY: string;
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    // Deployed backend root URL, e.g. https://videoessay-backend.onrender.com
    // Unset -> src/api/client.ts falls back to local-network discovery.
    EXPO_PUBLIC_API_BASE_URL: string;
}

const env = process.env as unknown as EnvironmentVariables;