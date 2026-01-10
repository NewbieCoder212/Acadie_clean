import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  Clock,
  X,
  Square,
  CheckSquare,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Lock,
  AlertOctagon,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  MapPin,
  SprayCan,
  Brush,
  Droplets,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useStore, CHECKLIST_ITEMS, CHECKLIST_SECTIONS, CleaningStatus } from '@/lib/store';
import {
  insertCleaningLog as insertSupabaseLog,
  getLogsForLocation as getSupabaseLogs,
  rowToCleaningLog,
  CleaningLogRow,
  verifyWashroomPin,
  insertReportedIssue,
  getWashroomById,
  updateWashroomLastCleaned,
  WashroomRow,
} from '@/lib/supabase';
import { sendAttentionRequiredEmail, getUncheckedItems, sendIssueReportEmail, ISSUE_TYPES } from '@/lib/email';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Mint & Emerald Glass color palette
const COLORS = {
  mintWhite: '#f0fdf4',
  mintLight: '#dcfce7',
  mintMedium: '#bbf7d0',
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldDeep: '#047857',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(16, 185, 129, 0.2)',
  textDark: '#064e3b',
  textMuted: '#6b7280',
  white: '#ffffff',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#dc2626',
  redLight: '#fef2f2',
};

interface ChecklistState {
  handwashingStation: boolean;
  toiletPaper: boolean;
  bins: boolean;
  surfacesDisinfected: boolean;
  fixtures: boolean;
  waterTemperature: boolean;
  floors: boolean;
  ventilationLighting: boolean;
}

const initialChecklist: ChecklistState = {
  handwashingStation: false,
  toiletPaper: false,
  bins: false,
  surfacesDisinfected: false,
  fixtures: false,
  waterTemperature: false,
  floors: false,
  ventilationLighting: false,
};

// Timeline items for clean status
const TIMELINE_ITEMS = [
  { icon: SprayCan, label: 'Surfaces Sanitized / Surfaces désinfectées' },
  { icon: Brush, label: 'Floor Cleaned / Plancher nettoyé' },
  { icon: Droplets, label: 'Supplies Restocked / Fournitures réapprovisionnées' },
];

