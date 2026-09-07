import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();
  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/'); // Redirect to home or login
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  };
  return <TouchableOpacity onPress={handleSignOut}><Text>Sign Out</Text></TouchableOpacity>;
};   