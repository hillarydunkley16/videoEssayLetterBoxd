import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { updateProfileImageAPI } from "@/src/api/users";
import { useAuthUpdate } from "@/src/api/authUpdate";

// Pick an image, upload it to Clerk, then sync the new URL to the backend Profile.
export function useChangeProfilePhoto() {
  const { user } = useUser();
  const authUpdate = useAuthUpdate();
  const [error, setError] = useState<string | null>(null);

  async function changePhoto() {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (result.canceled) return;

      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      await user?.setProfileImage({ file: blob });
      await user?.reload();
      await updateProfileImageAPI(user?.imageUrl ?? "", authUpdate);
    } catch (e) {
      console.error("Failed to change profile photo:", e);
      setError("Couldn't update your photo. Please try again.");
    }
  }

  return { changePhoto, error };
}
