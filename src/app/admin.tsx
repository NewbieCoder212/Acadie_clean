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
import { useRouter } from 'expo-router';
import {
  Shield,
  Building2,
  MapPin,
  Plus,
  LogOut,
  ChevronRight,
  Users,
  ClipboardList,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BusinessRow,
  getAllBusinesses,
  getAllLogs,
  getOpenReportedIssues,
  insertBusiness,
  getAllLocations,
  LocationRow,
  CleaningLogRow,
  ReportedIssueRow,
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

// Sample businesses for demo
const DEMO_BUSINESSES = [
  { name: 'Hotel & Spa Marais', email: 'manager@hotelmarais.com', password: 'hotel123' },
  { name: 'Café Maritime', email: 'owner@cafemaritime.com', password: 'cafe123' },
  { name: 'Arena Nord Sports', email: 'ops@arenanord.com', password: 'arena123' },
  { name: 'Centre Commercial Acadie', email: 'facility@centreacadie.com', password: 'centre123' },
  { name: 'Clinique Santé Plus', email: 'admin@cliniquesante.com', password: 'clinique123' },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<BusinessRow | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [logs, setLogs] = useState<CleaningLogRow[]>([]);
  const [issues, setIssues] = useState<ReportedIssueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New business form
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessEmail, setNewBusinessEmail] = useState('');
  const [newBusinessPassword, setNewBusinessPassword] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const stored = await AsyncStorage.getItem('currentBusiness');
      if (stored) {
        const business = JSON.parse(stored) as BusinessRow;
        if (business.is_admin) {
          setCurrentAdmin(business);
          loadData();
          return;
        }
      }
      // Not logged in or not admin
      router.replace('/admin-login');
    } catch (error) {
      router.replace('/admin-login');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [businessesResult, locationsResult, logsResult, issuesResult] = await Promise.all([
        getAllBusinesses(),
        getAllLocations(),
        getAllLogs(),
        getOpenReportedIssues(),
      ]);

      if (businessesResult.success) {
        setBusinesses(businessesResult.data?.filter(b => !b.is_admin) ?? []);
      }
      if (locationsResult.success) {
        setLocations(locationsResult.data ?? []);
      }
      if (logsResult.success) {
        setLogs(logsResult.data ?? []);
      }
      if (issuesResult.success) {
        setIssues(issuesResult.data ?? []);
      }
    } catch (error) {
      console.error('[Admin] Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentBusiness');
    router.replace('/login');
  };

  const handleAddBusiness = async () => {
    if (!newBusinessName.trim() || !newBusinessEmail.trim() || !newBusinessPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      const result = await insertBusiness({
        name: newBusinessName.trim(),
        email: newBusinessEmail.trim(),
        password: newBusinessPassword.trim(),
        is_admin: false,
      });

      if (result.success) {
        setShowAddModal(false);
        setNewBusinessName('');
        setNewBusinessEmail('');
        setNewBusinessPassword('');
        loadData();
        Alert.alert('Success', 'Business created successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to create business');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetupDemoBusinesses = async () => {
    Alert.alert(
      'Set Up Demo Businesses',
      'This will create 5 sample businesses for testing. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setIsLoading(true);
            for (const demo of DEMO_BUSINESSES) {
              await insertBusiness({
                name: demo.name,
                email: demo.email,
                password: demo.password,
                is_admin: false,
              });
            }
            await loadData();
            Alert.alert('Success', '5 demo businesses created!');
          },
        },
      ]
    );
  };

  const getLocationCountForBusiness = (businessId: string) => {
    return locations.filter(loc => loc.business_id === businessId).length;
  };

  const openIssueCount = issues.filter(i => i.status === 'open').length;
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  }).length;

  if (isLoading) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} className="items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-4" style={{ color: COLORS.textMuted }}>
            Loading admin dashboard...
          </Text>
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
          className="flex-row items-center justify-between px-5 py-4"
          style={{ backgroundColor: COLORS.primary }}
        >
          <View className="flex-row items-center">
            <Shield size={24} color={COLORS.white} />
            <Text className="text-xl font-bold ml-2" style={{ color: COLORS.white }}>
              Admin Dashboard
            </Text>
          </View>
          <Pressable onPress={handleLogout} className="p-2 active:opacity-70">
            <LogOut size={22} color={COLORS.white} />
          </Pressable>
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
              <Building2 size={24} color={COLORS.primary} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {businesses.length}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                Businesses
              </Text>
            </View>

            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <MapPin size={24} color={COLORS.success} />
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
              <AlertTriangle size={24} color={COLORS.warning} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {openIssueCount}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                Open Issues
              </Text>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="mb-6"
          >
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowAddModal(true)}
                className="flex-1 flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Plus size={20} color={COLORS.white} />
                <Text className="font-bold ml-2" style={{ color: COLORS.white }}>
                  Add Business
                </Text>
              </Pressable>

              {businesses.length === 0 && (
                <Pressable
                  onPress={handleSetupDemoBusinesses}
                  className="flex-1 flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                  style={{ backgroundColor: COLORS.success }}
                >
                  <Users size={20} color={COLORS.white} />
                  <Text className="font-bold ml-2" style={{ color: COLORS.white }}>
                    Setup 5 Demo
                  </Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          {/* Businesses List */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: COLORS.textDark }}
            >
              Businesses
            </Text>

            {businesses.length === 0 ? (
              <View
                className="p-6 rounded-2xl items-center"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <Building2 size={48} color={COLORS.textMuted} />
                <Text className="text-base font-medium mt-3" style={{ color: COLORS.textMuted }}>
                  No businesses yet
                </Text>
                <Text className="text-sm text-center mt-1" style={{ color: COLORS.textMuted }}>
                  Add your first business or set up demo businesses
                </Text>
              </View>
            ) : (
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                {businesses.map((business, index) => (
                  <Pressable
                    key={business.id}
                    onPress={() => router.push(`/admin/business/${business.id}`)}
                    className="flex-row items-center justify-between p-4 active:bg-purple-50"
                    style={{
                      borderBottomWidth: index < businesses.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.glassBorder,
                    }}
                  >
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      >
                        <Building2 size={24} color={COLORS.primary} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                          {business.name}
                        </Text>
                        <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                          {business.email}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: COLORS.primary }}>
                          {getLocationCountForBusiness(business.id)} locations
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={COLORS.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Today's Activity */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-6">
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: COLORS.textDark }}
            >
              Today's Activity
            </Text>
            <View
              className="p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <View className="flex-row items-center">
                <ClipboardList size={24} color={COLORS.success} />
                <Text className="text-xl font-bold ml-3" style={{ color: COLORS.textDark }}>
                  {todayLogs}
                </Text>
                <Text className="text-base ml-2" style={{ color: COLORS.textMuted }}>
                  cleaning logs today
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Login Credentials for Demo */}
          {businesses.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-6 mb-8">
              <Text
                className="text-lg font-bold mb-3"
                style={{ color: COLORS.textDark }}
              >
                Business Login Credentials
              </Text>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <Text className="text-sm mb-2" style={{ color: COLORS.textMuted }}>
                  Share these with business managers:
                </Text>
                {businesses.slice(0, 5).map((business, index) => (
                  <View
                    key={business.id}
                    className="py-2"
                    style={{
                      borderBottomWidth: index < Math.min(businesses.length, 5) - 1 ? 1 : 0,
                      borderBottomColor: COLORS.glassBorder,
                    }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                      {business.name}
                    </Text>
                    <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                      Email: {business.email} | Password: {business.password_hash}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Add Business Modal */}
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
                  Add Business
                </Text>
                <Pressable onPress={() => setShowAddModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Business Name
                </Text>
                <TextInput
                  value={newBusinessName}
                  onChangeText={setNewBusinessName}
                  placeholder="e.g., Hotel Marais"
                  placeholderTextColor={COLORS.textMuted}
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: COLORS.primaryLight,
                    fontSize: 16,
                    color: COLORS.textDark,
                  }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Manager Email
                </Text>
                <TextInput
                  value={newBusinessEmail}
                  onChangeText={setNewBusinessEmail}
                  placeholder="manager@business.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: COLORS.primaryLight,
                    fontSize: 16,
                    color: COLORS.textDark,
                  }}
                />
              </View>

              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Password
                </Text>
                <TextInput
                  value={newBusinessPassword}
                  onChangeText={setNewBusinessPassword}
                  placeholder="Create password"
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
                onPress={handleAddBusiness}
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
                      Create Business
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
