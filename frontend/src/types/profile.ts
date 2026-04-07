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
import { UrlObject } from "expo-router/build/global-state/routeInfo";
import { User } from "./user";
import { Log } from "./log";
export interface Profile {
    id: Number, 
    user: User, 
    imageUrl: UrlObject, 
    user_logs: Log[]
}