export default function WashroomPublicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showIssueDropdown, setShowIssueDropdown] = useState(false);
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');
  const [issueComment, setIssueComment] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistState>(initialChecklist);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseLogs, setSupabaseLogs] = useState<CleaningLogRow[]>([]);
  const [supabaseWashroom, setSupabaseWashroom] = useState<WashroomRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentLocationRef = useRef<string | null>(null);

  // Use Supabase washroom data
  const location = supabaseWashroom ? {
    id: supabaseWashroom.id,
    name: supabaseWashroom.room_name,
    businessName: supabaseWashroom.business_name,
    pinCode: supabaseWashroom.pin_code,
    lastCleaned: supabaseWashroom.last_cleaned ? new Date(supabaseWashroom.last_cleaned).getTime() : null,
    createdAt: new Date(supabaseWashroom.created_at).getTime(),
  } : null;

  // Animated sparkle effect
  const sparkleOpacity = useSharedValue(0.6);
  const sparkleScale = useSharedValue(1);

  useEffect(() => {
    sparkleOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    sparkleScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedSparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
    transform: [{ scale: sparkleScale.value }],
  }));

  // Fetch logs and washroom from Supabase on mount and when ID changes
  useEffect(() => {
    if (currentLocationRef.current !== id) {
      setSupabaseLogs([]);
      setSupabaseWashroom(null);
      setLoadError(null);
      currentLocationRef.current = id ?? null;
    }

    async function fetchData() {
      if (!id) return;
      setIsLoading(true);
      setLoadError(null);

      try {
        // Fetch both logs and washroom in parallel
        const [logsResult, washroomResult] = await Promise.all([
          getSupabaseLogs(id),
          getWashroomById(id),
        ]);

        if (currentLocationRef.current !== id) return;

        if (logsResult.success && logsResult.data) {
          setSupabaseLogs(logsResult.data);
        } else {
          setLoadError(logsResult.error ?? 'Failed to load cleaning records');
        }

        if (washroomResult.success && washroomResult.data) {
          setSupabaseWashroom(washroomResult.data);
        }
      } catch (error) {
        if (currentLocationRef.current === id) {
          setLoadError('Network error. Please check your connection.');
        }
      }

      if (currentLocationRef.current === id) {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setIsLoading(true);
    Promise.all([
      getSupabaseLogs(id ?? ''),
      getWashroomById(id ?? ''),
    ]).then(([logsResult, washroomResult]) => {
      if (logsResult.success && logsResult.data) {
        setSupabaseLogs(logsResult.data);
        setLoadError(null);
      } else {
        setLoadError(logsResult.error ?? 'Failed to load cleaning records');
      }
      if (washroomResult.success && washroomResult.data) {
        setSupabaseWashroom(washroomResult.data);
      }
      setIsLoading(false);
    }).catch(() => {
      setLoadError('Network error. Please check your connection.');
      setIsLoading(false);
    });
  };

  const recentLogs = useMemo(() => {
    return supabaseLogs.slice(0, 3).map(rowToCleaningLog);
  }, [supabaseLogs]);

  const lastLog = recentLogs[0];
  const isClean = lastLog && lastLog.status === 'complete';
  const needsAttention = lastLog?.status === 'attention_required' && !lastLog.resolved;

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const allChecked = Object.values(checklist).every((v) => v);
  const hasUnchecked = Object.values(checklist).some((v) => !v);

  const needsNotes = hasUnchecked && !maintenanceNotes.trim();
  const canSubmit = staffName.trim() && (!hasUnchecked || maintenanceNotes.trim());

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeSince = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
  };

  const handleOpenChecklist = () => {
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 10 })
    );
    // Always require PIN for staff access - prevents public from accidentally logging
    setShowPinModal(true);
  };

  const handlePinSubmit = async () => {
    if (!id) return;

    setPinError(null);
    setIsVerifyingPin(true);

    try {
      // Verify against Supabase washrooms table
      const result = await verifyWashroomPin(id, staffPin);

      if (result.success && result.valid) {
        setShowPinModal(false);
        setStaffPin('');
        setShowChecklist(true);
      } else {
        setPinError('Invalid PIN / NIP invalide');
      }
    } catch (error) {
      console.error('[PIN] Verification error:', error);
      setPinError('Unable to verify PIN. Please try again.');
    }

    setIsVerifyingPin(false);
  };

  const handleClosePinModal = () => {
    setShowPinModal(false);
    setStaffPin('');
    setPinError(null);
  };

  const handleOpenIssueModal = () => {
    setShowIssueModal(true);
  };

  const handleCloseIssueModal = () => {
    setShowIssueModal(false);
    setSelectedIssueType('');
    setIssueComment('');
    setShowIssueDropdown(false);
  };

  const handleSubmitIssue = async () => {
    if (!selectedIssueType || isSubmittingIssue) return;

    Keyboard.dismiss();

    setIsSubmittingIssue(true);

    try {
      // Insert the issue to Supabase first
      const supabaseResult = await insertReportedIssue({
        location_id: id || '',
        location_name: location?.name || 'Unknown Location',
        issue_type: selectedIssueType,
        description: issueComment.trim(),
      });

      if (!supabaseResult.success) {
        console.log('[Issue] Warning: Failed to insert to Supabase:', supabaseResult.error);
        // Continue anyway to send email
      }

      // Get the inserted issue ID for deep linking in email
      const insertedIssueId = supabaseResult.data?.id;

      // Send email notification with issueId for deep linking
      const result = await sendIssueReportEmail({
        to: 'sportsfansummer@hotmail.com',
        locationName: location?.name || 'Unknown Location',
        locationId: id || '',
        issueType: selectedIssueType,
        comment: issueComment.trim(),
        timestamp: new Date(),
        issueId: insertedIssueId,
      });

      if (result.success) {
        setIssueSuccess(true);
        setTimeout(() => {
          setIssueSuccess(false);
          handleCloseIssueModal();
        }, 2000);
      } else {
        Alert.alert('Error', result.error || 'Failed to send report');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send report. Please try again.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleToggleCheck = (key: keyof ChecklistState) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!id || !staffName.trim() || isSubmitting) return;

    Keyboard.dismiss();

    setSubmitError(null);
    setIsSubmitting(true);

    const status: CleaningStatus = allChecked ? 'complete' : 'attention_required';

    try {
      // Map new checklist structure to legacy DB fields
      const result = await insertSupabaseLog({
        location_id: id,
        location_name: location?.name ?? 'Unknown Location',
        staff_name: staffName.trim(),
        timestamp: new Date().toISOString(),
        status,
        notes: maintenanceNotes.trim(),
        // Map new checklist items to legacy DB columns
        checklist_supplies: checklist.handwashingStation && checklist.toiletPaper,
        checklist_surfaces: checklist.surfacesDisinfected,
        checklist_fixtures: checklist.fixtures && checklist.waterTemperature && checklist.ventilationLighting,
        checklist_trash: checklist.bins,
        checklist_floor: checklist.floors,
        resolved: false,
      });

      if (!result.success) {
        console.error('[Submit] Failed to save to Supabase:', result.error);
        setSubmitError(result.error ?? 'Failed to save. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        setSupabaseLogs(prev => [result.data!, ...prev]);
      }

      // Update last_cleaned in washrooms table
      await updateWashroomLastCleaned(id);

      // Update local state immediately for instant UI refresh
      setSupabaseWashroom(prev => prev ? { ...prev, last_cleaned: new Date().toISOString() } : null);

      if (status === 'attention_required') {
        const recipientEmail = 'sportsfansummer@hotmail.com';
        const uncheckedItems = getUncheckedItems(checklist);

        const emailResult = await sendAttentionRequiredEmail({
          to: recipientEmail,
          locationName: location?.name ?? 'Unknown Location',
          locationId: id,
          staffName: staffName.trim(),
          notes: maintenanceNotes.trim(),
          uncheckedItems,
          timestamp: new Date(),
        });

        if (!emailResult.success) {
          console.log('[Email] Alert failed:', emailResult.error);
          Alert.alert(
            'Note',
            'Your cleaning log was saved successfully, but we could not send the email alert. A supervisor will still see this in the dashboard.',
            [{ text: 'OK' }]
          );
        }
      }

      setIsSubmitting(false);
      setChecklist(initialChecklist);
      setStaffName('');
      setStaffPin('');
      setPinError(null);
      setMaintenanceNotes('');
      setShowChecklist(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);

    } catch (error) {
      console.error('[Submit] Network exception:', error);
      setSubmitError('Network error. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleCloseChecklist = () => {
    setShowChecklist(false);
    setChecklist(initialChecklist);
    setStaffName('');
    setStaffPin('');
    setPinError(null);
    setMaintenanceNotes('');
  };

  // Show loading state first
  if (isLoading) {
    return (
      <LinearGradient
        colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.emerald} />
            <Text className="mt-4 text-base" style={{ color: COLORS.textMuted }}>
              Chargement... / Loading...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Only show "not found" after loading is complete and location is still null
  if (!location) {
    return (
      <LinearGradient
        colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center px-4 py-2 active:opacity-70"
          >
            <ChevronLeft size={24} color={COLORS.emeraldDark} />
            <Text className="text-base font-medium" style={{ color: COLORS.emeraldDark }}>
              Back
            </Text>
          </Pressable>
          <View className="flex-1 items-center justify-center px-8">
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: COLORS.glass }}
            >
              <AlertCircle size={48} color={COLORS.textMuted} />
            </View>
            <Text
              className="text-2xl font-bold text-center mb-3"
              style={{ color: COLORS.textDark }}
            >
              Location Not Found
            </Text>
            <Text
              className="text-base text-center"
              style={{ color: COLORS.textMuted }}
            >
              This location does not exist or has been deleted.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center px-4 py-2 active:opacity-70"
        >
          <ChevronLeft size={24} color={COLORS.emeraldDark} />
          <Text className="text-base font-medium" style={{ color: COLORS.emeraldDark }}>
            Back
          </Text>
        </Pressable>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={COLORS.emerald} />
              <Text className="mt-4 text-base" style={{ color: COLORS.textMuted }}>
                Loading status...
              </Text>
            </View>
          ) : loadError ? (
            <View className="flex-1 items-center justify-center">
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: COLORS.white }}
              >
                <WifiOff size={36} color={COLORS.textMuted} />
              </View>
              <Text className="text-lg font-bold mb-2" style={{ color: COLORS.textDark }}>
                Erreur de connexion / Connection Error
              </Text>
              <Text className="text-sm text-center mb-4" style={{ color: COLORS.textMuted }}>
                {loadError}
              </Text>
              <Pressable
                onPress={handleRetryLoad}
                className="flex-row items-center px-6 py-3 rounded-full active:opacity-70"
                style={{ backgroundColor: COLORS.emerald }}
              >
                <RefreshCw size={18} color={COLORS.white} />
                <Text className="text-white font-semibold ml-2">Réessayer / Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* App Logo */}
              <Animated.View
                entering={FadeInDown.delay(100).duration(500).springify()}
                className="items-center mb-4"
              >
                <Image
                  source={require('../../../assets/image-1767959752.png')}
                  style={{ width: 100, height: 100 }}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Main Status Card - Glass Effect */}
              <Animated.View
                entering={FadeInDown.duration(600).springify()}
                className="rounded-3xl overflow-hidden mb-6"
                style={{
                  backgroundColor: COLORS.glass,
                  borderWidth: 1,
                  borderColor: isClean ? COLORS.emerald : needsAttention ? COLORS.amber : COLORS.glassBorder,
                  shadowColor: COLORS.emerald,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 8,
                }}
              >
                {/* Status Header - HERO SECTION */}
                <View className="px-6 pt-10 pb-8 items-center">
                  {/* Large Status Text - PRIMARY VISUAL ELEMENT */}
                  <Text
                    className="text-5xl font-black text-center mb-2"
                    style={{
                      color: isClean
                        ? COLORS.emerald
                        : needsAttention
                        ? COLORS.amber
                        : COLORS.textMuted,
                      letterSpacing: 1,
                    }}
                  >
                    {isClean
                      ? 'CLEAN'
                      : needsAttention
                      ? 'ATTENTION'
                      : 'PENDING'}
                  </Text>
                  <Text
                    className="text-3xl font-bold text-center mb-4"
                    style={{
                      color: isClean
                        ? COLORS.emeraldDark
                        : needsAttention
                        ? COLORS.amber
                        : COLORS.textDark,
                    }}
                  >
                    {isClean
                      ? 'PROPRE'
                      : needsAttention
                      ? 'REQUISE'
                      : 'EN ATTENTE'}
                  </Text>

                  {/* Sparkle Icon with Animation */}
                  <Animated.View style={animatedSparkleStyle} className="mb-4">
                    <View
                      className="w-20 h-20 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: isClean
                          ? COLORS.mintLight
                          : needsAttention
                          ? COLORS.amberLight
                          : COLORS.mintLight,
                      }}
                    >
                      {isClean ? (
                        <Sparkles size={40} color={COLORS.emerald} strokeWidth={1.5} />
                      ) : needsAttention ? (
                        <AlertTriangle size={40} color={COLORS.amber} strokeWidth={1.5} />
                      ) : (
                        <Clock size={40} color={COLORS.textMuted} strokeWidth={1.5} />
                      )}
                    </View>
                  </Animated.View>

                  {/* Status Label */}
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: COLORS.textMuted }}
                  >
                    Facility Status / Statut de l'installation
                  </Text>

                  {/* Location Badge */}
                  <View
                    className="flex-row items-center mt-4 px-4 py-2 rounded-full"
                    style={{ backgroundColor: COLORS.mintLight }}
                  >
                    <MapPin size={16} color={COLORS.emerald} />
                    <Text
                      className="text-sm font-medium ml-1.5"
                      style={{ color: COLORS.emeraldDark }}
                    >
                      {location.name}
                    </Text>
                  </View>
                </View>

                {/* Last Cleaned Info */}
                {lastLog && (
                  <View
                    className="px-6 py-4 border-t"
                    style={{ borderColor: COLORS.glassBorder }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Clock size={16} color={COLORS.textMuted} />
                        <Text className="text-sm ml-2" style={{ color: COLORS.textMuted }}>
                          Last cleaned / Dernier nettoyage
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                        {getTimeSince(lastLog.timestamp)}
                      </Text>
                    </View>
                    {lastLog.staffName && (
                      <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-row items-center">
                          <User size={16} color={COLORS.textMuted} />
                          <Text className="text-sm ml-2" style={{ color: COLORS.textMuted }}>
                            Cleaned by / Nettoyé par
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                          {lastLog.staffName}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Animated.View>

              {/* Timeline Cards - Only show when clean */}
              {lastLog && isClean && (
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest mb-3 ml-1"
                    style={{ color: COLORS.textMuted }}
                  >
                    Cleaning Timeline / Historique de nettoyage
                  </Text>

                  <View className="gap-3">
                    {TIMELINE_ITEMS.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Animated.View
                          key={index}
                          entering={FadeInDown.delay(300 + index * 100)
                            .duration(500)
                            .springify()}
                          className="flex-row items-center"
                        >
                          {/* Timeline connector */}
                          <View className="items-center mr-4">
                            <View
                              className="w-12 h-12 rounded-2xl items-center justify-center"
                              style={{
                                backgroundColor: COLORS.glass,
                                borderWidth: 1,
                                borderColor: COLORS.glassBorder,
                              }}
                            >
                              <Icon size={22} color={COLORS.emerald} strokeWidth={1.5} />
                            </View>
                            {index < TIMELINE_ITEMS.length - 1 && (
                              <View
                                className="w-0.5 h-4 mt-2"
                                style={{ backgroundColor: COLORS.mintMedium }}
                              />
                            )}
                          </View>

                          {/* Card */}
                          <View
                            className="flex-1 rounded-2xl px-4 py-3"
                            style={{
                              backgroundColor: COLORS.glass,
                              borderWidth: 1,
                              borderColor: COLORS.glassBorder,
                            }}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text
                                className="text-base font-medium"
                                style={{ color: COLORS.textDark }}
                              >
                                {item.label}
                              </Text>
                              <CheckCircle2 size={18} color={COLORS.emerald} />
                            </View>
                            <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                              {formatTime(lastLog.timestamp)} - {formatDate(lastLog.timestamp)}
                            </Text>
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                </Animated.View>
              )}

              {/* Recent History */}
              {recentLogs.length > 1 && (
                <Animated.View
                  entering={FadeInDown.delay(600).duration(600).springify()}
                  className="mt-6"
                >
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest mb-3 ml-1"
                    style={{ color: COLORS.textMuted }}
                  >
                    Historique récent / Recent History
                  </Text>

                  <View
                    className="rounded-2xl overflow-hidden"
                    style={{
                      backgroundColor: COLORS.glass,
                      borderWidth: 1,
                      borderColor: COLORS.glassBorder,
                    }}
                  >
                    {recentLogs.slice(1).map((log, index) => (
                      <View
                        key={log.id}
                        className="flex-row items-center px-4 py-3"
                        style={{
                          borderTopWidth: index > 0 ? 1 : 0,
                          borderColor: COLORS.glassBorder,
                        }}
                      >
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center mr-3"
                          style={{
                            backgroundColor:
                              log.status === 'complete' ? COLORS.mintLight : COLORS.amberLight,
                          }}
                        >
                          {log.status === 'complete' ? (
                            <CheckCircle2 size={16} color={COLORS.emerald} />
                          ) : (
                            <AlertTriangle size={16} color={COLORS.amber} />
                          )}
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium" style={{ color: COLORS.textDark }}>
                            {formatTime(log.timestamp)}
                          </Text>
                          <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                            {formatDate(log.timestamp)} - {log.staffName || 'Staff'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Action Buttons */}
              <Animated.View
                entering={FadeIn.delay(700).duration(500)}
                className="mt-8 gap-4"
              >
                {/* Report an Issue Button - REDUCED SIZE */}
                <Pressable
                  onPress={handleOpenIssueModal}
                  className="flex-row items-center justify-center py-3 px-5 rounded-xl active:opacity-70"
                  style={{
                    backgroundColor: COLORS.red,
                    shadowColor: COLORS.red,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <AlertOctagon size={20} color={COLORS.white} />
                  <View className="ml-2">
                    <Text
                      className="text-base font-bold"
                      style={{ color: COLORS.white }}
                    >
                      Report an Issue
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: COLORS.white, opacity: 0.85 }}
                    >
                      Signaler un problème
                    </Text>
                  </View>
                </Pressable>

                {/* Staff Log Cleaning Button - SUBTLE, ALWAYS REQUIRES PIN */}
                <AnimatedPressable
                  onPress={handleOpenChecklist}
                  style={[
                    animatedButtonStyle,
                    {
                      backgroundColor: showSuccess ? COLORS.emerald : 'transparent',
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: showSuccess ? 0 : 1,
                      borderColor: COLORS.glassBorder,
                    },
                  ]}
                  className="active:opacity-70"
                >
                  {showSuccess ? (
                    <View className="flex-row items-center justify-center flex-wrap">
                      <Check size={18} color={COLORS.white} strokeWidth={3} />
                      <Text
                        className="text-sm font-semibold ml-2 text-center"
                        style={{ color: COLORS.white }}
                      >
                        Log Saved! / Entrée enregistrée!
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <Lock size={16} color={COLORS.textMuted} />
                      <Text
                        className="text-sm font-medium ml-2 text-center"
                        style={{ color: COLORS.textMuted }}
                      >
                        Staff Only / Personnel uniquement
                      </Text>
                    </View>
                  )}
                </AnimatedPressable>
              </Animated.View>

              {/* Footer - Compliance Badge Only */}
              <Animated.View
                entering={FadeIn.delay(800).duration(600)}
                className="items-center mt-10 mb-6"
              >
                {/* Compliance Badge */}
                <View
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.glassBorder,
                  }}
                >
                  <View className="flex-row items-center justify-center">
                    <CheckCircle2 size={14} color={COLORS.emerald} />
                    <Text
                      className="text-sm font-semibold ml-1.5"
                      style={{ color: COLORS.emerald }}
                    >
                      Compliance Verified
                    </Text>
                  </View>
                  <Text
                    className="text-xs text-center mt-0.5"
                    style={{ color: COLORS.textMuted }}
                  >
                    Conformité vérifiée
                  </Text>
                </View>

                {/* Powered by Acadia Clean */}
                <View className="flex-row items-center mt-4">
                  <Text
                    className="text-xs"
                    style={{ color: COLORS.textMuted }}
                  >
                    Powered by
                  </Text>
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: COLORS.emeraldDark }}
                  >
                    Acadia Clean
                  </Text>
                </View>
              </Animated.View>
            </>
          )}
        </ScrollView>

        {/* Issue Report Modal */}
        <Modal
          visible={showIssueModal}
          animationType="fade"
          transparent
          onRequestClose={handleCloseIssueModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 bg-black/60 items-center justify-center px-6"
              onPress={() => Keyboard.dismiss()}
            >
              <Pressable
                className="w-full max-w-sm rounded-3xl p-6"
                style={{ backgroundColor: COLORS.white }}
                onPress={(e) => e.stopPropagation()}
              >
              {issueSuccess ? (
                <View className="items-center py-8">
                  <View
                    className="w-20 h-20 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: COLORS.mintLight }}
                  >
                    <Check size={40} color={COLORS.emerald} strokeWidth={3} />
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: COLORS.emerald }}
                  >
                    Report Sent!
                  </Text>
                  <Text
                    className="text-sm text-center mt-1"
                    style={{ color: COLORS.emerald }}
                  >
                    Rapport envoyé!
                  </Text>
                  <Text
                    className="text-sm text-center mt-2"
                    style={{ color: COLORS.textMuted }}
                  >
                    Management notified
                  </Text>
                  <Text
                    className="text-xs text-center"
                    style={{ color: COLORS.textMuted }}
                  >
                    La direction a été notifiée
                  </Text>
                </View>
              ) : (
                <>
                  <View className="items-center mb-6">
                    <View
                      className="w-16 h-16 rounded-full items-center justify-center mb-3"
                      style={{ backgroundColor: COLORS.redLight }}
                    >
                      <AlertOctagon size={32} color={COLORS.red} />
                    </View>
                    <Text
                      className="text-xl font-bold"
                      style={{ color: COLORS.textDark }}
                    >
                      Report an Issue
                    </Text>
                    <Text
                      className="text-sm"
                      style={{ color: COLORS.textMuted }}
                    >
                      Signaler un problème
                    </Text>
                    <Text
                      className="text-xs text-center mt-2"
                      style={{ color: COLORS.textMuted }}
                    >
                      Let us know what needs attention
                    </Text>
                    <Text
                      className="text-xs text-center"
                      style={{ color: COLORS.textMuted, opacity: 0.8 }}
                    >
                      Faites-nous savoir ce qui nécessite attention
                    </Text>
                  </View>

                  {/* Issue Type Dropdown */}
                  <View className="mb-4">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: COLORS.textDark }}
                    >
                      Issue Type
                    </Text>
                    <Text
                      className="text-xs mb-2"
                      style={{ color: COLORS.textMuted }}
                    >
                      Type de problème
                    </Text>
                    <Pressable
                      onPress={() => setShowIssueDropdown(!showIssueDropdown)}
                      className="flex-row items-center justify-between py-3 px-4 rounded-xl"
                      style={{
                        backgroundColor: COLORS.mintWhite,
                        borderWidth: 2,
                        borderColor: COLORS.glassBorder,
                      }}
                    >
                      <Text
                        style={{
                          color: selectedIssueType ? COLORS.textDark : COLORS.textMuted,
                          fontSize: 16,
                        }}
                      >
                        {selectedIssueType
                          ? ISSUE_TYPES.find(t => t.value === selectedIssueType)?.label
                          : 'Select an issue...'}
                      </Text>
                      <ChevronDown size={20} color={COLORS.textMuted} />
                    </Pressable>

                    {showIssueDropdown && (
                      <View
                        className="mt-2 rounded-xl overflow-hidden"
                        style={{
                          backgroundColor: COLORS.white,
                          borderWidth: 2,
                          borderColor: COLORS.glassBorder,
                        }}
                      >
                        {ISSUE_TYPES.map((issueType, index) => (
                          <Pressable
                            key={issueType.value}
                            onPress={() => {
                              setSelectedIssueType(issueType.value);
                              setShowIssueDropdown(false);
                            }}
                            className="py-3 px-4 active:bg-emerald-50"
                            style={{
                              borderBottomWidth: index < ISSUE_TYPES.length - 1 ? 1 : 0,
                              borderBottomColor: COLORS.glassBorder,
                              backgroundColor: selectedIssueType === issueType.value ? COLORS.mintLight : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                color: COLORS.textDark,
                                fontSize: 16,
                                fontWeight: selectedIssueType === issueType.value ? '600' : '400',
                              }}
                            >
                              {issueType.label}
                            </Text>
                            <Text
                              className="text-xs mt-0.5"
                              style={{ color: COLORS.textMuted }}
                            >
                              {issueType.labelFr}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Comment Field */}
                  <View className="mb-4">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: COLORS.textDark }}
                    >
                      Comment (optional)
                    </Text>
                    <Text
                      className="text-xs mb-2"
                      style={{ color: COLORS.textMuted }}
                    >
                      Commentaire (optionnel)
                    </Text>
                    <TextInput
                      value={issueComment}
                      onChangeText={setIssueComment}
                      placeholder="Describe the issue..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      style={{
                        backgroundColor: COLORS.mintWhite,
                        borderWidth: 2,
                        borderColor: COLORS.glassBorder,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        fontSize: 16,
                        color: COLORS.textDark,
                        minHeight: 80,
                      }}
                    />
                  </View>

                  {/* Submit Button */}
                  <Pressable
                    onPress={handleSubmitIssue}
                    disabled={!selectedIssueType || isSubmittingIssue}
                    style={{
                      backgroundColor: selectedIssueType && !isSubmittingIssue ? COLORS.red : '#cbd5e1',
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    className="active:opacity-80"
                  >
                    {isSubmittingIssue ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color={COLORS.white} />
                        <Text
                          className="text-base font-bold ml-2"
                          style={{ color: COLORS.white }}
                        >
                          Sending...
                        </Text>
                      </View>
                    ) : (
                      <View className="items-center">
                        <Text
                          className="text-base font-bold"
                          style={{ color: selectedIssueType ? COLORS.white : COLORS.textMuted }}
                        >
                          Submit
                        </Text>
                        <Text
                          className="text-xs"
                          style={{ color: selectedIssueType ? 'rgba(255,255,255,0.8)' : COLORS.textMuted }}
                        >
                          Soumettre
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={handleCloseIssueModal}
                    className="py-3 mt-2 items-center"
                  >
                    <Text style={{ color: COLORS.textMuted }} className="font-medium">
                      Cancel / Annuler
                    </Text>
                  </Pressable>
                </>
              )}
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* PIN Entry Modal */}
        <Modal
          visible={showPinModal}
          animationType="fade"
          transparent
          onRequestClose={handleClosePinModal}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="items-center mb-6">
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-3"
                  style={{ backgroundColor: COLORS.mintLight }}
                >
                  <Lock size={32} color={COLORS.emerald} />
                </View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: COLORS.textDark }}
                >
                  Accès du personnel / Staff Access
                </Text>
                <Text
                  className="text-sm text-center mt-1"
                  style={{ color: COLORS.textMuted }}
                >
                  Entrer le NIP / Enter PIN
                </Text>
              </View>

              <TextInput
                value={staffPin}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setStaffPin(cleaned);
                  if (pinError) setPinError(null);
                }}
                placeholder="••••"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
                style={{
                  backgroundColor: COLORS.mintWhite,
                  borderWidth: 2,
                  borderColor: pinError ? COLORS.red : COLORS.glassBorder,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  fontSize: 24,
                  color: COLORS.textDark,
                  letterSpacing: 12,
                  textAlign: 'center',
                }}
              />

              {pinError && (
                <Text
                  className="text-sm font-semibold text-center mt-2"
                  style={{ color: COLORS.red }}
                >
                  {pinError}
                </Text>
              )}

              <Pressable
                onPress={handlePinSubmit}
                disabled={staffPin.length !== 4 || isVerifyingPin}
                style={{
                  backgroundColor: staffPin.length === 4 && !isVerifyingPin ? COLORS.emerald : '#cbd5e1',
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginTop: 16,
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
                className="active:opacity-80"
              >
                {isVerifyingPin ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.white} />
                    <Text
                      className="text-base font-bold ml-2"
                      style={{ color: COLORS.white }}
                    >
                      Vérification... / Verifying...
                    </Text>
                  </>
                ) : (
                  <Text
                    className="text-base font-bold"
                    style={{ color: staffPin.length === 4 ? COLORS.white : COLORS.textMuted }}
                  >
                    Continuer / Continue
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleClosePinModal}
                className="py-3 mt-2 items-center"
              >
                <Text style={{ color: COLORS.textMuted }} className="font-medium">
                  Annuler / Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Checklist Modal */}
        <Modal
          visible={showChecklist}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseChecklist}
        >
          <LinearGradient
            colors={[COLORS.mintWhite, COLORS.mintLight]}
            style={{ flex: 1 }}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
              >
                {/* Modal Header */}
                <View
                  className="flex-row items-center justify-between px-5 py-4"
                  style={{ backgroundColor: COLORS.emeraldDark }}
                >
                  <Pressable onPress={handleCloseChecklist} className="p-2 -ml-2">
                    <X size={24} color={COLORS.white} />
                  </Pressable>
                  <Text className="text-lg font-bold" style={{ color: COLORS.white }}>
                    Cleaning Log / Registre de nettoyage
                  </Text>
                  <View className="w-8" />
                </View>

                <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                  {/* Staff Name Input */}
                  <View className="mb-6">
                    <Text
                      className="text-base font-bold mb-2"
                      style={{ color: COLORS.textDark }}
                    >
                      Staff Name / Nom du personnel
                    </Text>
                    <TextInput
                      value={staffName}
                      onChangeText={setStaffName}
                      placeholder="Enter your name / Entrez votre nom"
                      placeholderTextColor={COLORS.textMuted}
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 2,
                        borderColor: COLORS.glassBorder,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 18,
                        color: COLORS.textDark,
                      }}
                    />
                  </View>

                  {/* Checklist Items */}
                  <View className="mb-6">
                    <Text
                      className="text-base font-bold mb-3"
                      style={{ color: COLORS.textDark }}
                    >
                      Checklist / Liste de contrôle
                    </Text>

                    {CHECKLIST_SECTIONS.map((section) => {
                      const sectionItems = CHECKLIST_ITEMS.filter(item => item.section === section.id);
                      return (
                        <View key={section.id} className="mb-4">
                          {/* Section Header */}
                          <View className="mb-2 px-2">
                            <Text
                              className="font-bold"
                              style={{ color: COLORS.emeraldDark, fontSize: 14 }}
                            >
                              {section.titleEn}
                            </Text>
                            <Text
                              className="italic"
                              style={{ color: COLORS.textMuted, fontSize: 11 }}
                            >
                              {section.titleFr}
                            </Text>
                          </View>

                          {/* Section Items */}
                          <View
                            className="rounded-2xl overflow-hidden"
                            style={{ backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.glassBorder }}
                          >
                            {sectionItems.map((item, index) => {
                              const isChecked = checklist[item.key as keyof ChecklistState];
                              return (
                                <Pressable
                                  key={item.key}
                                  onPress={() => handleToggleCheck(item.key as keyof ChecklistState)}
                                  className="flex-row items-start p-4 active:bg-emerald-50"
                                  style={{
                                    borderBottomWidth: index < sectionItems.length - 1 ? 1 : 0,
                                    borderBottomColor: COLORS.glassBorder,
                                  }}
                                >
                                  <View className="mt-0.5">
                                    {isChecked ? (
                                      <CheckSquare size={24} color={COLORS.emerald} />
                                    ) : (
                                      <Square size={24} color={COLORS.textMuted} />
                                    )}
                                  </View>
                                  <View className="ml-3 flex-1">
                                    <Text
                                      className="font-bold"
                                      style={{
                                        color: isChecked ? COLORS.textDark : COLORS.textMuted,
                                        fontSize: 14,
                                        lineHeight: 20,
                                      }}
                                    >
                                      {item.labelEn}
                                    </Text>
                                    <Text
                                      className="italic mt-1"
                                      style={{
                                        color: COLORS.textMuted,
                                        fontSize: 11,
                                        lineHeight: 15,
                                      }}
                                    >
                                      ({item.labelFr})
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Maintenance Notes - Always visible */}
                  <View className="mb-6">
                    <View className="flex-row items-center mb-2">
                      <Text
                        className="text-base font-bold"
                        style={{ color: COLORS.textDark }}
                      >
                        Maintenance Notes / Notes d'entretien
                      </Text>
                      {hasUnchecked && (
                        <Text
                          className="text-sm font-bold ml-2"
                          style={{ color: COLORS.red }}
                        >
                          *Required / Requis
                        </Text>
                      )}
                    </View>
                    {hasUnchecked && (
                      <Text
                        className="text-sm mb-2"
                        style={{ color: COLORS.amber }}
                      >
                        Please explain unchecked items / Veuillez expliquer les éléments non cochés
                      </Text>
                    )}
                    <TextInput
                      value={maintenanceNotes}
                      onChangeText={setMaintenanceNotes}
                      placeholder="Describe any issues..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 2,
                        borderColor: needsNotes ? COLORS.amber : COLORS.glassBorder,
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        color: COLORS.textDark,
                        minHeight: 120,
                      }}
                    />
                  </View>
                </ScrollView>

                {/* Submit Button */}
                <View
                  className="px-5 pb-5 pt-3"
                  style={{ backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}
                >
                  {/* Submit Error with Retry */}
                  {submitError && (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
                      <View className="flex-row items-center mb-2">
                        <WifiOff size={18} color={COLORS.red} />
                        <Text className="text-sm font-semibold text-red-800 ml-2">
                          Submission Failed
                        </Text>
                      </View>
                      <Text className="text-sm text-red-700 mb-3">
                        {submitError}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setSubmitError(null);
                          handleSubmit();
                        }}
                        disabled={isSubmitting}
                        className="flex-row items-center justify-center bg-red-600 py-2 rounded-lg active:bg-red-700"
                      >
                        <RefreshCw size={16} color="#ffffff" />
                        <Text className="text-white font-semibold ml-2">Retry</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* UserID and Time Display */}
                  {staffName.trim() && (
                    <View
                      className="rounded-xl p-3 mb-3"
                      style={{ backgroundColor: COLORS.mintLight }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <User size={16} color={COLORS.emeraldDark} />
                          <Text
                            className="text-sm font-semibold ml-2"
                            style={{ color: COLORS.emeraldDark }}
                          >
                            {staffName.trim()}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Clock size={16} color={COLORS.emeraldDark} />
                          <Text
                            className="text-sm font-semibold ml-2"
                            style={{ color: COLORS.emeraldDark }}
                          >
                            {new Date().toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    style={{
                      backgroundColor: canSubmit && !isSubmitting ? COLORS.emerald : '#cbd5e1',
                      borderRadius: 12,
                      paddingVertical: 18,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                    className="active:opacity-80"
                  >
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color={COLORS.white} />
                        <Text
                          className="text-lg font-bold ml-2"
                          style={{ color: COLORS.white }}
                        >
                          Submitting... / Soumission...
                        </Text>
                      </>
                    ) : (
                      <Text
                        className="text-lg font-bold"
                        style={{ color: canSubmit ? COLORS.white : COLORS.textMuted }}
                      >
                        Submit / Soumettre
                      </Text>
                    )}
                  </Pressable>
                  {needsNotes && (
                    <Text
                      className="text-sm text-center mt-3"
                      style={{ color: COLORS.amber }}
                    >
                      Please explain why these items were not completed (e.g., out of supplies)
                    </Text>
                  )}
                  {needsNotes && (
                    <Text
                      className="text-sm text-center mt-1"
                      style={{ color: COLORS.amber }}
                    >
                      Veuillez expliquer pourquoi ces éléments n'ont pas été complétés
                    </Text>
                  )}
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </LinearGradient>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
