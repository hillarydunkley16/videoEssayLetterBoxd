import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopNav } from '@/components/ui/TopNav';
import { ReviewsTopNav } from '@/components/ui/reviewsTopNav';
export default function Layout() {
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
                    headerShown: true, 
                    header: () => <ReviewsTopNav />
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
        </Stack>
    )
}