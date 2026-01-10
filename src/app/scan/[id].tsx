import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ScanRedirectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      console.log('[Scan] Redirecting to location:', id);
      // Replace the current screen with the washroom page
      router.replace(`/washroom/${id}`);
    }
  }, [id, router]);

  return (
    <View className="flex-1 bg-slate-900 items-center justify-center">
      <ActivityIndicator size="large" color="#10b981" />
      <Text className="text-white text-lg font-semibold mt-4">
        Opening location...
      </Text>
      <Text className="text-slate-300 text-sm mt-1">
        Ouverture de l'emplacement...
      </Text>
      <Text className="text-slate-400 text-xs mt-3">
        Location ID / ID d'emplacement: {id}
      </Text>
    </View>
  );
}
