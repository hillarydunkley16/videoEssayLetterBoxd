import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import LogInfo from '@/src/screens/logInfo';
import { ThemedView } from '@/components/themed-view';

export default function SingleLog(){
    const params = useLocalSearchParams<{logId: string}>();
    if (!params.logId) return (
        <ThemedView>
            <Text>NULL</Text>
        </ThemedView>
    );
    return(
       <ThemedView style = {styles.largeContainer}>
        <LogInfo id = {params.logId} />
       </ThemedView>
    )
}


const styles = StyleSheet.create({
    largeContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 20,
       
        
    },
    container: {
        width: '100%',
        marginBottom: 16,
    }
});