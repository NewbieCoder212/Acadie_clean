import { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
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
  Key,
  Save,
  Mail,
  QrCode,
  Copy,
  Link,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Calendar,
  CreditCard,
  Bell,
  Settings,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { generatePDFHTML, openPDFInNewWindow } from '@/lib/pdf-template';
import {
  BusinessRow,
  LocationRow,
  CleaningLogRow,
  ReportedIssueRow,
  getAllBusinesses,
  getLocationsForBusiness,
  getLogsForBusiness,
  getLogsForBusinessByName,
  getIssuesForBusiness,
  getIssuesForBusinessByName,
  insertLocation,
  insertWashroom,
  getWashroomsForBusiness,
  WashroomRow,
  WashroomAlertSettings,
  deleteWashroomAndRelatedData,
  updateBusinessAddress,
  updateBusinessPassword,
  updateAllWashroomPinsForBusiness,
  getQrScanStatsForLocations,
  QrScanStatRow,
  getQrScanLogsForLocations,
  QrScanLogRow,
  activateSubscription,
  extendSubscription,
  updateSubscriptionStatus,
  SubscriptionStatus,
  updateWashroomAlertSettings,
  updateWashroomAlertEmail,
  updateBusinessAlertSchedule,
  AlertSchedule,
  DEFAULT_ALERT_SCHEDULE,
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
  const [washrooms, setWashrooms] = useState<WashroomRow[]>([]);
  const [allLogs, setAllLogs] = useState<CleaningLogRow[]>([]);
  const [allIssues, setAllIssues] = useState<ReportedIssueRow[]>([]);
  const [qrScanStats, setQrScanStats] = useState<QrScanStatRow[]>([]);
  const [qrScanLogs, setQrScanLogs] = useState<QrScanLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);

  // New location form
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationPin, setNewLocationPin] = useState('');
  const [newLocationAlertEmail, setNewLocationAlertEmail] = useState('');

  // Delete washroom state
  const [deletingWashroomId, setDeletingWashroomId] = useState<string | null>(null);

  // Business address editing
  const [businessAddress, setBusinessAddress] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Business password editing
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Universal PIN for all locations
  const [newUniversalPin, setNewUniversalPin] = useState('');
  const [isSavingUniversalPin, setIsSavingUniversalPin] = useState(false);

  // QR Code modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedWashroom, setSelectedWashroom] = useState<WashroomRow | null>(null);

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingScanHistory, setIsExportingScanHistory] = useState(false);

  // Subscription management
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);

  // Alert settings modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertWashroom, setAlertWashroom] = useState<WashroomRow | null>(null);
  const [alertSettings, setAlertSettings] = useState<WashroomAlertSettings>({
    alert_enabled: true,
    alert_threshold_hours: 8,
    business_hours_start: '08:00',
    business_hours_end: '18:00',
    alert_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'America/Halifax',
  });
  const [alertEmail, setAlertEmail] = useState('');
  const [isSavingAlertSettings, setIsSavingAlertSettings] = useState(false);

  // Business-level per-day schedule
  const [businessSchedule, setBusinessSchedule] = useState<AlertSchedule>(DEFAULT_ALERT_SCHEDULE);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Day options for alert settings
  const ALL_DAYS = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  // Timezone options
  const TIMEZONES = [
    { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
    { value: 'America/Toronto', label: 'Eastern (Toronto)' },
    { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
    { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
    { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  ];

  // Generate public URL for washroom
  // Includes ?scan=true to track actual QR scans (not page refreshes)
  const getWashroomUrl = (washroomId: string) => {
    return `https://app.acadiacleaniq.ca/washroom/${washroomId}?scan=true`;
  };

  const handleShowQrCode = (washroom: WashroomRow) => {
    setSelectedWashroom(washroom);
    setCopiedLink(false);
    setShowQrModal(true);
  };

  const handleCopyLink = async () => {
    if (!selectedWashroom) return;
    const url = getWashroomUrl(selectedWashroom.id);
    await Clipboard.setStringAsync(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Open alert settings modal for a washroom
  const handleOpenAlertSettings = (washroom: WashroomRow) => {
    setAlertWashroom(washroom);
    setAlertSettings({
      alert_enabled: washroom.alert_enabled ?? true,
      alert_threshold_hours: washroom.alert_threshold_hours ?? 8,
      business_hours_start: washroom.business_hours_start ?? '08:00',
      business_hours_end: washroom.business_hours_end ?? '18:00',
      alert_days: washroom.alert_days ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: washroom.timezone ?? 'America/Halifax',
    });
    setAlertEmail(washroom.alert_email ?? '');
    setShowAlertModal(true);
  };

  // Save alert settings
  const handleSaveAlertSettings = async () => {
    if (!alertWashroom) return;

    setIsSavingAlertSettings(true);
    try {
      // Update alert settings
      const settingsResult = await updateWashroomAlertSettings(alertWashroom.id, alertSettings);
      if (!settingsResult.success) {
        Alert.alert('Error', settingsResult.error || 'Failed to save alert settings');
        setIsSavingAlertSettings(false);
        return;
      }

      // Update alert email if changed
      if (alertEmail !== (alertWashroom.alert_email ?? '')) {
        const emailResult = await updateWashroomAlertEmail(alertWashroom.id, alertEmail);
        if (!emailResult.success) {
          Alert.alert('Error', emailResult.error || 'Failed to save alert email');
          setIsSavingAlertSettings(false);
          return;
        }
      }

      Alert.alert('Success', 'Alert settings saved successfully!');
      setShowAlertModal(false);
      loadData(); // Refresh data
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingAlertSettings(false);
    }
  };

  // Toggle a day in alert_days
  const toggleAlertDay = (day: string) => {
    setAlertSettings(prev => {
      const days = prev.alert_days.includes(day)
        ? prev.alert_days.filter(d => d !== day)
        : [...prev.alert_days, day];
      return { ...prev, alert_days: days };
    });
  };

  // Business-level schedule helpers
  const toggleScheduleDay = (dayKey: string) => {
    setBusinessSchedule(prev => {
      const current = prev[dayKey as keyof AlertSchedule] || { enabled: false, start: '08:00', end: '18:00' };
      return { ...prev, [dayKey]: { ...current, enabled: !current.enabled } };
    });
  };

  const updateScheduleTime = (dayKey: string, field: 'start' | 'end', value: string) => {
    setBusinessSchedule(prev => {
      const current = prev[dayKey as keyof AlertSchedule] || { enabled: true, start: '08:00', end: '18:00' };
      return { ...prev, [dayKey]: { ...current, [field]: value } };
    });
  };

  const handleSaveBusinessSchedule = async () => {
    if (!business?.id) return;
    setIsSavingSchedule(true);
    try {
      const result = await updateBusinessAlertSchedule(business.id, businessSchedule);
      if (result.success) {
        Alert.alert('Success', 'Business hours schedule saved!');
      } else {
        Alert.alert('Error', result.error || 'Failed to save schedule');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }

    // Auto-refresh every 30 seconds to keep data current
    const refreshInterval = setInterval(() => {
      if (id && !isLoading) {
        loadDataSilent();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [id]);

  // Silent data load for auto-refresh (no loading spinner)
  const loadDataSilent = async () => {
    try {
      const businessesResult = await getAllBusinesses();
      if (businessesResult.success && businessesResult.data) {
        const foundBusiness = businessesResult.data.find(b => b.id === id);
        if (foundBusiness) {
          setBusiness(foundBusiness);
          setBusinessSchedule(foundBusiness.alert_schedule as AlertSchedule ?? DEFAULT_ALERT_SCHEDULE);

          const washroomsResult = await getWashroomsForBusiness(foundBusiness.name);
          if (washroomsResult.success && washroomsResult.data) {
            setWashrooms(washroomsResult.data);

            const washroomIds = washroomsResult.data.map(w => w.id);
            if (washroomIds.length > 0) {
              const [logsResult, issuesResult, qrStatsResult, qrLogsResult] = await Promise.all([
                getLogsForBusinessByName(foundBusiness.name),
                getIssuesForBusinessByName(foundBusiness.name),
                getQrScanStatsForLocations(washroomIds),
                getQrScanLogsForLocations(washroomIds, { limit: 50 }),
              ]);

              if (logsResult.success && logsResult.data) {
                setAllLogs(logsResult.data);
              }
              if (issuesResult.success && issuesResult.data) {
                setAllIssues(issuesResult.data);
              }
              if (qrStatsResult.success && qrStatsResult.data) {
                setQrScanStats(qrStatsResult.data);
              }
              if (qrLogsResult.success && qrLogsResult.data) {
                setQrScanLogs(qrLogsResult.data);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[BusinessDetail] Silent refresh error:', error);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDataSilent();
    setIsRefreshing(false);
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
          setBusinessAddress(foundBusiness.address || '');
          setBusinessSchedule(foundBusiness.alert_schedule as AlertSchedule ?? DEFAULT_ALERT_SCHEDULE);

          // Get washrooms for this business using business name
          const washroomsResult = await getWashroomsForBusiness(foundBusiness.name);
          if (washroomsResult.success && washroomsResult.data) {
            setWashrooms(washroomsResult.data);

            // Get logs using washroom IDs (not the legacy getLogsForBusiness which uses locations table)
            const washroomIds = washroomsResult.data.map(w => w.id);
            if (washroomIds.length > 0) {
              // Fetch logs, issues, QR scan stats, and detailed scan logs in parallel
              const [logsResult, issuesResult, qrStatsResult, qrLogsResult] = await Promise.all([
                getLogsForBusinessByName(foundBusiness.name),
                getIssuesForBusinessByName(foundBusiness.name),
                getQrScanStatsForLocations(washroomIds),
                getQrScanLogsForLocations(washroomIds, { limit: 50 }),
              ]);

              if (logsResult.success && logsResult.data) {
                setAllLogs(logsResult.data);
              }
              if (issuesResult.success && issuesResult.data) {
                setAllIssues(issuesResult.data);
              }
              if (qrStatsResult.success && qrStatsResult.data) {
                setQrScanStats(qrStatsResult.data);
              }
              if (qrLogsResult.success && qrLogsResult.data) {
                setQrScanLogs(qrLogsResult.data);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[BusinessDetail] Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  const handleAddLocation = async () => {
    if (!newLocationName.trim() || !business) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }

    // Determine PIN to use
    const isFirstWashroom = washrooms.length === 0;
    let pinToUse: string;

    if (isFirstWashroom) {
      // First washroom - require PIN entry
      if (!newLocationPin || newLocationPin.length < 4 || newLocationPin.length > 5 || !/^\d{4,5}$/.test(newLocationPin)) {
        Alert.alert('Error', 'Please enter a valid 4 or 5-digit PIN');
        return;
      }
      pinToUse = newLocationPin;
    } else {
      // Subsequent washroom - inherit PIN from existing washroom
      const existingPin = washrooms[0]?.pin_display || business?.staff_pin_display;
      if (!existingPin) {
        Alert.alert('Error', 'No existing PIN found. Please contact support.');
        return;
      }
      pinToUse = existingPin;
    }

    setIsCreating(true);
    try {
      // Insert into washrooms table (not locations table)
      const result = await insertWashroom({
        id: generateId(),
        business_name: business.name,
        room_name: newLocationName.trim(),
        pin_code: pinToUse,
        alert_email: newLocationAlertEmail.trim() || undefined,
      });

      if (result.success) {
        setShowAddModal(false);
        setNewLocationName('');
        setNewLocationPin('');
        setNewLocationAlertEmail('');
        loadData();
        Alert.alert('Success', `Washroom "${newLocationName.trim()}" created with PIN: ${pinToUse}`);
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

  // Get scan count for a location (last 30 days)
  const getScansForLocation = (locationId: string) => {
    const locationStats = qrScanStats.filter(s => s.location_id === locationId);
    return locationStats.reduce((sum, s) => sum + s.total_scans, 0);
  };

  // Get today's scans for a location
  const getTodayScansForLocation = (locationId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = qrScanStats.filter(s => s.location_id === locationId && s.scan_date === today);
    return todayStats.reduce((sum, s) => sum + s.total_scans, 0);
  };

  // Get total scans for all washrooms
  const totalScans = qrScanStats.reduce((sum, s) => sum + s.total_scans, 0);
  const todayScans = qrScanStats
    .filter(s => s.scan_date === new Date().toISOString().split('T')[0])
    .reduce((sum, s) => sum + s.total_scans, 0);

  const getOpenIssuesForLocation = (locationId: string) => {
    return allIssues.filter(issue => issue.location_id === locationId && issue.status === 'open').length;
  };

  // Get washroom name by ID
  const getWashroomName = (locationId: string) => {
    const washroom = washrooms.find(w => w.id === locationId);
    return washroom?.room_name || 'Unknown';
  };

  // Format scan time for display
  const formatScanTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Export scan history to PDF
  const exportScanHistoryPDF = async () => {
    if (isExportingScanHistory || qrScanLogs.length === 0) return;
    setIsExportingScanHistory(true);

    try {
      const formatPdfDateTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      };

      // Calculate date range (past 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const tableRows = qrScanLogs.map((log) => `
        <tr>
          <td>${formatPdfDateTime(log.scanned_at)}</td>
          <td>${getWashroomName(log.location_id)}</td>
        </tr>
      `).join('');

      const html = generatePDFHTML({
        documentTitle: 'QR Scan History Report',
        documentType: 'scan-history',
        businessName: business?.name || 'Business',
        location: `${business?.name || 'Business'} - All Locations`,
        dateRange: { start: startDate, end: endDate },
        tableHeaders: ['Date & Time', 'Location'],
        tableRows,
        showLegend: false,
      });

      if (Platform.OS === 'web') {
        const success = openPDFInNewWindow(html);
        if (!success) {
          Alert.alert('Error', 'Failed to open PDF. Please try again.');
        }
      } else {
        // Native: Generate PDF file and share
        try {
          const { uri } = await Print.printToFileAsync({ html });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'QR Scan History PDF',
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (printError) {
          console.error('[Admin] Print error:', printError);
          Alert.alert('Error', 'Failed to generate PDF. Please try again.');
          return;
        }
      }
    } catch (error) {
      console.error('[Admin] PDF export error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setIsExportingScanHistory(false);
    }
  };

  // Subscription helper functions
  const getSubscriptionDaysRemaining = () => {
    if (!business) return null;

    let expiryDate: Date | null = null;
    if (business.subscription_status === 'trial' && business.trial_ends_at) {
      expiryDate = new Date(business.trial_ends_at);
    } else if (business.subscription_status === 'active' && business.subscription_expires_at) {
      expiryDate = new Date(business.subscription_expires_at);
    }

    if (!expiryDate) return null;

    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getSubscriptionStatusColor = () => {
    if (!business) return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };

    const daysRemaining = getSubscriptionDaysRemaining();

    switch (business.subscription_status) {
      case 'active':
        return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'trial':
        if (daysRemaining !== null && daysRemaining <= 7) {
          return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' }; // Warning - expiring soon
        }
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'expired':
        return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      case 'cancelled':
        return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
      default:
        return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    }
  };

  const getSubscriptionStatusLabel = () => {
    if (!business) return 'Unknown';

    const daysRemaining = getSubscriptionDaysRemaining();

    switch (business.subscription_status) {
      case 'active':
        return daysRemaining !== null ? `Active (${daysRemaining} days left)` : 'Active';
      case 'trial':
        return daysRemaining !== null ? `Trial (${daysRemaining} days left)` : 'Trial';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const handleActivateSubscription = async (months: number) => {
    if (!business) return;

    Alert.alert(
      'Activate Subscription',
      `Activate ${months}-month subscription for "${business.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            setIsUpdatingSubscription(true);
            try {
              const result = await activateSubscription(business.id, months);
              if (result.success) {
                Alert.alert('Success', `Subscription activated for ${months} months!`);
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to activate subscription');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setIsUpdatingSubscription(false);
            }
          },
        },
      ]
    );
  };

  const handleExtendSubscription = async (months: number) => {
    if (!business) return;

    Alert.alert(
      'Extend Subscription',
      `Extend subscription by ${months} months for "${business.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Extend',
          onPress: async () => {
            setIsUpdatingSubscription(true);
            try {
              const result = await extendSubscription(business.id, months);
              if (result.success) {
                Alert.alert('Success', `Subscription extended by ${months} months!`);
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to extend subscription');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setIsUpdatingSubscription(false);
            }
          },
        },
      ]
    );
  };

  const handleViewPublicPage = (locationId: string) => {
    router.push(`/washroom/${locationId}?admin=true`);
  };

  const handleDeleteWashroom = (washroom: WashroomRow) => {
    Alert.alert(
      'Delete Washroom',
      `Are you sure you want to permanently delete "${washroom.room_name}"?\n\nThis will also delete all cleaning logs for this location. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeletingWashroomId(washroom.id);
            try {
              // Delete washroom and all related data (logs, issues, QR scans)
              const result = await deleteWashroomAndRelatedData(washroom.id);
              if (result.success) {
                Alert.alert('Success', `"${washroom.room_name}" has been permanently deleted.`);
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete washroom');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setDeletingWashroomId(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveBusinessAddress = async () => {
    if (!business?.id) return;
    setIsSavingAddress(true);
    try {
      const result = await updateBusinessAddress(business.id, businessAddress.trim());
      if (result.success) {
        // Update local business state
        setBusiness({ ...business, address: businessAddress.trim() });
        Alert.alert('Success', 'Business address saved!');
      } else {
        Alert.alert('Error', result.error || 'Failed to save address');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSavePassword = async () => {
    if (!business?.id) return;
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    if (newPassword.trim().length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    Alert.alert(
      'Update Password',
      `Are you sure you want to change the password for "${business.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setIsSavingPassword(true);
            try {
              const result = await updateBusinessPassword(business.id, newPassword.trim());
              if (result.success) {
                setNewPassword('');
                // Reload data to get the updated password_display
                loadData();
                Alert.alert('Success', 'Password updated! The business manager can now log in with the new password.');
              } else {
                Alert.alert('Error', result.error || 'Failed to update password');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setIsSavingPassword(false);
            }
          },
        },
      ]
    );
  };

  // Handle updating PIN for all locations
  const handleUpdateAllPins = async () => {
    if (!business?.name) return;
    if (!newUniversalPin.trim()) {
      Alert.alert('Error', 'Please enter a new PIN');
      return;
    }
    if (!/^\d{4,5}$/.test(newUniversalPin.trim())) {
      Alert.alert('Error', 'PIN must be 4 or 5 digits');
      return;
    }

    Alert.alert(
      'Update PIN for All Locations',
      `Are you sure you want to update the PIN to "${newUniversalPin}" for ALL ${washrooms.length} washroom location(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update All',
          onPress: async () => {
            setIsSavingUniversalPin(true);
            try {
              const result = await updateAllWashroomPinsForBusiness(business.name, newUniversalPin.trim());
              if (result.success) {
                setNewUniversalPin('');
                loadData(); // Refresh to show updated PINs
                Alert.alert('Success', `PIN updated for ${result.updatedCount || 0} location(s)!`);
              } else {
                Alert.alert('Error', result.error || 'Failed to update PINs');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error. Please try again.');
            } finally {
              setIsSavingUniversalPin(false);
            }
          },
        },
      ]
    );
  };

  // Calculate today's logs - ensure timezone-safe comparison
  const todayLogs = allLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    const today = new Date();
    // Compare year, month, day in local timezone
    return (
      logDate.getFullYear() === today.getFullYear() &&
      logDate.getMonth() === today.getMonth() &&
      logDate.getDate() === today.getDate()
    );
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

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Stats Overview */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-row gap-3 mb-3"
          >
            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
            >
              <MapPin size={24} color={COLORS.primary} />
              <Text className="text-3xl font-bold mt-2" style={{ color: COLORS.textDark }}>
                {washrooms.length}
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

          {/* QR Scan Stats */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(400)}
            className="flex-row gap-3 mb-6"
          >
            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}
            >
              <Eye size={24} color="#16a34a" />
              <Text className="text-3xl font-bold mt-2" style={{ color: '#16a34a' }}>
                {todayScans}
              </Text>
              <Text className="text-sm" style={{ color: '#15803d' }}>
                Scans Today
              </Text>
            </View>

            <View
              className="flex-1 p-4 rounded-2xl"
              style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
            >
              <QrCode size={24} color="#2563eb" />
              <Text className="text-3xl font-bold mt-2" style={{ color: '#2563eb' }}>
                {totalScans}
              </Text>
              <Text className="text-sm" style={{ color: '#1d4ed8' }}>
                Scans (30 days)
              </Text>
            </View>
          </Animated.View>

          {/* Scan History Section */}
          {qrScanLogs.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(75).duration(400)}
              className="mb-6"
            >
              <Pressable
                onPress={() => setShowScanHistory(!showScanHistory)}
                className="flex-row items-center justify-between p-4 rounded-2xl active:opacity-80"
                style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
              >
                <View className="flex-row items-center">
                  <Clock size={20} color="#2563eb" />
                  <Text className="font-semibold ml-2" style={{ color: '#1d4ed8' }}>
                    Recent Scan History
                  </Text>
                  <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#2563eb' }}>
                    <Text className="text-xs font-bold" style={{ color: '#ffffff' }}>
                      {qrScanLogs.length}
                    </Text>
                  </View>
                </View>
                {showScanHistory ? (
                  <ChevronUp size={20} color="#2563eb" />
                ) : (
                  <ChevronDown size={20} color="#2563eb" />
                )}
              </Pressable>

              {showScanHistory && (
                <View
                  className="mt-2 rounded-2xl overflow-hidden"
                  style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.glassBorder }}
                >
                  {qrScanLogs.slice(0, 20).map((log, index) => (
                    <View
                      key={log.id}
                      className="flex-row items-center justify-between px-4 py-3"
                      style={{
                        borderBottomWidth: index < Math.min(qrScanLogs.length, 20) - 1 ? 1 : 0,
                        borderBottomColor: COLORS.glassBorder,
                      }}
                    >
                      <View className="flex-row items-center flex-1">
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: '#eff6ff' }}
                        >
                          <QrCode size={14} color="#2563eb" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="text-sm font-medium" style={{ color: COLORS.textDark }}>
                            {getWashroomName(log.location_id)}
                          </Text>
                          <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                            QR Code Scanned
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm font-medium" style={{ color: '#2563eb' }}>
                          {formatScanTime(log.scanned_at)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {qrScanLogs.length > 20 && (
                    <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc' }}>
                      <Text className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                        Showing 20 of {qrScanLogs.length} scans
                      </Text>
                    </View>
                  )}

                  {/* Export to PDF Button */}
                  <Pressable
                    onPress={exportScanHistoryPDF}
                    disabled={isExportingScanHistory}
                    className="flex-row items-center justify-center py-3 mx-3 my-3 rounded-xl active:opacity-80"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {isExportingScanHistory ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <FileText size={18} color="#ffffff" />
                        <Text className="font-semibold ml-2" style={{ color: '#ffffff' }}>
                          Export to PDF
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </Animated.View>
          )}

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
                Add Washroom Location
              </Text>
            </Pressable>
          </Animated.View>

          {/* Locations List */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text
              className="text-lg font-bold mb-3"
              style={{ color: COLORS.textDark }}
            >
              Washroom Locations
            </Text>

            {washrooms.length === 0 ? (
              <View
                className="p-6 rounded-2xl items-center"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                <MapPin size={48} color={COLORS.textMuted} />
                <Text className="text-base font-medium mt-3" style={{ color: COLORS.textMuted }}>
                  No washroom locations yet
                </Text>
                <Text className="text-sm text-center mt-1" style={{ color: COLORS.textMuted }}>
                  Add your first washroom location for this business
                </Text>
              </View>
            ) : (
              <View
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder }}
              >
                {washrooms.map((washroom, index) => (
                  <View
                    key={washroom.id}
                    className="p-4"
                    style={{
                      borderBottomWidth: index < washrooms.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.glassBorder,
                    }}
                  >
                    {/* Top row: Location info */}
                    <View className="flex-row items-center">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      >
                        <MapPin size={24} color={COLORS.primary} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                          {washroom.room_name}
                        </Text>
                        <View className="flex-row items-center mt-1 flex-wrap gap-y-1">
                          <Text className="text-xs" style={{ color: COLORS.success }}>
                            {getLogsForLocation(washroom.id)} logs
                          </Text>
                          <View className="flex-row items-center ml-3">
                            <Eye size={12} color="#2563eb" />
                            <Text className="text-xs ml-1" style={{ color: '#2563eb' }}>
                              {getScansForLocation(washroom.id)} scans
                            </Text>
                          </View>
                          {getOpenIssuesForLocation(washroom.id) > 0 && (
                            <View className="flex-row items-center ml-3">
                              <AlertTriangle size={12} color={COLORS.warning} />
                              <Text className="text-xs ml-1" style={{ color: COLORS.warning }}>
                                {getOpenIssuesForLocation(washroom.id)} issues
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Middle row: Stats and Alert Email */}
                    <View className="flex-row items-center mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                      {washroom.alert_email && (
                        <View className="flex-1 flex-row items-center">
                          <Mail size={14} color={COLORS.textMuted} />
                          <Text className="text-xs ml-2" style={{ color: COLORS.textMuted }} numberOfLines={1}>
                            {washroom.alert_email}
                          </Text>
                        </View>
                      )}
                      {!washroom.alert_email && (
                        <View className="flex-1 flex-row items-center">
                          <Mail size={14} color={COLORS.textMuted} />
                          <Text className="text-xs ml-2" style={{ color: COLORS.textMuted }}>
                            No alert email set
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Bottom row: Actions */}
                    <View className="flex-row items-center justify-end mt-3 gap-2 flex-wrap">
                      <Pressable
                        onPress={() => handleOpenAlertSettings(washroom)}
                        className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                        style={{ backgroundColor: washroom.alert_enabled ? '#fef3c7' : '#f1f5f9' }}
                      >
                        <Bell size={16} color={washroom.alert_enabled ? '#d97706' : '#64748b'} />
                        <Text className="text-xs font-medium ml-1" style={{ color: washroom.alert_enabled ? '#d97706' : '#64748b' }}>
                          {washroom.alert_enabled ? 'Alerts On' : 'Alerts Off'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleShowQrCode(washroom)}
                        className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                        style={{ backgroundColor: '#d1fae5' }}
                      >
                        <QrCode size={16} color="#059669" />
                        <Text className="text-xs font-medium ml-1" style={{ color: '#059669' }}>QR</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleViewPublicPage(washroom.id)}
                        className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      >
                        <ExternalLink size={16} color={COLORS.primary} />
                        <Text className="text-xs font-medium ml-1" style={{ color: COLORS.primary }}>View</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteWashroom(washroom)}
                        disabled={deletingWashroomId === washroom.id}
                        className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
                        style={{ backgroundColor: '#fee2e2' }}
                      >
                        {deletingWashroomId === washroom.id ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <>
                            <Trash2 size={16} color={COLORS.error} />
                            <Text className="text-xs font-medium ml-1" style={{ color: COLORS.error }}>Delete</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
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
              {/* Business Name */}
              <View className="flex-row items-center mb-3">
                <Building2 size={20} color={COLORS.primary} />
                <Text className="ml-3 text-base font-semibold" style={{ color: COLORS.textDark }}>
                  {business.name}
                </Text>
              </View>

              {/* Email with Current Password PIN displayed */}
              <View className="mb-3">
                <Text className="text-xs font-medium mb-1" style={{ color: COLORS.textMuted }}>Email</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm flex-1" style={{ color: COLORS.textDark }}>
                    {business.email}
                  </Text>
                  {/* Current Password/PIN Display */}
                  {business.password_display && (
                    <View className="flex-row items-center px-2 py-1 rounded-lg ml-2" style={{ backgroundColor: '#fef3c7' }}>
                      <Key size={12} color="#d97706" />
                      <Text className="text-xs font-mono font-bold ml-1" style={{ color: '#d97706' }}>
                        PIN: {business.password_display}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Business Address - Directly beneath email/PIN */}
              <View className="mb-3">
                <Text className="text-xs font-medium mb-1" style={{ color: COLORS.textMuted }}>Business Address</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={businessAddress}
                    onChangeText={setBusinessAddress}
                    placeholder="Enter business address"
                    placeholderTextColor={COLORS.textMuted}
                    className="flex-1 rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: COLORS.primaryLight,
                      fontSize: 14,
                      color: COLORS.textDark,
                    }}
                  />
                  <Pressable
                    onPress={handleSaveBusinessAddress}
                    disabled={isSavingAddress}
                    className="px-3 py-2 rounded-lg active:opacity-70"
                    style={{ backgroundColor: COLORS.primary }}
                  >
                    {isSavingAddress ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Save size={18} color={COLORS.white} />
                    )}
                  </Pressable>
                </View>
                <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  This address appears in audit reports
                </Text>
              </View>

              {/* Manager Password - Editable */}
              <View className="mb-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                <Text className="text-xs font-medium mb-1" style={{ color: COLORS.textMuted }}>Manager Password</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    className="flex-1 rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: COLORS.primaryLight,
                      fontSize: 14,
                      color: COLORS.textDark,
                    }}
                  />
                  <Pressable
                    onPress={handleSavePassword}
                    disabled={isSavingPassword || !newPassword.trim()}
                    className="px-3 py-2 rounded-lg active:opacity-70"
                    style={{ backgroundColor: newPassword.trim() ? COLORS.primary : COLORS.textMuted }}
                  >
                    {isSavingPassword ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Save size={18} color={COLORS.white} />
                    )}
                  </Pressable>
                </View>
                <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  Leave empty to keep current password
                </Text>
              </View>

              {/* Universal PIN for All Locations */}
              <View className="mb-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                <Text className="text-xs font-medium mb-2" style={{ color: COLORS.textMuted }}>Universal Staff PIN (All Locations)</Text>

                {/* Current PIN Display */}
                {washrooms.length > 0 && washrooms[0].pin_display && (
                  <View className="flex-row items-center px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: '#fef3c7' }}>
                    <Key size={16} color="#d97706" />
                    <Text className="text-lg font-mono font-bold ml-2" style={{ color: '#d97706' }}>
                      Current: {washrooms[0].pin_display}
                    </Text>
                    <Text className="text-xs ml-2" style={{ color: '#92400e' }}>
                      (applies to {washrooms.length} location{washrooms.length !== 1 ? 's' : ''})
                    </Text>
                  </View>
                )}

                {/* Update PIN Input */}
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newUniversalPin}
                    onChangeText={(text) => setNewUniversalPin(text.replace(/[^0-9]/g, '').slice(0, 5))}
                    placeholder="New PIN (4-5 digits)"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    className="flex-1 rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: COLORS.primaryLight,
                      fontSize: 14,
                      color: COLORS.textDark,
                      letterSpacing: 4,
                    }}
                  />
                  <Pressable
                    onPress={handleUpdateAllPins}
                    disabled={isSavingUniversalPin || !newUniversalPin.trim() || washrooms.length === 0}
                    className="px-3 py-2 rounded-lg active:opacity-70"
                    style={{ backgroundColor: (newUniversalPin.trim() && washrooms.length > 0) ? '#d97706' : COLORS.textMuted }}
                  >
                    {isSavingUniversalPin ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Save size={18} color={COLORS.white} />
                    )}
                  </Pressable>
                </View>
                <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  Update PIN for All Locations - this will change the PIN for all {washrooms.length} washroom(s)
                </Text>
              </View>

              {/* Subscription Status */}
              <View className="mb-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                <Text className="text-xs font-medium mb-2" style={{ color: COLORS.textMuted }}>Subscription Status</Text>
                <View
                  className="flex-row items-center px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: getSubscriptionStatusColor().bg,
                    borderWidth: 1,
                    borderColor: getSubscriptionStatusColor().border,
                  }}
                >
                  <CreditCard size={16} color={getSubscriptionStatusColor().text} />
                  <Text className="text-sm font-semibold ml-2" style={{ color: getSubscriptionStatusColor().text }}>
                    {getSubscriptionStatusLabel()}
                  </Text>
                </View>

                {/* Trial/Subscription dates */}
                {business.subscription_status === 'trial' && business.trial_ends_at && (
                  <View className="flex-row items-center mt-2">
                    <Calendar size={12} color={COLORS.textMuted} />
                    <Text className="text-xs ml-1" style={{ color: COLORS.textMuted }}>
                      Trial ends: {new Date(business.trial_ends_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {business.subscription_status === 'active' && business.subscription_expires_at && (
                  <View className="flex-row items-center mt-2">
                    <Calendar size={12} color={COLORS.textMuted} />
                    <Text className="text-xs ml-1" style={{ color: COLORS.textMuted }}>
                      Expires: {new Date(business.subscription_expires_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {/* Subscription Actions */}
                <View className="flex-row gap-2 mt-3">
                  {(business.subscription_status === 'trial' || business.subscription_status === 'expired') && (
                    <Pressable
                      onPress={() => handleActivateSubscription(12)}
                      disabled={isUpdatingSubscription}
                      className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-80"
                      style={{ backgroundColor: '#059669' }}
                    >
                      {isUpdatingSubscription ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Check size={14} color="#ffffff" />
                          <Text className="text-xs font-semibold ml-1" style={{ color: '#ffffff' }}>
                            Activate (12 mo)
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {business.subscription_status === 'active' && (
                    <Pressable
                      onPress={() => handleExtendSubscription(12)}
                      disabled={isUpdatingSubscription}
                      className="flex-1 flex-row items-center justify-center py-2 rounded-lg active:opacity-80"
                      style={{ backgroundColor: '#2563eb' }}
                    >
                      {isUpdatingSubscription ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Plus size={14} color="#ffffff" />
                          <Text className="text-xs font-semibold ml-1" style={{ color: '#ffffff' }}>
                            Extend (12 mo)
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Created At */}
              <View className="pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.glassBorder }}>
                <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                  Created: {new Date(business.created_at).toLocaleDateString()}
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
                  Add Washroom Location
                </Text>
                <Pressable onPress={() => setShowAddModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              <View className="mb-4">
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

              {/* PIN Field - only show for first washroom, subsequent inherit from business */}
              {washrooms.length === 0 ? (
                <View className="mb-4">
                  <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                    Staff PIN (4-5 digits)
                  </Text>
                  <TextInput
                    value={newLocationPin}
                    onChangeText={(text) => setNewLocationPin(text.replace(/[^0-9]/g, '').slice(0, 5))}
                    placeholder="e.g., 1234 or 12345"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    className="rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: COLORS.primaryLight,
                      fontSize: 16,
                      color: COLORS.textDark,
                      letterSpacing: 8,
                    }}
                  />
                  <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                    This PIN will be used for all washroom locations
                  </Text>
                </View>
              ) : (
                <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#fef3c7' }}>
                  <View className="flex-row items-center">
                    <Key size={18} color="#d97706" />
                    <Text className="text-sm font-semibold ml-2" style={{ color: '#92400e' }}>
                      Staff PIN
                    </Text>
                  </View>
                  <Text className="text-lg font-mono font-bold mt-1" style={{ color: '#d97706' }}>
                    {washrooms[0]?.pin_display || business?.staff_pin_display || 'Not set'}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: '#92400e' }}>
                    New location will use the same PIN as existing washrooms
                  </Text>
                </View>
              )}

              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                  Alert Email (optional)
                </Text>
                <TextInput
                  value={newLocationAlertEmail}
                  onChangeText={setNewLocationAlertEmail}
                  placeholder="supervisor@example.com"
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
                <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  Receives alerts when issues need attention
                </Text>
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

        {/* QR Code Modal */}
        <Modal
          visible={showQrModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowQrModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ backgroundColor: COLORS.white }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold" style={{ color: COLORS.textDark }}>
                  QR Code Link
                </Text>
                <Pressable onPress={() => setShowQrModal(false)} className="p-1">
                  <X size={24} color={COLORS.textMuted} />
                </Pressable>
              </View>

              {selectedWashroom && (
                <>
                  {/* Washroom Info */}
                  <View className="items-center mb-4 p-4 rounded-2xl" style={{ backgroundColor: COLORS.primaryLight }}>
                    <QrCode size={64} color={COLORS.primary} />
                    <Text className="text-lg font-bold mt-3" style={{ color: COLORS.textDark }}>
                      {selectedWashroom.room_name}
                    </Text>
                    <Text className="text-sm" style={{ color: COLORS.textMuted }}>
                      {business?.name}
                    </Text>
                  </View>

                  {/* URL Display */}
                  <View className="mb-4">
                    <Text className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>
                      Public URL (for QR code)
                    </Text>
                    <View
                      className="p-3 rounded-xl flex-row items-center"
                      style={{ backgroundColor: '#f1f5f9' }}
                    >
                      <Link size={16} color={COLORS.textMuted} />
                      <Text
                        className="flex-1 text-xs ml-2"
                        style={{ color: COLORS.textDark }}
                        numberOfLines={2}
                      >
                        {getWashroomUrl(selectedWashroom.id)}
                      </Text>
                    </View>
                  </View>

                  {/* PIN Display */}
                  <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#fef3c7' }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium" style={{ color: '#92400e' }}>
                        Staff PIN
                      </Text>
                      <View className="flex-row items-center">
                        <Key size={14} color="#92400e" />
                        <Text className="text-lg font-bold font-mono ml-2" style={{ color: '#92400e' }}>
                          {selectedWashroom.pin_display || business?.staff_pin_display || 'Not set'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Copy Link Button */}
                  <Pressable
                    onPress={handleCopyLink}
                    className="rounded-xl py-4 items-center active:opacity-80"
                    style={{ backgroundColor: copiedLink ? COLORS.success : COLORS.primary }}
                  >
                    <View className="flex-row items-center">
                      {copiedLink ? (
                        <>
                          <Check size={20} color={COLORS.white} />
                          <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                            Link Copied!
                          </Text>
                        </>
                      ) : (
                        <>
                          <Copy size={20} color={COLORS.white} />
                          <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                            Copy Link for QR Code
                          </Text>
                        </>
                      )}
                    </View>
                  </Pressable>

                  <Text className="text-xs text-center mt-3" style={{ color: COLORS.textMuted }}>
                    Use this link to generate a QR code at qr-code-generator.com or similar
                  </Text>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Alert Settings Modal */}
        <Modal
          visible={showAlertModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAlertModal(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-4">
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                className="w-full max-w-sm rounded-3xl p-5"
                style={{ backgroundColor: COLORS.white }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <Bell size={24} color="#d97706" />
                    <Text className="text-lg font-bold ml-2" style={{ color: COLORS.textDark }}>
                      Alert Settings
                    </Text>
                  </View>
                  <Pressable onPress={() => setShowAlertModal(false)} className="p-1">
                    <X size={24} color={COLORS.textMuted} />
                  </Pressable>
                </View>

                {alertWashroom && (
                  <>
                    {/* Washroom Name */}
                    <View className="mb-4 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryLight }}>
                      <Text className="text-xs" style={{ color: COLORS.textMuted }}>Washroom</Text>
                      <Text className="text-base font-semibold" style={{ color: COLORS.textDark }}>
                        {alertWashroom.room_name}
                      </Text>
                    </View>

                    {/* Enable/Disable Toggle */}
                    <View className="flex-row items-center justify-between mb-4 p-3 rounded-xl" style={{ backgroundColor: alertSettings.alert_enabled ? '#fef3c7' : '#f1f5f9' }}>
                      <View className="flex-row items-center">
                        <Bell size={20} color={alertSettings.alert_enabled ? '#d97706' : '#64748b'} />
                        <Text className="font-semibold ml-2" style={{ color: alertSettings.alert_enabled ? '#92400e' : '#64748b' }}>
                          Overdue Alerts
                        </Text>
                      </View>
                      <Switch
                        value={alertSettings.alert_enabled}
                        onValueChange={(value: boolean) => setAlertSettings(prev => ({ ...prev, alert_enabled: value }))}
                        trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                        thumbColor={alertSettings.alert_enabled ? '#d97706' : '#94a3b8'}
                      />
                    </View>

                    {alertSettings.alert_enabled && (
                      <>
                        {/* Alert Email */}
                        <View className="mb-4">
                          <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                            Alert Email
                          </Text>
                          <TextInput
                            value={alertEmail}
                            onChangeText={setAlertEmail}
                            placeholder="supervisor@example.com"
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            className="rounded-xl px-4 py-3"
                            style={{
                              backgroundColor: '#f1f5f9',
                              fontSize: 14,
                              color: COLORS.textDark,
                            }}
                          />
                        </View>

                        {/* Threshold Hours */}
                        <View className="mb-4">
                          <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                            Alert after (hours without cleaning)
                          </Text>
                          <View className="flex-row gap-2 flex-wrap">
                            {[1, 2, 4, 6, 8, 12, 24].map((hours) => (
                              <Pressable
                                key={hours}
                                onPress={() => setAlertSettings(prev => ({ ...prev, alert_threshold_hours: hours }))}
                                className="px-4 py-2 rounded-lg"
                                style={{
                                  backgroundColor: alertSettings.alert_threshold_hours === hours ? '#d97706' : '#f1f5f9',
                                }}
                              >
                                <Text
                                  className="font-semibold"
                                  style={{ color: alertSettings.alert_threshold_hours === hours ? '#ffffff' : '#64748b' }}
                                >
                                  {hours}h
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>

                        {/* Business Hours Schedule (per-day) */}
                        <View className="mb-4">
                          <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                            Business Hours Schedule (per day)
                          </Text>
                          <Text className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
                            Set different hours for each day. Alerts only sent during enabled days/hours.
                          </Text>
                          {ALL_DAYS.map((day) => {
                            const daySchedule = businessSchedule[day.key as keyof AlertSchedule];
                            const isEnabled = daySchedule?.enabled ?? false;
                            const startTime = daySchedule?.start ?? '08:00';
                            const endTime = daySchedule?.end ?? '18:00';

                            return (
                              <View
                                key={day.key}
                                className="rounded-xl p-3 mb-2"
                                style={{ backgroundColor: isEnabled ? '#fffbeb' : '#f8fafc', borderWidth: 1, borderColor: isEnabled ? '#fcd34d' : '#e2e8f0' }}
                              >
                                <View className="flex-row items-center justify-between mb-1">
                                  <Text className="text-sm font-semibold" style={{ color: isEnabled ? COLORS.textDark : COLORS.textMuted }}>
                                    {day.label === 'Mon' ? 'Monday' : day.label === 'Tue' ? 'Tuesday' : day.label === 'Wed' ? 'Wednesday' : day.label === 'Thu' ? 'Thursday' : day.label === 'Fri' ? 'Friday' : day.label === 'Sat' ? 'Saturday' : 'Sunday'}
                                  </Text>
                                  <Switch
                                    value={isEnabled}
                                    onValueChange={() => toggleScheduleDay(day.key)}
                                    trackColor={{ false: '#d1d5db', true: '#fcd34d' }}
                                    thumbColor={isEnabled ? '#d97706' : '#f4f3f4'}
                                  />
                                </View>
                                {isEnabled && (
                                  <View className="flex-row items-center gap-2 mt-1">
                                    <TextInput
                                      value={startTime}
                                      onChangeText={(text) => updateScheduleTime(day.key, 'start', text)}
                                      placeholder="08:00"
                                      placeholderTextColor={COLORS.textMuted}
                                      className="flex-1 rounded-lg px-3 py-2 text-center"
                                      style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14, color: COLORS.textDark }}
                                    />
                                    <Text style={{ color: COLORS.textMuted }}>to</Text>
                                    <TextInput
                                      value={endTime}
                                      onChangeText={(text) => updateScheduleTime(day.key, 'end', text)}
                                      placeholder="18:00"
                                      placeholderTextColor={COLORS.textMuted}
                                      className="flex-1 rounded-lg px-3 py-2 text-center"
                                      style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14, color: COLORS.textDark }}
                                    />
                                  </View>
                                )}
                              </View>
                            );
                          })}
                          <Text className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                            Use 24-hour format (e.g., 08:00, 18:00). Applies to all washrooms in this business.
                          </Text>

                          {/* Save Schedule Button */}
                          <Pressable
                            onPress={handleSaveBusinessSchedule}
                            disabled={isSavingSchedule}
                            className="rounded-xl py-3 items-center active:opacity-80 mt-3"
                            style={{ backgroundColor: isSavingSchedule ? '#94a3b8' : '#d97706' }}
                          >
                            {isSavingSchedule ? (
                              <ActivityIndicator color={COLORS.white} />
                            ) : (
                              <View className="flex-row items-center">
                                <Save size={16} color={COLORS.white} />
                                <Text className="text-sm font-bold ml-2" style={{ color: COLORS.white }}>
                                  Save Schedule
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        </View>

                        {/* Timezone */}
                        <View className="mb-4">
                          <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.textDark }}>
                            Timezone
                          </Text>
                          <View className="gap-1">
                            {TIMEZONES.map((tz) => (
                              <Pressable
                                key={tz.value}
                                onPress={() => setAlertSettings(prev => ({ ...prev, timezone: tz.value }))}
                                className="flex-row items-center px-3 py-2 rounded-lg"
                                style={{
                                  backgroundColor: alertSettings.timezone === tz.value ? '#d97706' : '#f1f5f9',
                                }}
                              >
                                <Text
                                  className="text-sm"
                                  style={{ color: alertSettings.timezone === tz.value ? '#ffffff' : '#64748b' }}
                                >
                                  {tz.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      </>
                    )}

                    {/* Save Button */}
                    <Pressable
                      onPress={handleSaveAlertSettings}
                      disabled={isSavingAlertSettings}
                      className="rounded-xl py-4 items-center active:opacity-80 mt-2"
                      style={{ backgroundColor: '#d97706' }}
                    >
                      {isSavingAlertSettings ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <View className="flex-row items-center">
                          <Save size={20} color={COLORS.white} />
                          <Text className="text-base font-bold ml-2" style={{ color: COLORS.white }}>
                            Save Alert Settings
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    <Text className="text-xs text-center mt-3" style={{ color: COLORS.textMuted }}>
                      Alerts are sent when cleaning is overdue during business hours
                    </Text>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
