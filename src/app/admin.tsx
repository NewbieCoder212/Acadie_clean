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
  Switch,
  Platform,
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
  ClipboardList,
  AlertTriangle,
  X,
  Check,
  Download,
  Calendar,
  QrCode,
  TrendingUp,
  Crown,
  Key,
  Clock,
  Eye,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  BusinessRow,
  getAllBusinesses,
  getAllLogs,
  getOpenReportedIssues,
  insertBusiness,
  getAllLocations,
  getAllWashrooms,
  toggleBusinessActive,
  updateBusinessSubscriptionTier,
  getLogsForDateRange,
  getLogsForBusinessByNameAndDateRange,
  getQrScanStatsForLocations,
  LocationRow,
  WashroomRow,
  CleaningLogRow,
  ReportedIssueRow,
  QrScanStatRow,
  SubscriptionTier,
  getBusinessesNeedingTrialReminder,
  markTrialReminderSent,
  logoutBusiness,
  extendTrial,
} from '@/lib/supabase';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { sendTrialExpiryReminderToAdmin } from '@/lib/email';

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

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<BusinessRow | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [washrooms, setWashrooms] = useState<WashroomRow[]>([]);
  const [logs, setLogs] = useState<CleaningLogRow[]>([]);
  const [issues, setIssues] = useState<ReportedIssueRow[]>([]);
  const [qrScanStats, setQrScanStats] = useState<QrScanStatRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Export History state (all businesses)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [exportEndDate, setExportEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Per-business export state
  const [showBusinessExportModal, setShowBusinessExportModal] = useState(false);
  const [exportingBusiness, setExportingBusiness] = useState<BusinessRow | null>(null);
  const [businessExportStartDate, setBusinessExportStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [businessExportEndDate, setBusinessExportEndDate] = useState(new Date());
  const [showBusinessStartPicker, setShowBusinessStartPicker] = useState(false);
  const [showBusinessEndPicker, setShowBusinessEndPicker] = useState(false);
  const [isBusinessExporting, setIsBusinessExporting] = useState(false);
  const [businessExportSuccess, setBusinessExportSuccess] = useState(false);

  // Trial management state
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialBusiness, setTrialBusiness] = useState<BusinessRow | null>(null);
  const [isExtendingTrial, setIsExtendingTrial] = useState(false);

  // Quick view modal state
  const [showQuickViewModal, setShowQuickViewModal] = useState(false);
  const [quickViewBusiness, setQuickViewBusiness] = useState<BusinessRow | null>(null);
  const [quickViewTab, setQuickViewTab] = useState<'logs' | 'issues'>('logs');

  // New business form
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessEmail, setNewBusinessEmail] = useState('');
  const [newBusinessPassword, setNewBusinessPassword] = useState('');
  const [newBusinessTrialDays, setNewBusinessTrialDays] = useState(14); // Default 14 days

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const stored = await AsyncStorage.getItem('currentBusiness');
      if (stored) {
        try {
          const business = JSON.parse(stored) as BusinessRow;
          if (business?.is_admin) {
            setCurrentAdmin(business);
            loadData();
            return;
          }
        } catch (parseError) {
          // Invalid JSON in storage, clear it
          await AsyncStorage.removeItem('currentBusiness');
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
      const [businessesResult, locationsResult, washroomsResult, logsResult, issuesResult] = await Promise.all([
        getAllBusinesses(),
        getAllLocations(),
        getAllWashrooms(),
        getAllLogs(),
        getOpenReportedIssues(),
      ]);

      if (businessesResult.success) {
        setBusinesses(businessesResult.data?.filter(b => !b.is_admin) ?? []);
      }
      if (locationsResult.success) {
        setLocations(locationsResult.data ?? []);
      }
      if (washroomsResult.success) {
        setWashrooms(washroomsResult.data ?? []);

        // Fetch QR scan stats for all washrooms
        const washroomIds = washroomsResult.data?.map(w => w.id) ?? [];
        if (washroomIds.length > 0) {
          const qrStatsResult = await getQrScanStatsForLocations(washroomIds);
          if (qrStatsResult.success) {
            setQrScanStats(qrStatsResult.data ?? []);
          }
        }
      }
      if (logsResult.success) {
        setLogs(logsResult.data ?? []);
      }
      if (issuesResult.success) {
        setIssues(issuesResult.data ?? []);
      }

      // Check for businesses with expiring trials and send email reminders
      checkAndSendTrialReminders();
    } catch (error) {
      console.error('[Admin] Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for businesses needing trial reminders and send emails
  const checkAndSendTrialReminders = async () => {
    try {
      const result = await getBusinessesNeedingTrialReminder();
      if (!result.success || !result.data || result.data.length === 0) {
        return; // No businesses need reminders
      }

      console.log(`[Admin] Found ${result.data.length} businesses needing trial reminders`);

      // Send email for each business
      for (const business of result.data) {
        try {
          const emailResult = await sendTrialExpiryReminderToAdmin({
            businessName: business.name,
            businessEmail: business.email,
            daysRemaining: Math.floor(business.days_remaining),
            trialEndsAt: new Date(business.trial_ends_at),
          });

          if (emailResult.success) {
            // Mark reminder as sent so we don't send again for 7 days
            await markTrialReminderSent(business.id);
            console.log(`[Admin] Trial reminder sent for: ${business.name}`);
          }
        } catch (emailError) {
          console.error(`[Admin] Failed to send reminder for ${business.name}:`, emailError);
        }
      }
    } catch (error) {
      console.error('[Admin] Error checking trial reminders:', error);
    }
  };

  const handleLogout = async () => {
    await logoutBusiness();
    await AsyncStorage.removeItem('currentBusiness');
    router.replace('/admin-login');
  };

  const handleAddBusiness = async () => {
    if (!newBusinessName.trim() || !newBusinessEmail.trim() || !newBusinessPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newBusinessEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate password length (Supabase requires at least 6 characters)
    if (newBusinessPassword.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsCreating(true);
    try {
      console.log('[Admin] Creating business:', newBusinessName.trim(), newBusinessEmail.trim());

      const result = await insertBusiness({
        name: newBusinessName.trim(),
        email: newBusinessEmail.trim(),
        password: newBusinessPassword.trim(),
        is_admin: false,
        trial_days: newBusinessTrialDays,
      });

      console.log('[Admin] Create business result:', result.success, result.error);

      if (result.success) {
        setShowAddModal(false);
        setNewBusinessName('');
        setNewBusinessEmail('');
        setNewBusinessPassword('');
        setNewBusinessTrialDays(14); // Reset to default
        loadData();
        Alert.alert('Success', `Business created successfully with ${newBusinessTrialDays}-day trial`);
      } else {
        Alert.alert('Error', result.error || 'Failed to create business');
      }
    } catch (error) {
      console.error('[Admin] Create business error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleBusinessActive = async (business: BusinessRow) => {
    const newStatus = !business.is_active;
    const actionText = newStatus ? 'enable' : 'disable';

    Alert.alert(
      `${newStatus ? 'Enable' : 'Disable'} Business`,
      `Are you sure you want to ${actionText} "${business.name}"? ${!newStatus ? 'They will not be able to log in.' : 'They will be able to log in again.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Enable' : 'Disable',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            const result = await toggleBusinessActive(business.id, newStatus);
            if (result.success) {
              await loadData();
            } else {
              Alert.alert('Error', result.error || 'Failed to update business status');
            }
          },
        },
      ]
    );
  };

  const handleToggleSubscriptionTier = async (business: BusinessRow) => {
    const currentTier = business.subscription_tier || 'standard';
    const newTier: SubscriptionTier = currentTier === 'standard' ? 'premium' : 'standard';

    Alert.alert(
      `Change Subscription Tier`,
      `Change "${business.name}" from ${currentTier.toUpperCase()} to ${newTier.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Switch to ${newTier}`,
          onPress: async () => {
            const result = await updateBusinessSubscriptionTier(business.id, newTier);
            if (result.success) {
              await loadData();
            } else {
              Alert.alert('Error', result.error || 'Failed to update subscription tier');
            }
          },
        },
      ]
    );
  };

  const getLocationCountForBusiness = (business: BusinessRow) => {
    // Count locations linked by business_id
    const locationCount = locations.filter(loc => loc.business_id === business.id).length;
    // Count washrooms linked by business_name
    const washroomCount = washrooms.filter(w => w.business_name === business.name).length;
    return locationCount + washroomCount;
  };

  // Get logs count for a specific business
  const getLogsCountForBusiness = (business: BusinessRow) => {
    const businessWashroomIds = washrooms
      .filter(w => w.business_name === business.name)
      .map(w => w.id);
    return logs.filter(log => businessWashroomIds.includes(log.location_id)).length;
  };

  // Get open issues count for a specific business
  const getOpenIssuesCountForBusiness = (business: BusinessRow) => {
    const businessWashroomIds = washrooms
      .filter(w => w.business_name === business.name)
      .map(w => w.id);
    return issues.filter(issue =>
      businessWashroomIds.includes(issue.location_id) && issue.status === 'open'
    ).length;
  };

  // Get logs for a specific business (for quick view)
  const getLogsForBusiness = (business: BusinessRow) => {
    const businessWashroomIds = washrooms
      .filter(w => w.business_name === business.name)
      .map(w => w.id);
    return logs.filter(log => businessWashroomIds.includes(log.location_id));
  };

  // Get issues for a specific business (for quick view)
  const getIssuesForBusiness = (business: BusinessRow) => {
    const businessWashroomIds = washrooms
      .filter(w => w.business_name === business.name)
      .map(w => w.id);
    return issues.filter(issue => businessWashroomIds.includes(issue.location_id));
  };

  // Get trial days remaining for a business
  const getTrialDaysRemaining = (business: BusinessRow) => {
    if (!business.trial_ends_at) return null;
    const trialEnd = new Date(business.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Handle extending trial
  const handleExtendTrial = async (days: number) => {
    if (!trialBusiness) return;

    setIsExtendingTrial(true);
    try {
      const result = await extendTrial(trialBusiness.id, days);
      if (result.success) {
        Alert.alert('Success', `Trial extended by ${days} days!`);
        setShowTrialModal(false);
        setTrialBusiness(null);
        await loadData();
      } else {
        Alert.alert('Error', result.error || 'Failed to extend trial');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsExtendingTrial(false);
    }
  };

  // Open trial management modal
  const openTrialModal = (business: BusinessRow) => {
    setTrialBusiness(business);
    setShowTrialModal(true);
  };

  // Open quick view modal
  const openQuickViewModal = (business: BusinessRow, tab: 'logs' | 'issues') => {
    setQuickViewBusiness(business);
    setQuickViewTab(tab);
    setShowQuickViewModal(true);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate CSV for export
  const generateAdminCSV = (logsData: CleaningLogRow[]): string => {
    const headers = [
      'Date/Time',
      'Business',
      'Location',
      'Staff Name',
      'Supplies',
      'Toilet Paper',
      'Bins',
      'Surfaces',
      'Fixtures',
      'Water Temp',
      'Floors',
      'Ventilation',
      'Status',
      'Notes'
    ].join(',');

    const rows = logsData.map((log) => {
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString('en-US');
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const notes = (log.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
      // Find business name from washroom
      const washroom = washrooms.find(w => w.id === log.location_id);
      const businessName = washroom?.business_name || 'Unknown';

      return [
        `"${dateStr} ${timeStr}"`,
        `"${businessName}"`,
        `"${log.location_name || 'Unknown'}"`,
        `"${log.staff_name || 'Unknown'}"`,
        log.checklist_supplies ? 'Yes' : 'No',
        log.checklist_supplies ? 'Yes' : 'No',
        log.checklist_trash ? 'Yes' : 'No',
        log.checklist_surfaces ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.checklist_floor ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.status === 'complete' ? 'Complete' : 'Attention Required',
        `"${notes}"`
      ].join(',');
    });

    return `Acadia Clean - Admin Export\nDate Range: ${formatDate(exportStartDate)} to ${formatDate(exportEndDate)}\nTotal Records: ${logsData.length}\n\n${headers}\n${rows.join('\n')}`;
  };

  // Handle export
  const handleExportHistory = async () => {
    if (exportStartDate > exportEndDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      const startDate = new Date(exportStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(exportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const result = await getLogsForDateRange(startDate, endDate);

      if (!result.success || !result.data || result.data.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the selected date range');
        setIsExporting(false);
        return;
      }

      const csv = generateAdminCSV(result.data);
      const startStr = exportStartDate.toISOString().split('T')[0];
      const endStr = exportEndDate.toISOString().split('T')[0];
      const fileName = `acadia-clean-export-${startStr}-to-${endStr}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExportSuccess(true);
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csv);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
          setExportSuccess(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate CSV for a specific business
  const generateBusinessCSV = (logsData: CleaningLogRow[], businessName: string) => {
    const headers = 'Date/Time,Location,Staff,Supplies,Mirrors,Trash,Surfaces,Toilets,Urinals,Floor,Dispensers,Status,Notes';
    const rows = logsData.map(log => {
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString('en-CA');
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const notes = (log.notes || '').replace(/"/g, '""');

      return [
        `"${dateStr} ${timeStr}"`,
        `"${log.location_name || 'Unknown'}"`,
        `"${log.staff_name || 'Unknown'}"`,
        log.checklist_supplies ? 'Yes' : 'No',
        log.checklist_supplies ? 'Yes' : 'No',
        log.checklist_trash ? 'Yes' : 'No',
        log.checklist_surfaces ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.checklist_floor ? 'Yes' : 'No',
        log.checklist_fixtures ? 'Yes' : 'No',
        log.status === 'complete' ? 'Complete' : 'Attention Required',
        `"${notes}"`
      ].join(',');
    });

    const formatDate = (date: Date) => date.toLocaleDateString('en-CA');
    return `${businessName} - Cleaning Log Export\nDate Range: ${formatDate(businessExportStartDate)} to ${formatDate(businessExportEndDate)}\nTotal Records: ${logsData.length}\n\n${headers}\n${rows.join('\n')}`;
  };

  // Handle per-business export
  const handleBusinessExport = async () => {
    if (!exportingBusiness) return;

    if (businessExportStartDate > businessExportEndDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    setIsBusinessExporting(true);
    setBusinessExportSuccess(false);

    try {
      const startDate = new Date(businessExportStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(businessExportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const result = await getLogsForBusinessByNameAndDateRange(exportingBusiness.name, startDate, endDate);

      if (!result.success || !result.data || result.data.length === 0) {
        Alert.alert('No Data', `No cleaning logs found for ${exportingBusiness.name} in the selected date range`);
        setIsBusinessExporting(false);
        return;
      }

      const csv = generateBusinessCSV(result.data, exportingBusiness.name);
      const startStr = businessExportStartDate.toISOString().split('T')[0];
      const endStr = businessExportEndDate.toISOString().split('T')[0];
      const safeName = exportingBusiness.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const fileName = `${safeName}-export-${startStr}-to-${endStr}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setBusinessExportSuccess(true);
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csv);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
          setBusinessExportSuccess(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsBusinessExporting(false);
    }
  };

  // Open business export modal
  const openBusinessExportModal = (business: BusinessRow) => {
    setExportingBusiness(business);
    setBusinessExportStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    setBusinessExportEndDate(new Date());
    setBusinessExportSuccess(false);
    setShowBusinessExportModal(true);
  };

  const openIssueCount = issues.filter(i => i.status === 'open').length;
  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    const today = new Date();
    return logDate.toDateString() === today.toDateString();
  }).length;

  // Calculate QR scan statistics
  const getQrScansForBusiness = (businessName: string) => {
    const businessWashrooms = washrooms.filter(w => w.business_name === businessName);
    const washroomIds = businessWashrooms.map(w => w.id);
    const businessStats = qrScanStats.filter(s => washroomIds.includes(s.location_id));

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const todayScans = businessStats
      .filter(s => s.scan_date === today)
      .reduce((sum, s) => sum + s.total_scans, 0);

    const last7DaysScans = businessStats
      .filter(s => s.scan_date >= sevenDaysAgoStr)
      .reduce((sum, s) => sum + s.total_scans, 0);

    const totalScans = businessStats.reduce((sum, s) => sum + s.total_scans, 0);

    return { todayScans, last7DaysScans, totalScans };
  };

  const totalQrScansToday = qrScanStats
    .filter(s => s.scan_date === new Date().toISOString().split('T')[0])
    .reduce((sum, s) => sum + s.total_scans, 0);

  const totalQrScans7Days = (() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    return qrScanStats
      .filter(s => s.scan_date >= sevenDaysAgoStr)
      .reduce((sum, s) => sum + s.total_scans, 0);
  })();

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
            <AcadiaLogo size={40} showText={false} />
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
              <Pressable
                onPress={() => {
                  setExportSuccess(false);
                  setShowExportModal(true);
                }}
                className="flex-1 flex-row items-center justify-center py-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: '#2563eb' }}
              >
                <Download size={20} color={COLORS.white} />
                <Text className="font-bold ml-2" style={{ color: COLORS.white }}>
                  Export History
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Businesses List */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-bold"
                style={{ color: COLORS.textDark }}
              >
                Businesses
              </Text>
              <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                Tap switch to enable/disable
              </Text>
            </View>

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
                  <View
                    key={business.id}
                    className="p-4"
                    style={{
                      borderBottomWidth: index < businesses.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.glassBorder,
                      backgroundColor: business.is_active ? 'transparent' : '#fef2f2',
                    }}
                  >
                    {/* Top row: Business info and toggle */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View
                          className="w-12 h-12 rounded-xl items-center justify-center"
                          style={{ backgroundColor: business.is_active ? COLORS.primaryLight : '#fee2e2' }}
                        >
                          <Building2 size={24} color={business.is_active ? COLORS.primary : COLORS.error} />
                        </View>
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center">
                            <Text
                              className="text-base font-semibold"
                              style={{
                                color: business.is_active ? COLORS.textDark : COLORS.textMuted,
                                textDecorationLine: business.is_active ? 'none' : 'line-through',
                              }}
                            >
                              {business.name}
                            </Text>
                            {/* Subscription Tier Badge */}
                            <View
                              className="ml-2 px-2 py-0.5 rounded-full flex-row items-center"
                              style={{
                                backgroundColor: (business.subscription_tier || 'standard') === 'premium' ? '#fef3c7' : '#f1f5f9',
                              }}
                            >
                              {(business.subscription_tier || 'standard') === 'premium' && (
                                <Crown size={10} color="#d97706" style={{ marginRight: 2 }} />
                              )}
                              <Text
                                className="text-xs font-semibold"
                                style={{
                                  color: (business.subscription_tier || 'standard') === 'premium' ? '#d97706' : '#64748b',
                                }}
                              >
                                {(business.subscription_tier || 'standard').toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                            {business.email}
                          </Text>
                          {/* Staff PIN display */}
                          {business.staff_pin_display && (
                            <View className="flex-row items-center mt-1">
                              <Key size={12} color="#d97706" />
                              <Text className="text-xs font-mono ml-1" style={{ color: '#d97706' }}>
                                PIN: {business.staff_pin_display}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Switch Toggle */}
                      <View className="items-center">
                        <Switch
                          value={business.is_active}
                          onValueChange={() => handleToggleBusinessActive(business)}
                          trackColor={{ false: '#fca5a5', true: '#86efac' }}
                          thumbColor={business.is_active ? COLORS.success : COLORS.error}
                          ios_backgroundColor="#fca5a5"
                        />
                        <Text
                          className="text-xs mt-1 font-medium"
                          style={{ color: business.is_active ? COLORS.success : COLORS.error }}
                        >
                          {business.is_active ? 'Active' : 'Disabled'}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom row: Stats and navigate button */}
                    <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                      <View className="flex-row items-center flex-wrap gap-y-1">
                        <MapPin size={14} color={COLORS.textMuted} />
                        <Text className="text-xs ml-1 mr-3" style={{ color: COLORS.textMuted }}>
                          {getLocationCountForBusiness(business)} locations
                        </Text>
                        {/* Tappable logs count */}
                        <Pressable
                          onPress={() => openQuickViewModal(business, 'logs')}
                          className="flex-row items-center active:opacity-70"
                        >
                          <ClipboardList size={14} color={COLORS.success} />
                          <Text className="text-xs ml-1 mr-3 underline" style={{ color: COLORS.success }}>
                            {getLogsCountForBusiness(business)} logs
                          </Text>
                        </Pressable>
                        {/* Tappable issues count */}
                        <Pressable
                          onPress={() => openQuickViewModal(business, 'issues')}
                          className="flex-row items-center active:opacity-70"
                        >
                          <AlertTriangle size={14} color={getOpenIssuesCountForBusiness(business) > 0 ? COLORS.warning : COLORS.textMuted} />
                          <Text className="text-xs ml-1 mr-3 underline" style={{ color: getOpenIssuesCountForBusiness(business) > 0 ? COLORS.warning : COLORS.textMuted }}>
                            {getOpenIssuesCountForBusiness(business)} issues
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Trial Status Row */}
                    {business.subscription_status === 'trial' && business.trial_ends_at && (
                      <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                        <View className="flex-row items-center">
                          <Clock size={14} color={getTrialDaysRemaining(business) !== null && getTrialDaysRemaining(business)! <= 7 ? COLORS.warning : '#2563eb'} />
                          <Text className="text-xs ml-1" style={{ color: getTrialDaysRemaining(business) !== null && getTrialDaysRemaining(business)! <= 7 ? COLORS.warning : '#2563eb' }}>
                            Trial: {getTrialDaysRemaining(business)} days left
                          </Text>
                          <Text className="text-xs ml-2" style={{ color: COLORS.textMuted }}>
                            (ends {formatDate(new Date(business.trial_ends_at))})
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => openTrialModal(business)}
                          className="flex-row items-center px-2 py-1 rounded-md active:opacity-70"
                          style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
                        >
                          <Calendar size={12} color="#2563eb" />
                          <Text className="text-xs font-medium ml-1" style={{ color: '#2563eb' }}>
                            Extend
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Actions row */}
                    <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                      <View className="flex-row items-center">
                        {/* Subscription Tier Toggle */}
                        <Pressable
                          onPress={() => handleToggleSubscriptionTier(business)}
                          className="flex-row items-center px-2 py-1 rounded-md active:opacity-70"
                          style={{
                            backgroundColor: (business.subscription_tier || 'standard') === 'premium' ? '#fef3c7' : '#f1f5f9',
                            borderWidth: 1,
                            borderColor: (business.subscription_tier || 'standard') === 'premium' ? '#fcd34d' : '#e2e8f0',
                          }}
                        >
                          <Crown
                            size={12}
                            color={(business.subscription_tier || 'standard') === 'premium' ? '#d97706' : '#94a3b8'}
                          />
                          <Text
                            className="text-xs font-medium ml-1"
                            style={{
                              color: (business.subscription_tier || 'standard') === 'premium' ? '#d97706' : '#64748b',
                            }}
                          >
                            {(business.subscription_tier || 'standard') === 'premium' ? 'Downgrade' : 'Upgrade'}
                          </Text>
                        </Pressable>
                      </View>

                      <View className="flex-row items-center">
                        {/* Export Button */}
                        <Pressable
                          onPress={() => openBusinessExportModal(business)}
                          className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70 mr-2"
                          style={{ backgroundColor: '#dcfce7' }}
                        >
                          <Download size={14} color="#16a34a" />
                          <Text className="text-xs font-semibold ml-1" style={{ color: '#16a34a' }}>
                            Export
                          </Text>
                        </Pressable>

                        {/* View Details Button */}
                        <Pressable
                          onPress={() => router.push(`/admin/business/${business.id}`)}
                          className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                          style={{ backgroundColor: COLORS.primaryLight }}
                        >
                          <Text className="text-xs font-semibold mr-1" style={{ color: COLORS.primary }}>
                            View Details
                          </Text>
                          <ChevronRight size={14} color={COLORS.primary} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
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

          {/* QR Scan Analytics - Admin Only */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-6 mb-6">
            <View className="flex-row items-center mb-3">
              <QrCode size={20} color={COLORS.primary} />
              <Text
                className="text-lg font-bold ml-2"
                style={{ color: COLORS.textDark }}
              >
                QR Scan Analytics
              </Text>
            </View>

            {/* Overview Stats */}
            <View
              className="flex-row gap-3 mb-4"
            >
              <View
                className="flex-1 p-4 rounded-2xl"
                style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}
              >
                <Text className="text-2xl font-bold" style={{ color: '#16a34a' }}>
                  {totalQrScansToday}
                </Text>
                <Text className="text-xs" style={{ color: '#15803d' }}>
                  Scans Today
                </Text>
              </View>
              <View
                className="flex-1 p-4 rounded-2xl"
                style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
              >
                <Text className="text-2xl font-bold" style={{ color: '#2563eb' }}>
                  {totalQrScans7Days}
                </Text>
                <Text className="text-xs" style={{ color: '#1d4ed8' }}>
                  Last 7 Days
                </Text>
              </View>
            </View>

            {/* Per-Business Breakdown */}
            {businesses.length > 0 && (
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <View className="px-4 py-3 border-b" style={{ borderBottomColor: COLORS.glassBorder, backgroundColor: '#faf5ff' }}>
                  <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                    Scans by Business
                  </Text>
                </View>
                {businesses.map((business, index) => {
                  const stats = getQrScansForBusiness(business.name);
                  return (
                    <View
                      key={business.id}
                      className="flex-row items-center justify-between px-4 py-3"
                      style={{
                        borderBottomWidth: index < businesses.length - 1 ? 1 : 0,
                        borderBottomColor: COLORS.glassBorder,
                      }}
                    >
                      <View className="flex-1">
                        <Text className="text-sm font-medium" style={{ color: COLORS.textDark }}>
                          {business.name}
                        </Text>
                        <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                          {getLocationCountForBusiness(business)} locations
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-4">
                        <View className="items-center">
                          <Text className="text-sm font-bold" style={{ color: '#16a34a' }}>
                            {stats.todayScans}
                          </Text>
                          <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                            today
                          </Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold" style={{ color: '#2563eb' }}>
                            {stats.last7DaysScans}
                          </Text>
                          <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                            7 days
                          </Text>
                        </View>
                        <View className="items-center">
                          <Text className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                            {stats.totalScans}
                          </Text>
                          <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                            30 days
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {qrScanStats.length === 0 && (
              <View
                className="p-4 rounded-2xl items-center"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <QrCode size={32} color={COLORS.textMuted} />
                <Text className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
                  No QR scans recorded yet
                </Text>
                <Text className="text-xs text-center mt-1" style={{ color: COLORS.textMuted }}>
                  Scans will appear here when customers view washroom status pages
                </Text>
              </View>
            )}
          </Animated.View>

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

              <View className="mb-4">
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

              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Free Trial Length
                </Text>
                <View className="flex-row gap-2">
                  {[7, 14, 30, 60, 90].map((days) => (
                    <Pressable
                      key={days}
                      onPress={() => setNewBusinessTrialDays(days)}
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{
                        backgroundColor: newBusinessTrialDays === days ? COLORS.primary : COLORS.primaryLight,
                      }}
                    >
                      <Text
                        className="text-sm font-bold"
                        style={{ color: newBusinessTrialDays === days ? COLORS.white : COLORS.textDark }}
                      >
                        {days}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: newBusinessTrialDays === days ? COLORS.white : COLORS.textMuted }}
                      >
                        days
                      </Text>
                    </Pressable>
                  ))}
                </View>
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

        {/* Export History Modal */}
        <Modal
          visible={showExportModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowExportModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold" style={{ color: COLORS.textDark }}>
                  Export History
                </Text>
                <Pressable onPress={() => setShowExportModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              {/* Start Date */}
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Start Date
                </Text>
                <Pressable
                  onPress={() => setShowStartPicker(true)}
                  className="flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: COLORS.primaryLight }}
                >
                  <Calendar size={20} color={COLORS.primary} />
                  <Text className="ml-3 text-base" style={{ color: COLORS.textDark }}>
                    {formatDate(exportStartDate)}
                  </Text>
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker
                    value={exportStartDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowStartPicker(Platform.OS === 'ios');
                      if (date) setExportStartDate(date);
                    }}
                    maximumDate={new Date()}
                  />
                )}
              </View>

              {/* End Date */}
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  End Date
                </Text>
                <Pressable
                  onPress={() => setShowEndPicker(true)}
                  className="flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: COLORS.primaryLight }}
                >
                  <Calendar size={20} color={COLORS.primary} />
                  <Text className="ml-3 text-base" style={{ color: COLORS.textDark }}>
                    {formatDate(exportEndDate)}
                  </Text>
                </Pressable>
                {showEndPicker && (
                  <DateTimePicker
                    value={exportEndDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowEndPicker(Platform.OS === 'ios');
                      if (date) setExportEndDate(date);
                    }}
                    maximumDate={new Date()}
                  />
                )}
              </View>

              {/* Export Success Message */}
              {exportSuccess && (
                <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#dcfce7' }}>
                  <View className="flex-row items-center">
                    <Check size={20} color="#16a34a" />
                    <Text className="ml-2 font-semibold" style={{ color: '#16a34a' }}>
                      Export completed successfully!
                    </Text>
                  </View>
                  <Text className="text-sm mt-1" style={{ color: '#15803d' }}>
                    Your CSV file has been downloaded/shared.
                  </Text>
                </View>
              )}

              {/* Export Button */}
              <Pressable
                onPress={handleExportHistory}
                disabled={isExporting}
                className="rounded-xl py-4 items-center active:opacity-80"
                style={{ backgroundColor: '#2563eb' }}
              >
                {isExporting ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color={COLORS.white} />
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      Exporting...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Download size={20} color={COLORS.white} />
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      {exportSuccess ? 'Export Again' : 'Export CSV'}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Info text */}
              <Text className="text-xs text-center mt-3" style={{ color: COLORS.textMuted }}>
                Exports all cleaning logs for all businesses within the selected date range
              </Text>
            </View>
          </View>
        </Modal>

        {/* Per-Business Export Modal */}
        <Modal
          visible={showBusinessExportModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowBusinessExportModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold" style={{ color: COLORS.textDark }}>
                  Export Logs
                </Text>
                <Pressable onPress={() => setShowBusinessExportModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              {/* Business Name */}
              <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryLight }}>
                <Text className="text-sm" style={{ color: COLORS.textMuted }}>Business</Text>
                <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                  {exportingBusiness?.name}
                </Text>
              </View>

              {/* Start Date */}
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Start Date
                </Text>
                <Pressable
                  onPress={() => setShowBusinessStartPicker(true)}
                  className="flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <Calendar size={20} color="#16a34a" />
                  <Text className="ml-3 text-base" style={{ color: COLORS.textDark }}>
                    {formatDate(businessExportStartDate)}
                  </Text>
                </Pressable>
                {showBusinessStartPicker && (
                  <DateTimePicker
                    value={businessExportStartDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowBusinessStartPicker(Platform.OS === 'ios');
                      if (date) setBusinessExportStartDate(date);
                    }}
                    maximumDate={new Date()}
                  />
                )}
              </View>

              {/* End Date */}
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  End Date
                </Text>
                <Pressable
                  onPress={() => setShowBusinessEndPicker(true)}
                  className="flex-row items-center rounded-xl px-4 py-3"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <Calendar size={20} color="#16a34a" />
                  <Text className="ml-3 text-base" style={{ color: COLORS.textDark }}>
                    {formatDate(businessExportEndDate)}
                  </Text>
                </Pressable>
                {showBusinessEndPicker && (
                  <DateTimePicker
                    value={businessExportEndDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowBusinessEndPicker(Platform.OS === 'ios');
                      if (date) setBusinessExportEndDate(date);
                    }}
                    maximumDate={new Date()}
                  />
                )}
              </View>

              {/* Export Success Message */}
              {businessExportSuccess && (
                <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#dcfce7' }}>
                  <View className="flex-row items-center">
                    <Check size={20} color="#16a34a" />
                    <Text className="ml-2 font-semibold" style={{ color: '#16a34a' }}>
                      Export completed successfully!
                    </Text>
                  </View>
                  <Text className="text-sm mt-1" style={{ color: '#15803d' }}>
                    Your CSV file has been downloaded/shared.
                  </Text>
                </View>
              )}

              {/* Export Button */}
              <Pressable
                onPress={handleBusinessExport}
                disabled={isBusinessExporting}
                className="rounded-xl py-4 items-center active:opacity-80"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isBusinessExporting ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color={COLORS.white} />
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      Exporting...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Download size={20} color={COLORS.white} />
                    <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                      {businessExportSuccess ? 'Export Again' : 'Export CSV'}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Info text */}
              <Text className="text-xs text-center mt-3" style={{ color: COLORS.textMuted }}>
                Exports cleaning logs for {exportingBusiness?.name || 'this business'} only
              </Text>
            </View>
          </View>
        </Modal>

        {/* Trial Management Modal */}
        <Modal
          visible={showTrialModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowTrialModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold" style={{ color: COLORS.textDark }}>
                  Extend Trial
                </Text>
                <Pressable onPress={() => setShowTrialModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              {/* Business Info */}
              <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#eff6ff' }}>
                <Text className="text-sm" style={{ color: COLORS.textMuted }}>Business</Text>
                <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                  {trialBusiness?.name}
                </Text>
                {trialBusiness?.trial_ends_at && (
                  <View className="flex-row items-center mt-2">
                    <Clock size={14} color="#2563eb" />
                    <Text className="text-sm ml-1" style={{ color: '#2563eb' }}>
                      Current end: {formatDate(new Date(trialBusiness.trial_ends_at))}
                    </Text>
                    <Text className="text-sm ml-2" style={{ color: getTrialDaysRemaining(trialBusiness) !== null && getTrialDaysRemaining(trialBusiness)! <= 7 ? COLORS.warning : COLORS.textMuted }}>
                      ({getTrialDaysRemaining(trialBusiness)} days left)
                    </Text>
                  </View>
                )}
              </View>

              {/* Extension Options */}
              <Text className="text-sm font-semibold mb-3" style={{ color: COLORS.textDark }}>
                Add Extra Days
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {[7, 14, 30, 60, 90].map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => handleExtendTrial(days)}
                    disabled={isExtendingTrial}
                    className="flex-1 min-w-[60px] py-3 rounded-xl items-center active:opacity-80"
                    style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
                  >
                    {isExtendingTrial ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <>
                        <Text className="text-lg font-bold" style={{ color: '#2563eb' }}>
                          +{days}
                        </Text>
                        <Text className="text-xs" style={{ color: '#64748b' }}>
                          days
                        </Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Info text */}
              <Text className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                Days will be added to the current trial end date
              </Text>
            </View>
          </View>
        </Modal>

        {/* Quick View Modal (Logs/Issues) */}
        <Modal
          visible={showQuickViewModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowQuickViewModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-4">
            <View
              className="w-full max-w-md rounded-3xl overflow-hidden"
              style={{ backgroundColor: COLORS.white, maxHeight: '80%' }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4" style={{ backgroundColor: COLORS.primary }}>
                <View>
                  <Text className="text-lg font-bold" style={{ color: COLORS.white }}>
                    {quickViewBusiness?.name}
                  </Text>
                  <Text className="text-sm opacity-80" style={{ color: COLORS.white }}>
                    {quickViewTab === 'logs' ? 'Recent Cleaning Logs' : 'Reported Issues'}
                  </Text>
                </View>
                <Pressable onPress={() => setShowQuickViewModal(false)} className="p-1">
                  <X size={24} color={COLORS.white} />
                </Pressable>
              </View>

              {/* Tab Switcher */}
              <View className="flex-row px-4 pt-4">
                <Pressable
                  onPress={() => setQuickViewTab('logs')}
                  className="flex-1 py-2 rounded-lg mr-2"
                  style={{ backgroundColor: quickViewTab === 'logs' ? COLORS.primary : COLORS.primaryLight }}
                >
                  <Text
                    className="text-center font-semibold"
                    style={{ color: quickViewTab === 'logs' ? COLORS.white : COLORS.primary }}
                  >
                    Logs ({quickViewBusiness ? getLogsForBusiness(quickViewBusiness).length : 0})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setQuickViewTab('issues')}
                  className="flex-1 py-2 rounded-lg ml-2"
                  style={{ backgroundColor: quickViewTab === 'issues' ? COLORS.warning : '#fef3c7' }}
                >
                  <Text
                    className="text-center font-semibold"
                    style={{ color: quickViewTab === 'issues' ? COLORS.white : COLORS.warning }}
                  >
                    Issues ({quickViewBusiness ? getIssuesForBusiness(quickViewBusiness).filter(i => i.status === 'open').length : 0})
                  </Text>
                </Pressable>
              </View>

              {/* Content */}
              <ScrollView className="flex-1 px-4 py-4" style={{ maxHeight: 400 }}>
                {quickViewTab === 'logs' && quickViewBusiness && (
                  <>
                    {getLogsForBusiness(quickViewBusiness).length === 0 ? (
                      <View className="items-center py-8">
                        <ClipboardList size={48} color={COLORS.textMuted} />
                        <Text className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
                          No cleaning logs yet
                        </Text>
                      </View>
                    ) : (
                      getLogsForBusiness(quickViewBusiness).slice(0, 20).map((log, index) => (
                        <View
                          key={log.id}
                          className="p-3 rounded-xl mb-2"
                          style={{ backgroundColor: log.status === 'attention_required' ? '#fef2f2' : '#f0fdf4' }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                              {log.location_name || 'Unknown Location'}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: log.status === 'complete' ? '#dcfce7' : '#fecaca' }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: log.status === 'complete' ? '#16a34a' : '#dc2626' }}
                              >
                                {log.status === 'complete' ? 'Complete' : 'Attention'}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                            {log.staff_name || 'Unknown Staff'} • {new Date(log.timestamp).toLocaleString()}
                          </Text>
                          {log.notes && (
                            <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                              {log.notes}
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                    {getLogsForBusiness(quickViewBusiness).length > 20 && (
                      <Text className="text-xs text-center py-2" style={{ color: COLORS.textMuted }}>
                        Showing 20 of {getLogsForBusiness(quickViewBusiness).length} logs
                      </Text>
                    )}
                  </>
                )}

                {quickViewTab === 'issues' && quickViewBusiness && (
                  <>
                    {getIssuesForBusiness(quickViewBusiness).length === 0 ? (
                      <View className="items-center py-8">
                        <AlertTriangle size={48} color={COLORS.textMuted} />
                        <Text className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
                          No reported issues
                        </Text>
                      </View>
                    ) : (
                      getIssuesForBusiness(quickViewBusiness).map((issue, index) => (
                        <View
                          key={issue.id}
                          className="p-3 rounded-xl mb-2"
                          style={{ backgroundColor: issue.status === 'open' ? '#fef3c7' : '#f1f5f9' }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                              {issue.issue_type || 'Unknown Issue'}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: issue.status === 'open' ? '#fde68a' : '#e2e8f0' }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: issue.status === 'open' ? '#d97706' : '#64748b' }}
                              >
                                {issue.status === 'open' ? 'Open' : 'Resolved'}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                            {issue.location_name || 'Unknown Location'} • {new Date(issue.created_at).toLocaleString()}
                          </Text>
                          {issue.description && (
                            <Text className="text-xs mt-1" style={{ color: COLORS.textDark }}>
                              {issue.description}
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                  </>
                )}
              </ScrollView>

              {/* View Details Button */}
              <View className="px-4 pb-4">
                <Pressable
                  onPress={() => {
                    setShowQuickViewModal(false);
                    if (quickViewBusiness) {
                      router.push(`/admin/business/${quickViewBusiness.id}`);
                    }
                  }}
                  className="py-3 rounded-xl items-center active:opacity-80"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  <Text className="font-semibold" style={{ color: COLORS.white }}>
                    View Full Details
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
