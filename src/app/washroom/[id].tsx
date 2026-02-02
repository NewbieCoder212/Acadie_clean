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
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useStore, CHECKLIST_ITEMS, CHECKLIST_SECTIONS, CleaningStatus } from '@/lib/store';
import {
  insertCleaningLog as insertSupabaseLog,
  getLogsForLocation as getSupabaseLogs,
  rowToCleaningLog,
  CleaningLogRow,
  verifyWashroomPin,
  isPinSessionInvalid,
  insertReportedIssue,
  getWashroomById,
  updateWashroomLastCleaned,
  WashroomRow,
  autoResolveLogsForLocation,
  autoResolveIssuesForLocation,
  trackQrScanDetailed,
  getOpenIssuesForLocation,
  ReportedIssueRow,
} from '@/lib/supabase';
import { sendAttentionRequiredEmail, getUncheckedItems, sendIssueReportEmail, ISSUE_TYPES } from '@/lib/email';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { useOfflineQueue, PendingLog } from '@/lib/offline-queue';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

// Use consistent brand colors
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

// Legacy color mapping for backward compatibility
const COLORS = {
  mintWhite: C.mintBackground,
  mintLight: C.emeraldLight,
  mintMedium: C.mintGradientStart,
  emerald: C.actionGreen,
  emeraldDark: C.emeraldDark,
  glass: C.cardBackground,
  glassBorder: C.borderMedium,
  textDark: C.textPrimary,
  textMuted: C.textMuted,
  white: C.white,
  amber: C.warning,
  amberLight: C.warningBg,
  red: C.error,
  redLight: C.errorBg,
};

interface ChecklistState {
  handwashingStation: boolean;
  toiletPaper: boolean;
  bins: boolean;
  requiredSignage: boolean;
  surfacesDisinfected: boolean;
  fixtures: boolean;
  cleaningTools: boolean;
  chemicalStorage: boolean;
  waterTemperature: boolean;
  floors: boolean;
  ventilationLighting: boolean;
  structuralIntegrity: boolean;
}

// Track which items are marked as N/A
interface NaState {
  requiredSignage: boolean;
}

const initialChecklist: ChecklistState = {
  handwashingStation: false,
  toiletPaper: false,
  bins: false,
  requiredSignage: false,
  surfacesDisinfected: false,
  fixtures: false,
  cleaningTools: false,
  chemicalStorage: false,
  waterTemperature: false,
  floors: false,
  ventilationLighting: false,
  structuralIntegrity: false,
};

const initialNaState: NaState = {
  requiredSignage: false,
};

