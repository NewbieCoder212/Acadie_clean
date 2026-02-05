import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MapPin, ClipboardList, Settings, LogOut, RefreshCw,
  Shield, Lock, Eye, EyeOff,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { InstallAppBanner } from '@/components/InstallAppBanner';
import { BusinessSwitcher } from '@/components/BusinessPicker';
import { ManagerProvider, useManagerContext } from '@/components/manager/ManagerContext';
import { ManagerLocationsTab } from '@/components/manager/ManagerLocationsTab';
import { ManagerActivityTab } from '@/components/manager/ManagerActivityTab';
import { ManagerSettingsTab } from '@/components/manager/ManagerSettingsTab';
import { BRAND_COLORS as C } from '@/lib/colors';
import { useStore } from '@/lib/store';
import { verifyPassword as verifyPasswordUtil, hashPassword as hashPasswordUtil } from '@/lib/password';

type DashboardTab = 'locations' | 'activity' | 'settings';

// ============================
// Tab Bar
// ============================
const TAB_CONFIG: { key: DashboardTab; label: string; labelFr: string; icon: typeof MapPin }[] = [
  { key: 'locations', label: 'Locations', labelFr: 'Emplacements', icon: MapPin },
  { key: 'activity', label: 'Activity', labelFr: 'Activité', icon: ClipboardList },
  { key: 'settings', label: 'Settings', labelFr: 'Paramètres', icon: Settings },
];

