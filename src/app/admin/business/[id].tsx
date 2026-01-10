import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  X,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  BusinessRow,
  LocationRow,
  CleaningLogRow,
  ReportedIssueRow,
  getAllBusinesses,
  getLocationsForBusiness,
  getLogsForBusiness,
  getIssuesForBusiness,
  insertLocation,
} from '@/lib/supabase';

const COLORS = {
  primary: '#7c3aed',
  primaryDark: '#5b21b6',
  primaryLight: '#ede9fe',
  background: '#f5f3ff',
  backgroundLight: '#ede9fe',
  white: '#ffffff',
  textDark: '#1e1b4b',
  textMuted: '#6b7280',
  error: '#dc2626',
  success: '#10b981',
  warning: '#f59e0b',
  glass: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(124, 58, 237, 0.2)',
};

export default function BusinessDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [allLogs, setAllLogs] = useState<CleaningLogRow[]>([]);
  const [allIssues, setAllIssues] = useState<ReportedIssueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New location form
  const [newLocationName, setNewLocationName] = useState('');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get business details from all businesses
      const businessesResult = await getAllBusinesses();
      if (businessesResult.success && businessesResult.data) {
        const foundBusiness = businessesResult.data.find(b => b.id === id);
        if (foundBusiness) {
          setBusiness(foundBusiness);
        }
      }

      // Get locations for this business
      const locationsResult = await getLocationsForBusiness(id!);
      if (locationsResult.success && locationsResult.data) {
        setLocations(locationsResult.data);
      }

      // Get logs for this business (all locations)
      const logsResult = await getLogsForBusiness(id!);
      if (logsResult.success && logsResult.data) {
        setAllLogs(logsResult.data);
      }

      // Get issues for this business
      const issuesResult = await getIssuesForBusiness(id!);
      if (issuesResult.success && issuesResult.data) {
        setAllIssues(issuesResult.data);
      }
    } catch (error) {
      console.error('[BusinessDetail] Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  // Generate a random 4-digit PIN
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }

    setIsCreating(true);
    try {
      const result = await insertLocation({
        id: generateId(),
        business_id: id!,
        name: newLocationName.trim(),
        pin_code: generatePin(),
      });

      if (result.success) {
        setShowAddModal(false);
        setNewLocationName('');
        loadData();
        Alert.alert('Success', 'Location created successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to create location');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const getLogsForLocation = (locationId: string) => {
    return allLogs.filter(log => log.location_id === locationId).length;
  };

  const getOpenIssuesForLocation = (locationId: string) => {
    return allIssues.filter(issue => issue.location_id === locationId && issue.status === 'open').length;
  };

  const handleViewPublicPage = (locationId: string) => {
    router.push(`/washroom/${locationId}`);
  };

  const todayLogs = allLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  }).length;

  const openIssueCount = allIssues.filter(i => i.status === 'open').length;

  if (isLoading) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} className="items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-4" style={{ color: COLORS.textMuted }}>
            Loading business details...
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!business) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} className="items-center justify-center">
          <Text className="text-lg" style={{ color: COLORS.textMuted }}>
            Business not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 px-6 py-3 rounded-xl"
            style={{ backgroundColor: COLORS.primary }}
          >
            <Text style={{ color: COLORS.white }}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          className="flex-row items-center px-5 py-4"
          style={{ backgroundColor: COLORS.primary }}
        >
          <Pressable onPress={() => router.back()} className="p-2 -ml-2 active:opacity-70">
            <ArrowLeft size={24} color={COLORS.white} />
          </Pressable>
          <View className="flex-1 ml-2">
            <Text className="text-xl font-bold" style={{ color: COLORS.white }}>
              {business.name}
            </Text>
            <Text className="text-sm opacity-80" style={{ color: COLORS.white }}>
              {business.email}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Stats Overview */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-row gap-3 mb-6"
          >
            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <MapPin size={24} color={COLORS.primary} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {locations.length}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                Locations
              </Text>
            </View>

            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <ClipboardList size={24} color={COLORS.success} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {todayLogs}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                Logs Today
              </Text>
            </View>

            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <AlertTriangle size={24} color={COLORS.warning} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {openIssueCount}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                Open Issues
              </Text>
            </View>
          </Animated.View>

          {/* Add Location Button */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="mb-6"
          >
            <Pressable
              onPress={() => setShowAddModal(true)}
              className="flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
              style={{ backgroundColor: COLORS.primary }}
            >
              <Plus size={20} color={COLORS.white} />
              <Text className="font-bold ml-2" style={{ color: COLORS.white }}>
                Add Location
              </Text>
            </Pressable>
          </Animated.View>

          {/* Locations List */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: COLORS.textDark }}
            >
              Locations
            </Text>

            {locations.length === 0 ? (
              <View
                className="p-6 rounded-2xl items-center"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <MapPin size={48} color={COLORS.textMuted} />
                <Text className="text-base font-medium mt-3" style={{ color: COLORS.textMuted }}>
                  No locations yet
                </Text>
                <Text className="text-sm text-center mt-1" style={{ color: COLORS.textMuted }}>
                  Add your first location for this business
                </Text>
              </View>
            ) : (
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                {locations.map((location, index) => (
                  <View
                    key={location.id}
                    className="flex-row items-center justify-between p-4"
                    style={{
                      borderBottomWidth: index < locations.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.glassBorder,
                    }}
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      >
                        <MapPin size={24} color={COLORS.primary} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                          {location.name}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <Text className="text-xs" style={{ color: COLORS.success }}>
                            {getLogsForLocation(location.id)} logs
                          </Text>
                          {getOpenIssuesForLocation(location.id) > 0 && (
                            <View className="flex-row items-center ml-3">
                              <AlertTriangle size={12} color={COLORS.warning} />
                              <Text className="text-xs ml-1" style={{ color: COLORS.warning }}>
                                {getOpenIssuesForLocation(location.id)} issues
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleViewPublicPage(location.id)}
                      className="p-2 rounded-lg active:opacity-70"
                      style={{ backgroundColor: COLORS.primaryLight }}
                    >
                      <ExternalLink size={20} color={COLORS.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Business Info */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-6 mb-8">
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: COLORS.textDark }}
            >
              Business Info
            </Text>
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <View className="flex-row items-center mb-3">
                <Building2 size={20} color={COLORS.primary} />
                <Text className="ml-3 text-base" style={{ color: COLORS.textDark }}>
                  {business.name}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                  Email: {business.email}
                </Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                  Password: {business.password_hash}
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Add Location Modal */}
        <Modal
          visible={showAddModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold" style={{ color: COLORS.textDark }}>
                  Add Location
                </Text>
                <Pressable onPress={() => setShowAddModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Location Name
                </Text>
                <TextInput
                  value={newLocationName}
                  onChangeText={setNewLocationName}
                  placeholder="e.g., Lobby Restroom, Floor 2"
                  placeholderTextColor={COLORS.textMuted}
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: COLORS.primaryLight,
                    fontSize: 16,
                    color: COLORS.textDark,
                  }}
                />
              </View>

              <Pressable
                onPress={handleAddLocation}
                disabled={isCreating}
                className="rounded-xl py-4 items-center active:opacity-80"
                style={{ backgroundColor: COLORS.primary }}
              >
                {isCreating ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View className="flex-row items-center">
                    <Check size={20} color={COLORS.white} />
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      Create Location
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