export default function WashroomPublicScreen() {
  const { id, admin, scan } = useLocalSearchParams<{ id: string; admin?: string; scan?: string }>();
  const router = useRouter();
  const isAdminView = admin === 'true';
  const isFromQrScan = scan === 'true';
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
  const [naState, setNaState] = useState<NaState>(initialNaState);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseLogs, setSupabaseLogs] = useState<CleaningLogRow[]>([]);
  const [supabaseWashroom, setSupabaseWashroom] = useState<WashroomRow | null>(null);
  const [openIssues, setOpenIssues] = useState<ReportedIssueRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [pinSessionStartTime, setPinSessionStartTime] = useState<string | null>(null); // Track when PIN was verified

  const currentLocationRef = useRef<string | null>(null);

  // Network status and offline queue
  const networkStatus = useNetworkStatus();
  const isOnline = networkStatus.isConnected;
  const addPendingLog = useOfflineQueue((s) => s.addPendingLog);
  const pendingCount = useOfflineQueue((s) => s.pendingLogs.length);
  const getPendingForLocation = useOfflineQueue((s) => s.getPendingForLocation);
  const pendingLogsForLocation = id ? getPendingForLocation(id) : [];

  // Hidden staff access - tap logo 5 times to reveal
  const [showStaffButton, setShowStaffButton] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = () => {
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapCountRef.current += 1;

    if (tapCountRef.current >= 5) {
      // Reveal the staff button
      setShowStaffButton(true);
      tapCountRef.current = 0;

      // Auto-hide after 30 seconds of inactivity
      tapTimeoutRef.current = setTimeout(() => {
        setShowStaffButton(false);
      }, 30000);
    } else {
      // Reset tap count after 2 seconds of no taps
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 2000);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

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
      setOpenIssues([]);
      setLoadError(null);
      currentLocationRef.current = id ?? null;
    }

    async function fetchData() {
      if (!id) return;
      setIsLoading(true);
      setLoadError(null);

      try {
        // Fetch logs, washroom, and open issues in parallel
        const [logsResult, washroomResult, issuesResult] = await Promise.all([
          getSupabaseLogs(id),
          getWashroomById(id),
          getOpenIssuesForLocation(id),
        ]);

        if (currentLocationRef.current !== id) return;

        if (logsResult.success && logsResult.data) {
          setSupabaseLogs(logsResult.data);
        } else {
          setLoadError(logsResult.error ?? 'Failed to load cleaning records');
        }

        if (washroomResult.success && washroomResult.data) {
          setSupabaseWashroom(washroomResult.data);

          // Track QR scan only for actual QR scans (not page refreshes or admin views)
          // Only counts when ?scan=true is in the URL (from QR code)
          if (isFromQrScan && !isAdminView) {
            trackQrScanDetailed(id).catch((err: Error) => {
              console.log('[QR Scan] Tracking failed (non-blocking):', err);
            });
          }
        }

        if (issuesResult.success && issuesResult.data) {
          setOpenIssues(issuesResult.data);
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
  }, [id, isAdminView]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setIsLoading(true);
    Promise.all([
      getSupabaseLogs(id ?? ''),
      getWashroomById(id ?? ''),
      getOpenIssuesForLocation(id ?? ''),
    ]).then(([logsResult, washroomResult, issuesResult]) => {
      if (logsResult.success && logsResult.data) {
        setSupabaseLogs(logsResult.data);
        setLoadError(null);
      } else {
        setLoadError(logsResult.error ?? 'Failed to load cleaning records');
      }
      if (washroomResult.success && washroomResult.data) {
        setSupabaseWashroom(washroomResult.data);
      }
      if (issuesResult.success && issuesResult.data) {
        setOpenIssues(issuesResult.data);
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

  // Determine status based on most recent event (cleaning or issue report)
  // Priority: Open Issues > Last Cleaning Status
  const hasOpenIssues = openIssues.length > 0;
  const mostRecentIssue = openIssues[0]; // Already sorted by created_at desc

  // Check if the most recent issue was reported AFTER the last cleaning
  const issueReportedAfterCleaning = hasOpenIssues && lastLog &&
    mostRecentIssue && new Date(mostRecentIssue.created_at).getTime() > lastLog.timestamp;

  // Status logic: if there are open issues (reported after last cleaning or no cleaning exists), show "issue"
  // Otherwise, show the last cleaning status
  const showIssueStatus = hasOpenIssues && (!lastLog || issueReportedAfterCleaning);
  const isClean = !showIssueStatus && lastLog && lastLog.status === 'complete';
  const needsAttention = !showIssueStatus && lastLog?.status === 'attention_required' && !lastLog.resolved;

  // Check if all items are either checked OR marked as N/A
  const allChecked = Object.entries(checklist).every(([key, value]) => {
    // If item has N/A option and is marked N/A, treat as "checked"
    if (key === 'requiredSignage' && naState.requiredSignage) return true;
    return value;
  });

  // Check if any item is unchecked (excluding N/A items)
  const hasUnchecked = Object.entries(checklist).some(([key, value]) => {
    // If item is marked N/A, don't count as unchecked
    if (key === 'requiredSignage' && naState.requiredSignage) return false;
    return !value;
  });

  const needsNotes = hasUnchecked && !maintenanceNotes.trim();
  const canSubmit = staffName.trim() && (!hasUnchecked || maintenanceNotes.trim());

  const getTimeSince = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
  };

  const handleOpenChecklist = () => {
    if (isAdminView) {
      setShowChecklist(true);
    } else {
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = async () => {
    if (!id) return;

    setPinError(null);
    setIsVerifyingPin(true);

    try {
      const result = await verifyWashroomPin(id, staffPin);

      if (result.success && result.valid) {
        // Store session start time for PIN validation on submit
        setPinSessionStartTime(new Date().toISOString());
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
      // First save to Supabase - this is the critical part
      const supabaseResult = await insertReportedIssue({
        location_id: id || '',
        location_name: location?.name || 'Unknown Location',
        issue_type: selectedIssueType,
        description: issueComment.trim(),
      });

      if (!supabaseResult.success) {
        // Only show error if Supabase insert fails
        Alert.alert('Error', supabaseResult.error || 'Failed to save report. Please try again.');
        setIsSubmittingIssue(false);
        return;
      }

      // Issue saved successfully - show success to user and update local state
      if (supabaseResult.data) {
        // Add the new issue to local state so status card updates immediately
        setOpenIssues(prev => [supabaseResult.data!, ...prev]);
      }

      setIssueSuccess(true);
      setTimeout(() => {
        setIssueSuccess(false);
        handleCloseIssueModal();
      }, 2000);

      // Try to send email notification (non-blocking - issue is already saved)
      const insertedIssueId = supabaseResult.data?.id;
      const recipientEmail = supabaseWashroom?.alert_email || 'microsaasnb@proton.me';

      sendIssueReportEmail({
        to: recipientEmail,
        locationName: location?.name || 'Unknown Location',
        locationId: id || '',
        issueType: selectedIssueType,
        comment: issueComment.trim(),
        timestamp: new Date(),
        issueId: insertedIssueId,
      }).then(result => {
        if (!result.success) {
          console.log('[Issue] Email notification failed (issue still saved):', result.error);
        }
      });

    } catch (error) {
      Alert.alert('Error', 'Failed to save report. Please try again.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleToggleCheck = (key: keyof ChecklistState) => {
    // If item has N/A and N/A is checked, uncheck N/A first
    if (key === 'requiredSignage' && naState.requiredSignage) {
      setNaState((prev) => ({ ...prev, requiredSignage: false }));
    }
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleNa = (key: keyof NaState) => {
    setNaState((prev) => {
      const newValue = !prev[key];
      // If marking as N/A, also uncheck the main checkbox
      if (newValue) {
        setChecklist((prevChecklist) => ({ ...prevChecklist, [key]: false }));
      }
      return { ...prev, [key]: newValue };
    });
  };

  const handleSubmit = async () => {
    if (!id || !staffName.trim() || isSubmitting) return;

    Keyboard.dismiss();

    setSubmitError(null);
    setSavedOffline(false);
    setIsSubmitting(true);

    // Check if PIN session is still valid (PIN hasn't changed since verification)
    // Skip this check for admin view or if no session start time (legacy)
    if (!isAdminView && pinSessionStartTime && isOnline) {
      try {
        const sessionCheck = await isPinSessionInvalid(id, pinSessionStartTime);
        if (sessionCheck.success && sessionCheck.invalid) {
          // PIN was changed after verification - force re-verification
          setIsSubmitting(false);
          setShowChecklist(false);
          setPinSessionStartTime(null);
          Alert.alert(
            'PIN Changed / NIP modifié',
            'The PIN has been changed. Please enter the new PIN to continue.\n\nLe NIP a été modifié. Veuillez entrer le nouveau NIP pour continuer.',
            [{ text: 'OK', onPress: () => setShowPinModal(true) }]
          );
          return;
        }
      } catch (error) {
        console.log('[Submit] PIN session check failed (non-blocking):', error);
        // Continue with submit - this is a security enhancement, not a blocker
      }
    }

    const status: CleaningStatus = allChecked ? 'complete' : 'attention_required';

    const logData = {
      location_id: id,
      location_name: location?.name ?? 'Unknown Location',
      staff_name: staffName.trim(),
      timestamp: new Date().toISOString(),
      status,
      notes: maintenanceNotes.trim(),
      checklist_supplies: checklist.handwashingStation && checklist.toiletPaper,
      checklist_surfaces: checklist.surfacesDisinfected,
      checklist_fixtures: checklist.fixtures && checklist.waterTemperature && checklist.ventilationLighting,
      checklist_trash: checklist.bins,
      checklist_floor: checklist.floors,
      resolved: false,
    };

    // If offline, save to queue immediately
    if (!isOnline) {
      console.log('[Submit] Offline - saving to local queue');
      addPendingLog(logData);

      setIsSubmitting(false);
      setChecklist(initialChecklist);
      setNaState(initialNaState);
      setStaffName('');
      setStaffPin('');
      setPinError(null);
      setPinSessionStartTime(null);
      setMaintenanceNotes('');
      setShowChecklist(false);
      setSavedOffline(true);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSavedOffline(false);
      }, 3500);
      return;
    }

    try {
      const result = await insertSupabaseLog(logData);

      if (!result.success) {
        console.error('[Submit] Failed to save to Supabase:', result.error);

        // If network error, save to offline queue as fallback
        if (result.error?.includes('network') || result.error?.includes('fetch')) {
          console.log('[Submit] Network error - falling back to offline queue');
          addPendingLog(logData);

          setIsSubmitting(false);
          setChecklist(initialChecklist);
          setNaState(initialNaState);
          setStaffName('');
          setStaffPin('');
          setPinError(null);
          setPinSessionStartTime(null);
          setMaintenanceNotes('');
          setShowChecklist(false);
          setSavedOffline(true);
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
            setSavedOffline(false);
          }, 3500);
          return;
        }

        setSubmitError(result.error ?? 'Failed to save. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        setSupabaseLogs(prev => [result.data!, ...prev]);
      }

      await updateWashroomLastCleaned(id);

      setSupabaseWashroom(prev => prev ? { ...prev, last_cleaned: new Date().toISOString() } : null);

      // If this is a complete cleaning, auto-resolve any previous attention-required entries
      // and auto-resolve supply/cleaning issues reported by the public
      if (status === 'complete') {
        const resolveResult = await autoResolveLogsForLocation(id);
        if (resolveResult.success && resolveResult.resolvedCount && resolveResult.resolvedCount > 0) {
          console.log(`[Submit] Auto-resolved ${resolveResult.resolvedCount} previous attention entries`);
        }

        // Also auto-resolve all open issues (status resets to Clean)
        const issueResolveResult = await autoResolveIssuesForLocation(id);
        if (issueResolveResult.success && issueResolveResult.resolvedCount && issueResolveResult.resolvedCount > 0) {
          console.log(`[Submit] Auto-resolved ${issueResolveResult.resolvedCount} open issues`);
          // Clear local open issues state so UI updates immediately
          setOpenIssues([]);
        }
      }

      if (status === 'attention_required') {
        // Use the location's alert_email, fallback to a default if not set
        const recipientEmail = supabaseWashroom?.alert_email || 'microsaasnb@proton.me';
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
          // Don't show alert - the log was saved successfully and supervisor will see it in dashboard
          // Email alerts are a nice-to-have, not critical for compliance
        }
      }

      setIsSubmitting(false);
      setChecklist(initialChecklist);
      setNaState(initialNaState);
      setStaffName('');
      setStaffPin('');
      setPinError(null);
      setPinSessionStartTime(null);
      setMaintenanceNotes('');
      setShowChecklist(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);

    } catch (error) {
      console.error('[Submit] Network exception:', error);

      // Save to offline queue on exception
      console.log('[Submit] Exception - saving to offline queue as fallback');
      addPendingLog(logData);

      setIsSubmitting(false);
      setChecklist(initialChecklist);
      setNaState(initialNaState);
      setStaffName('');
      setStaffPin('');
      setPinError(null);
      setPinSessionStartTime(null);
      setMaintenanceNotes('');
      setShowChecklist(false);
      setSavedOffline(true);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSavedOffline(false);
      }, 3500);
    }
  };

  const handleCloseChecklist = () => {
    setShowChecklist(false);
    setChecklist(initialChecklist);
    setNaState(initialNaState);
    setStaffName('');
    setStaffPin('');
    setPinError(null);
    setPinSessionStartTime(null);
    setMaintenanceNotes('');
  };

  // Loading state
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
              Loading... / Chargement...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Not found state
  if (!location) {
    return (
      <LinearGradient
        colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {isAdminView && (
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center px-4 py-2 active:opacity-70"
            >
              <ChevronLeft size={24} color={COLORS.emeraldDark} />
              <Text className="text-base font-medium" style={{ color: COLORS.emeraldDark }}>
                Back / Retour
              </Text>
            </Pressable>
          )}
          <View className="flex-1 items-center justify-center px-8">
            <AlertCircle size={48} color={COLORS.textMuted} />
            <Text
              className="text-xl font-bold text-center mt-4"
              style={{ color: COLORS.textDark }}
            >
              Location Not Found
            </Text>
            <Text
              className="text-base text-center mt-2"
              style={{ color: COLORS.textMuted }}
            >
              Emplacement introuvable
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Main public view - centered on page
  return (
    <LinearGradient
      colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Back button for admin/manager only */}
        {isAdminView && (
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center px-4 py-2 active:opacity-70"
          >
            <ChevronLeft size={24} color={COLORS.emeraldDark} />
            <Text className="text-base font-medium" style={{ color: COLORS.emeraldDark }}>
              Back / Retour
            </Text>
          </Pressable>
        )}

        {/* Offline Banner */}
        {!isOnline && (
          <View
            className="flex-row items-center justify-center px-4 py-2"
            style={{ backgroundColor: '#fbbf24' }}
          >
            <WifiOff size={16} color="#78350f" />
            <Text className="text-sm font-semibold ml-2" style={{ color: '#78350f' }}>
              Offline Mode - Logs will sync when connected
            </Text>
          </View>
        )}

        {/* Pending Sync Banner */}
        {isOnline && pendingLogsForLocation.length > 0 && (
          <View
            className="flex-row items-center justify-center px-4 py-2"
            style={{ backgroundColor: COLORS.mintLight }}
          >
            <RefreshCw size={14} color={COLORS.emeraldDark} />
            <Text className="text-sm font-medium ml-2" style={{ color: COLORS.emeraldDark }}>
              {pendingLogsForLocation.length} log(s) syncing...
            </Text>
          </View>
        )}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            // Error state - centered
            <View className="items-center justify-center">
              <WifiOff size={36} color={COLORS.textMuted} />
              <Text className="text-lg font-bold mt-4 mb-2" style={{ color: COLORS.textDark }}>
                Connection Error
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
                <Text className="text-white font-semibold ml-2">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center">
              {/* App Logo - Tap 5 times to reveal staff access */}
              <Pressable onPress={handleLogoTap}>
                <Animated.View entering={FadeIn.duration(500)} className="mb-4">
                  <AcadiaLogo size={100} />
                </Animated.View>
              </Pressable>

              {/* Main Status Card */}
              <View
                className="w-full max-w-sm rounded-2xl overflow-hidden mb-5"
                style={{
                  backgroundColor: COLORS.glass,
                  borderWidth: 2,
                  borderColor: showIssueStatus ? COLORS.red : isClean ? COLORS.emerald : needsAttention ? COLORS.amber : COLORS.glassBorder,
                  shadowColor: COLORS.emerald,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                {/* Status Header */}
                <View className="px-6 pt-8 pb-6 items-center">
                  {/* Animated Status Icon */}
                  <Animated.View style={animatedSparkleStyle} className="mb-4">
                    <View
                      className="w-20 h-20 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: showIssueStatus
                          ? COLORS.redLight
                          : isClean
                          ? COLORS.mintLight
                          : needsAttention
                          ? COLORS.amberLight
                          : COLORS.mintLight,
                      }}
                    >
                      {showIssueStatus ? (
                        <AlertOctagon size={40} color={COLORS.red} strokeWidth={1.5} />
                      ) : isClean ? (
                        <Sparkles size={40} color={COLORS.emerald} strokeWidth={1.5} />
                      ) : needsAttention ? (
                        <AlertTriangle size={40} color={COLORS.amber} strokeWidth={1.5} />
                      ) : (
                        <Clock size={40} color={COLORS.textMuted} strokeWidth={1.5} />
                      )}
                    </View>
                  </Animated.View>

                  {/* Large Status Text */}
                  <Text
                    className="text-4xl font-black text-center"
                    style={{
                      color: showIssueStatus
                        ? COLORS.red
                        : isClean
                        ? COLORS.emerald
                        : needsAttention
                        ? COLORS.amber
                        : COLORS.textMuted,
                    }}
                  >
                    {showIssueStatus ? 'ISSUE' : isClean ? 'CLEAN' : needsAttention ? 'ATTENTION' : 'PENDING'}
                  </Text>
                  <Text
                    className="text-2xl font-bold text-center mb-4"
                    style={{
                      color: showIssueStatus
                        ? COLORS.red
                        : isClean
                        ? COLORS.emeraldDark
                        : needsAttention
                        ? COLORS.amber
                        : COLORS.textDark,
                    }}
                  >
                    {showIssueStatus ? 'PROBLÈME' : isClean ? 'PROPRE' : needsAttention ? 'REQUISE' : 'EN ATTENTE'}
                  </Text>

                  {/* Business Name */}
                  <Text
                    className="text-base font-semibold mb-1"
                    style={{ color: COLORS.textDark }}
                  >
                    {location.businessName}
                  </Text>

                  {/* Location Name */}
                  <View
                    className="flex-row items-center px-4 py-2 rounded-full"
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

                {/* Issue Info - Show when there are open issues */}
                {showIssueStatus && mostRecentIssue && (
                  <View
                    className="px-6 py-4 border-t"
                    style={{ borderColor: COLORS.red, backgroundColor: COLORS.redLight }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <AlertOctagon size={16} color={COLORS.red} />
                        <Text className="text-sm ml-2 font-semibold" style={{ color: COLORS.red }}>
                          Issue Reported / Problème signalé
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs mt-1" style={{ color: COLORS.red }}>
                      {new Date(mostRecentIssue.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </View>
                )}

                {/* Last Cleaned Info */}
                {lastLog && (
                  <View
                    className="px-6 py-4 border-t"
                    style={{ borderColor: COLORS.glassBorder, backgroundColor: COLORS.mintWhite }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Clock size={16} color={COLORS.textMuted} />
                        <Text className="text-sm ml-2" style={{ color: COLORS.textMuted }}>
                          Last cleaned
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
                            Cleaned by
                          </Text>
                        </View>
                        <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                          {lastLog.staffName}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View className="w-full max-w-sm gap-3">
                {/* Report Issue */}
                <Pressable
                  onPress={handleOpenIssueModal}
                  className="flex-row items-center justify-center py-4 px-5 rounded-xl active:opacity-70"
                  style={{ backgroundColor: COLORS.red }}
                >
                  <AlertOctagon size={20} color={COLORS.white} />
                  <View className="ml-2">
                    <Text className="text-base font-bold" style={{ color: COLORS.white }}>
                      Report an Issue
                    </Text>
                    <Text className="text-xs" style={{ color: COLORS.white, opacity: 0.85 }}>
                      Signaler un problème
                    </Text>
                  </View>
                </Pressable>

                {/* Staff Access - Hidden by default, revealed by tapping logo 5 times */}
                {(showStaffButton || isAdminView) && (
                  <Pressable
                    onPress={handleOpenChecklist}
                    style={{
                      backgroundColor: showSuccess ? COLORS.emerald : 'transparent',
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: showSuccess ? 0 : 1,
                      borderColor: COLORS.glassBorder,
                    }}
                    className="active:opacity-70"
                  >
                    {showSuccess ? (
                      <View className="flex-row items-center justify-center">
                        {savedOffline ? (
                          <>
                            <WifiOff size={16} color={COLORS.white} strokeWidth={2} />
                            <Text className="text-sm font-semibold ml-2" style={{ color: COLORS.white }}>
                              Saved Offline - Will Sync
                            </Text>
                          </>
                        ) : (
                          <>
                            <Check size={18} color={COLORS.white} strokeWidth={3} />
                            <Text className="text-sm font-semibold ml-2" style={{ color: COLORS.white }}>
                              Log Saved! / Entrée enregistrée!
                            </Text>
                          </>
                        )}
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-center">
                        <Lock size={16} color={COLORS.textMuted} />
                        <Text className="text-sm font-medium ml-2" style={{ color: COLORS.textMuted }}>
                          Staff Only / Personnel uniquement
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Compliance Footer */}
              <View className="items-center mt-8">
                <View
                  className="px-4 py-2 rounded-lg flex-row items-center"
                  style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.glassBorder }}
                >
                  <CheckCircle2 size={14} color={COLORS.emerald} />
                  <Text className="text-xs font-semibold ml-1.5" style={{ color: COLORS.emerald }}>
                    Compliance Verified
                  </Text>
                </View>
                <Text className="text-xs mt-3" style={{ color: COLORS.textMuted }}>
                  Powered by <Text className="font-semibold" style={{ color: COLORS.emeraldDark }}>Acadia Clean</Text>
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Issue Report Modal - Redesigned */}
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
                className="w-full max-w-sm rounded-2xl p-5"
                style={{
                  backgroundColor: C.white,
                  borderWidth: 2,
                  borderColor: C.error,
                  ...D.shadow.lg,
                }}
                onPress={(e) => e.stopPropagation()}
              >
              {issueSuccess ? (
                <View className="items-center py-6">
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: C.emeraldLight }}
                  >
                    <Check size={32} color={C.actionGreen} strokeWidth={3} />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: C.actionGreen }}>
                    Report Sent!
                  </Text>
                  <Text className="text-sm" style={{ color: C.textMuted }}>
                    Rapport envoyé!
                  </Text>
                  <Text className="text-sm mt-1" style={{ color: C.textMuted }}>
                    Management notified / Direction avisée
                  </Text>
                </View>
              ) : (
                <>
                  {/* Header with icon */}
                  <View className="items-center mb-5">
                    <View
                      className="w-14 h-14 rounded-full items-center justify-center mb-2"
                      style={{ backgroundColor: C.errorBg, borderWidth: 2, borderColor: C.error }}
                    >
                      <AlertOctagon size={28} color={C.error} />
                    </View>
                    <Text className="text-lg font-bold" style={{ color: C.textPrimary }}>
                      Report an Issue
                    </Text>
                    <Text className="text-sm" style={{ color: C.textMuted }}>
                      Signaler un problème
                    </Text>
                  </View>

                  {/* Issue Type Dropdown */}
                  <View className="mb-4">
                    <Text className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
                      Issue Type / Type de problème
                    </Text>
                    <Pressable
                      onPress={() => setShowIssueDropdown(!showIssueDropdown)}
                      className="flex-row items-center justify-between py-3 px-3 rounded-xl"
                      style={{
                        backgroundColor: C.mintBackground,
                        borderWidth: 1,
                        borderColor: C.borderMedium,
                      }}
                    >
                      <Text
                        style={{
                          color: selectedIssueType ? C.textPrimary : C.textMuted,
                          fontSize: 15,
                        }}
                      >
                        {selectedIssueType
                          ? ISSUE_TYPES.find(t => t.value === selectedIssueType)?.label
                          : 'Select... / Sélectionner...'}
                      </Text>
                      <ChevronDown size={18} color={C.textMuted} />
                    </Pressable>

                    {showIssueDropdown && (
                      <View
                        className="mt-1 rounded-xl overflow-hidden"
                        style={{
                          backgroundColor: C.white,
                          borderWidth: 1,
                          borderColor: C.borderMedium,
                        }}
                      >
                        {ISSUE_TYPES.map((issueType, index) => (
                          <Pressable
                            key={issueType.value}
                            onPress={() => {
                              setSelectedIssueType(issueType.value);
                              setShowIssueDropdown(false);
                            }}
                            className="py-2.5 px-3 active:bg-emerald-50"
                            style={{
                              borderBottomWidth: index < ISSUE_TYPES.length - 1 ? 1 : 0,
                              borderBottomColor: C.borderLight,
                              backgroundColor: selectedIssueType === issueType.value ? C.emeraldLight : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                color: C.textPrimary,
                                fontSize: 15,
                                fontWeight: selectedIssueType === issueType.value ? '600' : '400',
                              }}
                            >
                              {issueType.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Comment/Description Field */}
                  <View className="mb-4">
                    <Text className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
                      Description (optional)
                    </Text>
                    <Text className="text-xs mb-2" style={{ color: C.textMuted }}>
                      Décrivez le problème...
                    </Text>
                    <TextInput
                      value={issueComment}
                      onChangeText={setIssueComment}
                      placeholder="Describe the issue..."
                      placeholderTextColor={C.textMuted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      style={{
                        backgroundColor: C.mintBackground,
                        borderWidth: 1,
                        borderColor: C.borderMedium,
                        borderRadius: D.borderRadius.md,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 15,
                        color: C.textPrimary,
                        minHeight: 80,
                      }}
                    />
                  </View>

                  {/* Photo Upload Button - Dark Emerald */}
                  <Pressable
                    className="flex-row items-center justify-center py-3 rounded-xl mb-4"
                    style={{
                      backgroundColor: C.emeraldDark,
                      borderRadius: D.borderRadius.md,
                    }}
                  >
                    <AlertCircle size={18} color={C.white} />
                    <Text className="text-sm font-semibold ml-2" style={{ color: C.white }}>
                      Add Photo (Coming Soon)
                    </Text>
                  </Pressable>

                  {/* Submit Button - Action Green */}
                  <Pressable
                    onPress={handleSubmitIssue}
                    disabled={!selectedIssueType || isSubmittingIssue}
                    style={{
                      backgroundColor: selectedIssueType && !isSubmittingIssue ? C.actionGreen : '#cbd5e1',
                      borderRadius: D.borderRadius.md,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                    className="active:opacity-80"
                  >
                    {isSubmittingIssue ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color={C.white} />
                        <Text className="text-base font-bold ml-2" style={{ color: C.white }}>
                          Sending... / Envoi...
                        </Text>
                      </View>
                    ) : (
                      <View className="items-center">
                        <Text
                          className="text-base font-bold"
                          style={{ color: selectedIssueType ? C.white : C.textMuted }}
                        >
                          Submit Report
                        </Text>
                        <Text
                          className="text-xs"
                          style={{ color: selectedIssueType ? 'rgba(255,255,255,0.85)' : C.textMuted }}
                        >
                          Soumettre le rapport
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={handleCloseIssueModal}
                    className="py-2.5 mt-2 items-center"
                  >
                    <Text style={{ color: C.textMuted }} className="font-medium">
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
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="items-center mb-5">
                <View
                  className="w-14 h-14 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: COLORS.mintLight }}
                >
                  <Lock size={28} color={COLORS.emerald} />
                </View>
                <Text className="text-lg font-bold" style={{ color: COLORS.textDark }}>
                  Staff Access
                </Text>
                <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                  Accès du personnel
                </Text>
                <Text className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                  Enter PIN / Entrer le NIP
                </Text>
              </View>

              <TextInput
                value={staffPin}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 5);
                  setStaffPin(cleaned);
                  if (pinError) setPinError(null);
                }}
                placeholder="••••"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={5}
                secureTextEntry
                autoFocus
                style={{
                  backgroundColor: COLORS.mintWhite,
                  borderWidth: 2,
                  borderColor: pinError ? COLORS.red : COLORS.glassBorder,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
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
                disabled={staffPin.length < 4 || isVerifyingPin}
                style={{
                  backgroundColor: staffPin.length >= 4 && !isVerifyingPin ? COLORS.emerald : '#cbd5e1',
                  borderRadius: 12,
                  paddingVertical: 14,
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
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      Verifying... / Vérification...
                    </Text>
                  </>
                ) : (
                  <Text
                    className="text-base font-bold"
                    style={{ color: staffPin.length >= 4 ? COLORS.white : COLORS.textMuted }}
                  >
                    Continue / Continuer
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleClosePinModal}
                className="py-2.5 mt-2 items-center"
              >
                <Text style={{ color: COLORS.textMuted }} className="font-medium">
                  Cancel / Annuler
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
                  className="flex-row items-center justify-between px-4 py-3"
                  style={{ backgroundColor: COLORS.emeraldDark }}
                >
                  <Pressable onPress={handleCloseChecklist} className="p-2 -ml-2">
                    <X size={24} color={COLORS.white} />
                  </Pressable>
                  <View className="items-center">
                    <Text className="text-base font-bold" style={{ color: COLORS.white }}>
                      Cleaning Log
                    </Text>
                    <Text className="text-xs" style={{ color: COLORS.white, opacity: 0.85 }}>
                      Journal de nettoyage
                    </Text>
                  </View>
                  <View className="w-8" />
                </View>

                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{
                    padding: 16,
                    maxWidth: 500,
                    width: '100%',
                    alignSelf: 'center',
                  }}
                >
                  {/* Staff Name Input */}
                  <View className="mb-5">
                    <Text className="text-sm font-bold mb-0.5" style={{ color: COLORS.textDark }}>
                      Staff Name
                    </Text>
                    <Text className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
                      Nom du personnel
                    </Text>
                    <TextInput
                      value={staffName}
                      onChangeText={setStaffName}
                      placeholder="Enter your name / Entrez votre nom"
                      placeholderTextColor={COLORS.textMuted}
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 1,
                        borderColor: COLORS.glassBorder,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        fontSize: 16,
                        color: COLORS.textDark,
                      }}
                    />
                  </View>

                  {/* Checklist Items */}
                  <View className="mb-5">
                    <Text className="text-sm font-bold mb-0.5" style={{ color: COLORS.textDark }}>
                      Checklist
                    </Text>
                    <Text className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
                      Liste de contrôle
                    </Text>

                    {CHECKLIST_SECTIONS.map((section) => {
                      const sectionItems = CHECKLIST_ITEMS.filter(item => item.section === section.id);
                      return (
                        <View key={section.id} className="mb-4">
                          {/* Section Header - Bilingual */}
                          <View className="mb-2 px-1">
                            <Text className="font-semibold text-xs" style={{ color: COLORS.emeraldDark }}>
                              {section.titleEn}
                            </Text>
                            <Text className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                              {section.titleFr}
                            </Text>
                          </View>

                          {/* Section Items */}
                          <View
                            className="rounded-xl overflow-hidden"
                            style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.glassBorder }}
                          >
                            {sectionItems.map((item, index) => {
                              const isChecked = checklist[item.key as keyof ChecklistState];
                              const isNa = item.hasNaOption && naState[item.key as keyof NaState];
                              const isDisabled = isNa; // Disable main checkbox when N/A is selected
                              return (
                                <View
                                  key={item.key}
                                  style={{
                                    borderBottomWidth: index < sectionItems.length - 1 ? 1 : 0,
                                    borderBottomColor: COLORS.glassBorder,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => !isDisabled && handleToggleCheck(item.key as keyof ChecklistState)}
                                    className="flex-row items-start p-3 active:bg-emerald-50"
                                    style={{ opacity: isDisabled ? 0.5 : 1 }}
                                  >
                                    <View className="mt-0.5">
                                      {isChecked ? (
                                        <CheckSquare size={22} color={COLORS.emerald} />
                                      ) : (
                                        <Square size={22} color={COLORS.textMuted} />
                                      )}
                                    </View>
                                    <View className="ml-2.5 flex-1">
                                      {/* English label */}
                                      <Text
                                        className="font-medium"
                                        style={{
                                          color: isChecked ? COLORS.textDark : COLORS.textMuted,
                                          fontSize: 13,
                                          textDecorationLine: isNa ? 'line-through' : 'none',
                                        }}
                                      >
                                        {item.labelEn}
                                      </Text>
                                      {/* French label */}
                                      <Text
                                        className="mt-1"
                                        style={{
                                          color: isChecked ? COLORS.textMuted : '#9ca3af',
                                          fontSize: 11,
                                          fontStyle: 'italic',
                                          textDecorationLine: isNa ? 'line-through' : 'none',
                                        }}
                                      >
                                        {item.labelFr}
                                      </Text>
                                    </View>
                                  </Pressable>

                                  {/* N/A Option for items that support it */}
                                  {item.hasNaOption && (
                                    <Pressable
                                      onPress={() => handleToggleNa(item.key as keyof NaState)}
                                      className="flex-row items-center px-3 pb-3 pt-0"
                                    >
                                      <View
                                        className="w-5 h-5 rounded border-2 items-center justify-center mr-2"
                                        style={{
                                          borderColor: isNa ? COLORS.amber : COLORS.textMuted,
                                          backgroundColor: isNa ? COLORS.amberLight : 'transparent',
                                        }}
                                      >
                                        {isNa && <Check size={12} color={COLORS.amber} strokeWidth={3} />}
                                      </View>
                                      <Text
                                        className="text-xs font-medium"
                                        style={{ color: isNa ? COLORS.amber : COLORS.textMuted }}
                                      >
                                        N/A - Not Applicable / Non applicable
                                      </Text>
                                    </Pressable>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Maintenance Notes */}
                  <View className="mb-5">
                    <View className="flex-row items-center mb-0.5">
                      <Text className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                        Notes
                      </Text>
                      {hasUnchecked && (
                        <Text className="text-xs font-bold ml-2" style={{ color: COLORS.red }}>
                          *Required / Requis
                        </Text>
                      )}
                    </View>
                    <Text className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
                      Remarques
                    </Text>
                    <TextInput
                      value={maintenanceNotes}
                      onChangeText={setMaintenanceNotes}
                      placeholder="Describe any issues... / Décrivez les problèmes..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 1,
                        borderColor: needsNotes ? COLORS.amber : COLORS.glassBorder,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 15,
                        color: COLORS.textDark,
                        minHeight: 80,
                      }}
                    />
                  </View>
                </ScrollView>

                {/* Submit Button */}
                <View
                  className="px-4 pb-4 pt-2"
                  style={{ backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}
                >
                  {submitError && (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                      <View className="flex-row items-center mb-1">
                        <WifiOff size={16} color={COLORS.red} />
                        <Text className="text-sm font-semibold text-red-800 ml-1.5">
                          Failed to save / Échec de l'enregistrement
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSubmitError(null);
                          handleSubmit();
                        }}
                        disabled={isSubmitting}
                        className="flex-row items-center justify-center bg-red-600 py-2 rounded-lg active:bg-red-700 mt-1"
                      >
                        <RefreshCw size={14} color="#ffffff" />
                        <Text className="text-white font-semibold ml-1.5 text-sm">Retry / Réessayer</Text>
                      </Pressable>
                    </View>
                  )}

                  {staffName.trim() && (
                    <View className="rounded-lg p-2.5 mb-2" style={{ backgroundColor: COLORS.mintLight }}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <User size={14} color={COLORS.emeraldDark} />
                          <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.emeraldDark }}>
                            {staffName.trim()}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Clock size={14} color={COLORS.emeraldDark} />
                          <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.emeraldDark }}>
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
                      paddingVertical: 16,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                    className="active:opacity-80"
                  >
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color={COLORS.white} />
                        <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                          Submitting... / Soumission...
                        </Text>
                      </>
                    ) : (
                      <Text
                        className="text-base font-bold"
                        style={{ color: canSubmit ? COLORS.white : COLORS.textMuted }}
                      >
                        Submit / Soumettre
                      </Text>
                    )}
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </LinearGradient>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
