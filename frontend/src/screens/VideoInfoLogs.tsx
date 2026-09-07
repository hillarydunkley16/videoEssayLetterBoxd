import { FlatList, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { getAVideoEssay } from "../api/videos";
import { VideoEssay } from "../types/videoEssay";
import { Log } from "../types/log";
import { useEffect, useState } from "react";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {router } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {LineChart} from 'react-native-gifted-charts';

// import { useThemeColor } from "@/components/themed-view";
export default function VideoInfoLogs({ id }: { id: string}){
    const [video, setVideo] = useState<VideoEssay | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true); 
    const [logCount, setLogCount] = useState<number>(0); 
    const [lineData, setLineData] = useState<{value: number}[]>([]);
    const { getToken } = useAuth();
    const { user } = useUser(); // Clerk hook
    // const backgroundColor = useThemeColor({}, 'background');
    // const cardBackground = useThemeColor({ light: '#f8fafc', dark: '#111827' }, 'background');
    // const sectionBackground = useThemeColor({ light: '#f1f5f9', dark: '#111827' }, 'background');
    // const secondaryTextColor = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
    // const borderColor = useThemeColor({ light: '#e2e8f0', dark: '#334155' }, 'text');
    useEffect(() => {
            if (!id) {
              setLoading(false);
              return;
            }

            async function loadVideo() {
              try {
                const token = await getToken();
                
                const data = await getAVideoEssay(id, token! );
                setVideo(data.video);
                console.log("video: ", data.video)
                setLogs(data.logs);
                console.log("NUM LOGS: ", data.logs.length)
                const lineData = data.logs
                  .map((log) => ({ value: Number(log.rating) || 0 }))
                  .filter((item) => item.value !== null);
                
                console.log("LINE DATA: ", lineData);
                //I want the data to be the number of logs with each rating 1-5. 
                const ratingCounts = Array(5).fill(0);
                
                const totalLogs = data.logs.length;

                data.logs.forEach((log) => {
                    const rating = Number(log.rating);
                    if (rating >= 1 && rating <= 5) {
                        ratingCounts[rating - 1]++;
                    }
                });

                // convert counts to percentages for the chart
                const percentageData = ratingCounts.map((count, rating = 1) => ({
                    value: totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0,
                    label: `${rating+= 1}`
                }));
                console.log("Percentage data: ", percentageData);

                setLineData(percentageData);
                
                // console.log("lineData: ", lineData);
                // console.log("data.logs: ", data.logs)
                setLogCount(data.log_count);

              } finally {
                setLoading(false);
              }
            }
          
            loadVideo();
          }, [id]);
    return (
      <ScrollView
      style = {{width: '100%'}}
      scrollEventThrottle={16}> 
         <ThemedView style={style.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : logs.length === 0 ? (
          <ThemedText>No logs yet...</ThemedText>
        ) : (
          <TouchableOpacity onPress = {() => router.push(`/logs?essayId=${id}`)}>
          
           
           <LineChart
              areaChart
              curved
              adjustToWidth = {true}
              width={315}
              hideDataPoints
              
              height={200}
              data={lineData}

              yAxisLabelSuffix="%"
              maxValue={100}
              stepValue={50}
              noOfSections={2}
              initialSpacing={10}
              color="#03296f"
              endFillColor1="#03296f"
              startFillColor1="#03296f"
              // thickness={3}
              // yAxisTextStyle={{color: '#333'}}
              hideYAxisText={false}
              yAxisColor={'transparent'} // 
              xAxisColor={'transparent'}
              
              
              xAxisLabelTextStyle={{color: '#333'}}
              noOfSectionsBelowXAxis = {0}
              scrollToEnd = {false}
              disableScroll = {true}
           />
          
         
           </TouchableOpacity>
         
        )}
       
      </ThemedView>
      </ScrollView>
     
      
    );

}
const style = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'stretch',
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
  },
  titleText: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 12,
  },
  subtitleText: {
    fontSize: 14,
    color: '#666',
  },
  logContainer: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  }
})