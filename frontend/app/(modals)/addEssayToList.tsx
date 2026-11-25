import { useLocalSearchParams } from 'expo-router'
import AddEssayToListScreen from '@/src/screens/AddEssayToListScreen'

export default function AddEssayToList() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>()
  if (!publicId) return null
  return <AddEssayToListScreen collectionId={publicId} />
}
