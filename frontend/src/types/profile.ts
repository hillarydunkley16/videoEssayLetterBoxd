// class ProfileSerializer(serializers.ModelSerializer): 
// # profile = serializers.PrimaryKeyRelatedField(
//     #     many = True, 
//     #     read_only = True
//     # )
//     user_logs = serializers.SerializerMethodField()
//     def getUserLogs(self, obj): 
//         user = obj
//         logs = Log.objects.filter(owner = user)
//         return LogSerializer(logs, many = True, context = self.context).data
//     class Meta: 
//         model = Profile
//         fields = ("user", "imageUrl", "userLogs")
import { User } from "./user";
import { Log } from "./log";
import { VideoEssay } from "./videoEssay";

// The auto-provisioned "<username>'s Watchlist" Collection, returned inline
// on the profile response (see ProfileSerializer.get_watchList). Its `essays`
// are plain VideoEssay objects, not the VideoEssayData shape used elsewhere.
export interface ProfileWatchList {
    id: number,
    public_id: string,
    name: string,
    owner: string,
    essays: VideoEssay[]
}

export interface Profile {
    id: Number,
    user: User,
    imageUrl: string | null,
    user_logs: Log[],
    followers_count: number,
    following_count: number,
    is_following: boolean,
    watchList: ProfileWatchList
}