function TabBar({ activeTab, onTabPress, openIssueCount }: { activeTab: DashboardTab; onTabPress: (tab: DashboardTab) => void; openIssueCount: number }) {
  return (
    <View
      className="flex-row"
      style={{
        backgroundColor: C.white,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: 6,
      }}
    >
      {TAB_CONFIG.map(tab => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            className="flex-1 items-center py-1"
          >
            <View className="relative">
              <Icon size={22} color={isActive ? C.emeraldDark : '#94a3b8'} />
              {tab.key === 'activity' && openIssueCount > 0 && (
                <View
                  className="absolute -top-1 -right-2.5 px-1 min-w-[14px] h-[14px] rounded-full items-center justify-center"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{openIssueCount}</Text>
                </View>
              )}
            </View>
            <Text
              className="text-[10px] mt-0.5 font-medium"
              style={{ color: isActive ? C.emeraldDark : '#94a3b8' }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================
// Dashboard Content (inside ManagerProvider)
// ============================
function ManagerDashboardContent() {
  const ctx = useManagerContext();
  const [activeTab, setActiveTab] = useState<DashboardTab>('locations');
  const isAuthenticated = useStore((s) => s.isManagerAuthenticated);

  if (ctx.isCheckingAuth) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: C.mintBackground }}>
        <AcadiaLogo size={80} />
        <ActivityIndicator size="large" color={C.actionGreen} style={{ marginTop: 24 }} />
        <Text className="mt-3 text-sm" style={{ color: C.textMuted }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const isBusinessAuthenticated = !!ctx.currentBusiness;
  const showDashboard = isAuthenticated || isBusinessAuthenticated;

  if (!showDashboard) {
    return <LegacyPasswordScreen />;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: C.mintBackground }} edges={['top']}>
      {/* Compact Header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          className="px-4 pb-3 pt-2"
          style={{ backgroundColor: C.emeraldDark }}
        >
          {/* Top row: logo + actions */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="rounded-xl p-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <AcadiaLogo size={32} showText={false} />
              </View>
              <View className="ml-2.5">
                <Text className="text-base font-bold text-white" numberOfLines={1}>
                  {ctx.currentBusiness?.name || 'Acadia Clean IQ'}
                </Text>
                {ctx.currentPermissions && (
                  <Text className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {ctx.currentPermissions.role === 'owner' ? 'Owner' : ctx.currentPermissions.role === 'supervisor' ? 'Supervisor' : 'Viewer'}
                  </Text>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={ctx.handleRefreshData}
                className="p-2 rounded-lg active:opacity-70"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <RefreshCw size={16} color="#fff" />
              </Pressable>
              <Pressable
                onPress={ctx.handleLogout}
                className="p-2 rounded-lg active:opacity-70"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <LogOut size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Business switcher if multi-business */}
          {ctx.managerBusinesses.length > 1 && (
            <View className="items-center">
              <BusinessSwitcher
                businesses={ctx.managerBusinesses}
                selectedBusinessId={ctx.currentBusiness?.id || null}
                onSelectBusiness={ctx.handleSwitchBusiness}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Install PWA Banner */}
      <InstallAppBanner />

      {/* Tab Content */}
      <View className="flex-1">
        {activeTab === 'locations' && <ManagerLocationsTab />}
        {activeTab === 'activity' && <ManagerActivityTab />}
        {activeTab === 'settings' && <ManagerSettingsTab />}
      </View>

      {/* Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        openIssueCount={ctx.openIssues.length}
      />
    </SafeAreaView>
  );
}

// ============================
// Legacy Password Screen (old auth flow - kept for backward compat)
// ============================
function LegacyPasswordScreen() {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();

  const passwordHash = useStore((s) => s.managerPasswordHash);
  const setManagerPasswordHash = useStore((s) => s.setManagerPasswordHash);
  const setManagerAuthenticated = useStore((s) => s.setManagerAuthenticated);
  const needsSetup = passwordHash === null;
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleLogin = async () => {
    if (!passwordInput.trim() || !passwordHash) return;
    setIsVerifying(true);
    const isValid = await verifyPasswordUtil(passwordInput, passwordHash);
    setIsVerifying(false);
    if (isValid) {
      setManagerAuthenticated(true);
    }
    setPasswordInput('');
  };

  const handleSetupPassword = async () => {
    if (!passwordInput.trim() || passwordInput.length < 4) return;
    if (passwordInput !== confirmPassword) return;
    setIsSettingUp(true);
    const hash = await hashPasswordUtil(passwordInput);
    setManagerPasswordHash(hash);
    setManagerAuthenticated(true);
    setIsSettingUp(false);
  };

  if (needsSetup) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View className="items-center mb-8">
              <View className="w-20 h-20 rounded-full bg-emerald-600 items-center justify-center mb-4">
                <Shield size={40} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-slate-900 text-center">Set Up Manager Password</Text>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-2">Create Password</Text>
              <View className="flex-row items-center bg-white border border-slate-300 rounded-xl">
                <TextInput
                  value={passwordInput} onChangeText={setPasswordInput}
                  placeholder="Enter password" placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  className="flex-1 px-4 py-3 text-base text-slate-900"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4 py-3">
                  {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                </Pressable>
              </View>
            </View>
            <View className="mb-6">
              <Text className="text-sm font-semibold text-slate-700 mb-2">Confirm Password</Text>
              <TextInput
                value={confirmPassword} onChangeText={setConfirmPassword}
                placeholder="Confirm password" placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900"
              />
            </View>
            <Pressable
              onPress={handleSetupPassword} disabled={isSettingUp}
              className={`py-4 rounded-xl items-center ${isSettingUp ? 'bg-slate-400' : 'bg-emerald-600'}`}
            >
              <Text className="text-white text-lg font-bold">{isSettingUp ? 'Setting up...' : 'Set Password'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-slate-800 items-center justify-center mb-4">
              <Lock size={40} color="#ffffff" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 text-center">Manager Dashboard</Text>
          </View>
          <View className="mb-6">
            <Text className="text-sm font-semibold text-slate-700 mb-2">Password</Text>
            <View className="flex-row items-center bg-white border border-slate-300 rounded-xl">
              <TextInput
                value={passwordInput} onChangeText={setPasswordInput}
                placeholder="Enter password" placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                className="flex-1 px-4 py-3 text-base text-slate-900"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4 py-3">
                {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={handleLogin} disabled={isVerifying}
            className={`py-4 rounded-xl items-center ${isVerifying ? 'bg-slate-500' : 'bg-slate-900'}`}
          >
            <Text className="text-white text-lg font-bold">{isVerifying ? 'Verifying...' : 'Unlock'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================
// Root Export (wraps with Provider)
// ============================
export default function ManagerScreen() {
  return (
    <ManagerProvider>
      <ManagerDashboardContent />
    </ManagerProvider>
  );
}
