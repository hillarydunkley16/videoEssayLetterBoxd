import { ThemedView } from '@/components/themed-view'
import SwitchComponent from '@/src/screens/SearchScreen';

export default function Page(){
    return(
        <ThemedView style={{ flex: 1 }}>
            <SwitchComponent/>
        </ThemedView>
    )
}