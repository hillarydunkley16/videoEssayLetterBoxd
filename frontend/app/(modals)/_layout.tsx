import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopNav } from '@/components/ui/TopNav';
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
export default function Layout() {
    const theme = Colors[(useColorScheme() ?? 'light') as 'light' | 'dark'];
    return(
        <Stack>
            {/* <Stack.Screen
                name="index"
                
                options={{
                    header: () => <TopNav />,  // show TopNav on home screen
                }}
            /> */}
            <Stack.Screen
                name="modal"
                options={{
                    presentation: 'modal',
                    headerShown: true,
                    header: () => <TopNav />,
                    gestureEnabled: true,
                }}
            />
            <Stack.Screen
                name="logVideoModal"
                options={{
                    presentation: 'modal',
                    headerShown: false
                }}
            />
            
            <Stack.Screen 
                name="logs"
                options={{ 
                    presentation: 'card',
                    animation: "slide_from_right",
                    headerShown: true, 
                    header: () => <ReviewsTopNav />}}
            />
            <Stack.Screen
                name="singleLog"
                options={{
                    presentation: 'card',
                    animation: "slide_from_right",
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name = "quickLog"
                options = {{
                    presentation: 'containedTransparentModal', 
                    // animation: "slide_from_bottom",
                    // presentation: 'modal',
                    headerShown: false, 
                }}
            />
            <Stack.Screen
                name = "listVideoEssay"
                options = {{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name = "collectionDetail"
                options = {{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name = "videoInfo"
                options = {{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name = "followList"
                options = {{
                    title: 'Connections',
                    headerShown: true,
                    headerShadowVisible: false,
                    headerTintColor: theme.text,
                    headerStyle: { backgroundColor: theme.background },
                    headerTitleStyle: { color: theme.text, fontFamily: Fonts?.displayMedium, fontSize: 22 },
                }}
            />
            <Stack.Screen
                name = "addEssayToList"
                options = {{
                    presentation: 'modal',
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name = "newList"
                options = {{
                    presentation: 'modal',
                    headerShown: false,
                }}
            />
        </Stack>
    )
}