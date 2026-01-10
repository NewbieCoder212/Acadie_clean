import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, Lock, Eye, EyeOff, Download, MapPin, AlertTriangle, CheckCircle2, Mail, ExternalLink, Plus, Link, Copy, LogOut, Trash2, Key, FileText, Calendar, ClipboardList, RefreshCw, Sparkles, ChevronRight } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useStore, WashroomLocation } from '@/lib/store';
import {
  getLogs6Months as getSupabase6MonthLogs,
  deleteLogsForLocation as supabaseDeleteLogsForLocation,
  insertWashroom as supabaseInsertWashroom,
  deleteWashroom as supabaseDeleteWashroom,
  getLogsForDateRange,
  CleaningLogRow,
  BusinessRow,
  getLogsForBusinessByName,
  WashroomRow,
  getAllWashrooms,
  getWashroomsForBusiness,
} from '@/lib/supabase';
import { hashPassword, verifyPassword } from '@/lib/password';

// Color palette
const COLORS = {
  primary: '#059669',
  primaryLight: '#d1fae5',
  primaryDark: '#047857',
  background: '#f8fafc',
  white: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  red: '#dc2626',
  redLight: '#fef2f2',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  indigoDark: '#312e81',
};

export default function ManagerDashboard() {
  const router = useRouter();

  // Business authentication state
  const [currentBusiness, setCurrentBusiness] = useState<BusinessRow | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [businessLocations, setBusinessLocations] = useState<WashroomRow[]>([]);
  const [allLogs, setAllLogs] = useState<CleaningLogRow[]>([]);

  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // New location form state
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationEmail, setNewLocationEmail] = useState('');
  const [newLocationPin, setNewLocationPin] = useState('');
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newlyCreatedLocation, setNewlyCreatedLocation] = useState<{ id: string; name: string } | null>(null);

  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  // Inspector Mode state
  const [showInspectorMode, setShowInspectorMode] = useState(false);
  const [auditStartDate, setAuditStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [auditEndDate, setAuditEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [businessName, setBusinessName] = useState('Acadia Facilities');

  // Location settings modal
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const managerPasswordHash = useStore((s) => s.managerPasswordHash);
  const setManagerPasswordHash = useStore((s) => s.setManagerPasswordHash);
  const isAuthenticated = useStore((s) => s.isManagerAuthenticated);
  const setManagerAuthenticated = useStore((s) => s.setManagerAuthenticated);
  const logoutManager = useStore((s) => s.logoutManager);
  const locations = useStore((s) => s.locations);
  const getLocationById = useStore((s) => s.getLocationById);
  const updateLocationEmail = useStore((s) => s.updateLocationEmail);
  const addLocation = useStore((s) => s.addLocation);
  const deleteLocation = useStore((s) => s.deleteLocation);

  const needsSetup = !managerPasswordHash;

  // Determine which locations to display
  const displayLocations: WashroomLocation[] = currentBusiness
    ? businessLocations.map(loc => ({
        id: loc.id,
        name: loc.room_name,
        businessName: loc.business_name,
        pinCode: loc.pin_code,
        createdAt: new Date(loc.created_at).getTime(),
      }))
    : locations;

  // Get location status (last log status)
  const getLocationStatus = (locationId: string): 'clean' | 'attention' | 'unknown' => {
    const locationLogs = allLogs.filter(log => log.location_id === locationId);
    console.log('[Manager] getLocationStatus for', locationId, '- found', locationLogs.length, 'logs');
    if (locationLogs.length === 0) return 'unknown';
    const lastLog = locationLogs[0]; // Already sorted by timestamp desc
    console.log('[Manager] Last log status:', lastLog.status, 'resolved:', lastLog.resolved);
    if (lastLog.status === 'attention_required' && !lastLog.resolved) return 'attention';
    return 'clean';
  };

  // Refresh data manually
  const handleRefreshData = () => {
    fetchAllData();
  };

  // Recent logs (last 10)
  const recentLogs = useMemo(() => {
    return allLogs.slice(0, 10);
  }, [allLogs]);

  // Check for business authentication on mount
  useEffect(() => {
    checkBusinessAuth();
  }, []);

  const checkBusinessAuth = async () => {
    setIsCheckingAuth(true);
    try {
      const stored = await AsyncStorage.getItem('currentBusiness');
      if (stored) {
        const business = JSON.parse(stored) as BusinessRow;
        setCurrentBusiness(business);
        setBusinessName(business.name);
        // Fetch business-specific washrooms
        const washroomsResult = await getWashroomsForBusiness(business.name);
        if (washroomsResult.success && washroomsResult.data) {
          setBusinessLocations(washroomsResult.data);
        }
      }
    } catch (error) {
      console.error('[Manager] Auth check error:', error);
    }
    setIsCheckingAuth(false);
  };

  // Generate QR code URL - uses environment variable for production URL
  const getLocationUrl = (locationId: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://acadiacleaniq.vercel.app';
    return `${baseUrl}/washroom/${locationId}`;
  };

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated || currentBusiness) {
      fetchAllData();
    }
  }, [isAuthenticated, currentBusiness]);

  const fetchAllData = async () => {
    setIsLoadingLogs(true);

    try {
      if (currentBusiness && !currentBusiness.is_admin) {
        // Fetch business-specific data
        console.log('[Manager] Fetching data for business:', currentBusiness.name);
        const logsResult = await getLogsForBusinessByName(currentBusiness.name);

        console.log('[Manager] Logs result:', logsResult.success, 'count:', logsResult.data?.length);

        if (logsResult.success && logsResult.data) {
          console.log('[Manager] Setting allLogs with', logsResult.data.length, 'logs');
          setAllLogs(logsResult.data);
        }
      } else {
        // Admin or legacy mode - fetch all
        const logsResult = await getSupabase6MonthLogs('');

        if (logsResult.success && logsResult.data) {
          setAllLogs(logsResult.data);
        }
      }
    } catch (error) {
      console.error('[Manager] Error fetching data:', error);
    }

    setIsLoadingLogs(false);
  };

  const handleSetupPassword = async () => {
    if (passwordInput.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }
    if (passwordInput !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setIsSettingUp(true);
    const hash = await hashPassword(passwordInput);
    setManagerPasswordHash(hash);
    setIsSettingUp(false);
    setManagerAuthenticated(true);
    setPasswordInput('');
    setConfirmPassword('');
  };

  const handleLogin = async () => {
    if (!managerPasswordHash) return;

    setIsVerifying(true);
    const isValid = await verifyPassword(passwordInput, managerPasswordHash);
    setIsVerifying(false);

    if (isValid) {
      setManagerAuthenticated(true);
      setPasswordInput('');
    } else {
      Alert.alert('Error', 'Incorrect password');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentBusiness');
    setCurrentBusiness(null);
    logoutManager();
    router.replace('/');
  };

  const handleEditEmail = (location: WashroomLocation) => {
    setEditingEmailId(location.id);
    setEmailInput(location.supervisorEmail ?? '');
  };

  const handleSaveEmail = (locationId: string) => {
    updateLocationEmail(locationId, emailInput.trim());
    setEditingEmailId(null);
    setEmailInput('');
  };

  const handleAddNewLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }
    if (!newLocationPin || newLocationPin.length !== 4 || !/^\d{4}$/.test(newLocationPin)) {
      Alert.alert('Error', 'Please enter a valid 4-digit PIN');
      return;
    }
    if (!newLocationEmail.trim() || !newLocationEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsAddingLocation(true);

    try {
      const pinHash = await hashPassword(newLocationPin);
      const locationId = addLocation(
        newLocationName.trim(),
        newLocationEmail.trim(),
        pinHash,
        newLocationPin
      );

      const supabaseResult = await supabaseInsertWashroom({
        id: locationId,
        room_name: newLocationName.trim(),
        business_name: currentBusiness?.name || 'Default Business',
        pin_code: newLocationPin,
      });

      if (supabaseResult.success && currentBusiness) {
        const washroomsResult = await getWashroomsForBusiness(currentBusiness.name);
        if (washroomsResult.success && washroomsResult.data) {
          setBusinessLocations(washroomsResult.data);
        }
      }

      setNewlyCreatedLocation({ id: locationId, name: newLocationName.trim() });
      setNewLocationName('');
      setNewLocationEmail('');
      setNewLocationPin('');
      setShowAddLocation(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create location.');
    }

    setIsAddingLocation(false);
  };

  const handleCopyUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'URL copied to clipboard');
  };

  const handleShareUrl = async (locationName: string, url: string) => {
    try {
      await Share.share({
        message: `Scan this QR code to log cleaning for ${locationName}:\n${url}`,
        title: `Acadia Clean - ${locationName}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleViewPublicPage = (locationId: string) => {
    setSelectedLocationId(null); // Close modal first
    setTimeout(() => {
      router.push(`/washroom/${locationId}`);
    }, 100);
  };

  const handleDeleteLocation = (location: WashroomLocation) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"?\n\nThis will permanently delete all cleaning logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingLocationId(location.id);
            try {
              await supabaseDeleteLogsForLocation(location.id);
              await supabaseDeleteWashroom(location.id);
              deleteLocation(location.id);
              setBusinessLocations(prev => prev.filter(w => w.id !== location.id));
              setAllLogs(prev => prev.filter(log => log.location_id !== location.id));
              Alert.alert('Success', `"${location.name}" has been deleted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete location.');
            }
            setDeletingLocationId(null);
          },
        },
      ]
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const generateCSV = (logs: CleaningLogRow[], locationName: string, businessDisplayName: string): string => {
    const headers = [
      'Date/Time',
      'Staff Name',
      // Section 1: Supplies & Restocking
      'Handwashing Station',
      'Toilet Paper',
      'Bins',
      // Section 2: Sanitization
      'Surfaces Disinfected',
      'Fixtures',
      // Section 3: Facility & Safety
      'Water Temperature',
      'Floors',
      'Ventilation & Lighting',
      'Maintenance Notes',
    ].join(',');

    const rows = logs.map((log) => {
      const dateTime = formatDateTime(log.timestamp);
      const staffName = `"${log.staff_name.replace(/"/g, '""')}"`;
      const notes = `"${(log.notes || '').replace(/"/g, '""')}"`;
      // Map legacy DB fields to new checklist items for display
      // Since DB still uses old fields, we map them appropriately
      return [
        dateTime,
        staffName,
        // Section 1: Supplies & Restocking (mapped from checklist_supplies and checklist_trash)
        log.checklist_supplies ? 'Yes' : 'No', // Handwashing Station
        log.checklist_supplies ? 'Yes' : 'No', // Toilet Paper
        log.checklist_trash ? 'Yes' : 'No',    // Bins
        // Section 2: Sanitization
        log.checklist_surfaces ? 'Yes' : 'No', // Surfaces Disinfected
        log.checklist_fixtures ? 'Yes' : 'No', // Fixtures
        // Section 3: Facility & Safety
        log.checklist_fixtures ? 'Yes' : 'No', // Water Temperature
        log.checklist_floor ? 'Yes' : 'No',    // Floors
        log.checklist_fixtures ? 'Yes' : 'No', // Ventilation & Lighting
        notes
      ].join(',');
    });

    return `${businessDisplayName}\nLocation / Emplacement: ${locationName}\n6 Month History / Historique de 6 mois\n\n${headers}\n${rows.join('\n')}`;
  };

  const handleExport = async (locationId: string) => {
    try {
      setExportingId(locationId);
      const location = displayLocations.find(l => l.id === locationId);
      if (!location) return;

      const result = await getSupabase6MonthLogs(locationId);
      if (!result.success || !result.data || result.data.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the past 6 months');
        setExportingId(null);
        return;
      }

      const businessDisplayName = currentBusiness?.name || 'Acadia Clean';
      const csv = generateCSV(result.data, location.name, businessDisplayName);
      const fileName = `${location.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-6-month-history.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csv);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV file');
    } finally {
      setExportingId(null);
    }
  };

  const generateAuditReportPDF = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);

    try {
      const result = await getLogsForDateRange(auditStartDate, auditEndDate);
      if (!result.success || !result.data || result.data.length === 0) {
        Alert.alert('No Data', 'No cleaning logs found for the selected date range');
        setIsGeneratingReport(false);
        return;
      }

      const logs = result.data;
      const completeCount = logs.filter(l => l.status === 'complete').length;
      const complianceRate = Math.round((completeCount / logs.length) * 100);

      // Helper function to render checkmark or X
      const checkIcon = (checked: boolean) => checked
        ? '<span style="color: #059669; font-weight: bold;">✓</span>'
        : '<span style="color: #dc2626; font-weight: bold;">✗</span>';

      const tableRows = logs.map((log) => `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; white-space: nowrap;">${formatDateTime(log.timestamp)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">${log.location_name}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">${log.staff_name}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_supplies)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_supplies)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_trash)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_surfaces)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_fixtures)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_fixtures)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_floor)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">${checkIcon(log.checklist_fixtures)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: center;">
            <span style="padding: 2px 6px; border-radius: 8px; font-weight: 600; font-size: 8px; ${
              log.status === 'complete' ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #fef3c7; color: #92400e;'
            }">${log.status === 'complete' ? '✓' : '!'}</span>
          </td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Audit Report</title></head>
          <body style="font-family: -apple-system, sans-serif; color: #1e293b; margin: 0; padding: 30px; min-height: 100vh; display: flex; flex-direction: column;">
            <div style="flex: 1;">
              <div style="text-align: center; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
                <h1 style="font-size: 22px; margin: 0;">${businessName}</h1>
                <p style="font-size: 13px; color: #1e293b; margin: 6px 0 2px 0;">Facility Maintenance Audit Report</p>
                <p style="font-size: 11px; color: #64748b; margin: 0;">Rapport d'audit d'entretien des installations</p>
                <p style="font-size: 12px; color: #475569; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; display: inline-block; margin-top: 10px;">
                  ${auditStartDate.toLocaleDateString()} — ${auditEndDate.toLocaleDateString()}
                </p>
              </div>

              <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700;">${logs.length}</div>
                  <div style="font-size: 10px; color: #1e293b;">Cleaning Logs</div>
                  <div style="font-size: 9px; color: #64748b;">Journaux de nettoyage</div>
                </div>
                <div style="flex: 1; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #059669;">${complianceRate}%</div>
                  <div style="font-size: 10px; color: #1e293b;">Compliance Rate</div>
                  <div style="font-size: 9px; color: #64748b;">Taux de conformité</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: #059669;">${completeCount}</div>
                  <div style="font-size: 10px; color: #1e293b;">Complete</div>
                  <div style="font-size: 9px; color: #64748b;">Complet</div>
                </div>
                <div style="flex: 1; background: ${logs.length - completeCount > 0 ? '#fef3c7' : '#f8fafc'}; border: 1px solid ${logs.length - completeCount > 0 ? '#fcd34d' : '#e2e8f0'}; border-radius: 10px; padding: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 700; color: ${logs.length - completeCount > 0 ? '#f59e0b' : '#64748b'};">${logs.length - completeCount}</div>
                  <div style="font-size: 10px; color: #1e293b;">Attention</div>
                  <div style="font-size: 9px; color: #64748b;">Attention requise</div>
                </div>
              </div>

              <!-- Checklist Legend -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
                <div style="font-size: 10px; font-weight: 600; color: #334155; margin-bottom: 6px;">Checklist Items / Éléments de la liste de contrôle:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 8px; color: #64748b;">
                  <span><b>HS:</b> Handwashing Station / Poste de lavage</span>
                  <span><b>TP:</b> Toilet Paper / Papier hygiénique</span>
                  <span><b>BN:</b> Bins / Poubelles</span>
                  <span><b>SD:</b> Surfaces Disinfected / Surfaces désinfectées</span>
                  <span><b>FX:</b> Fixtures / Installations</span>
                  <span><b>WT:</b> Water Temperature / Température de l'eau</span>
                  <span><b>FL:</b> Floors / Planchers</span>
                  <span><b>VL:</b> Ventilation & Lighting / Ventilation et éclairage</span>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 9px;">
                <thead>
                  <tr style="background: #0f172a; color: #fff;">
                    <th style="padding: 8px 4px; text-align: left; font-size: 8px;">Timestamp</th>
                    <th style="padding: 8px 4px; text-align: left; font-size: 8px;">Location</th>
                    <th style="padding: 8px 4px; text-align: left; font-size: 8px;">Staff</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">HS</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">TP</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">BN</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">SD</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">FX</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">WT</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">FL</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">VL</th>
                    <th style="padding: 8px 4px; text-align: center; font-size: 8px;">Status</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
            <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 11px; color: #059669; font-weight: 600; margin: 0;">Powered by Acadia Clean</p>
              <p style="font-size: 9px; color: #64748b; margin: 4px 0 0 0;">Generated on ${new Date().toLocaleDateString()} / Généré le ${new Date().toLocaleDateString('fr-CA')}</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-4 text-slate-600">Loading...</Text>
      </SafeAreaView>
    );
  }

  const isBusinessAuthenticated = !!currentBusiness;
  const showDashboard = isAuthenticated || isBusinessAuthenticated;

  // Password Setup Screen
  if (needsSetup && !showDashboard) {
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
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
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
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900"
              />
            </View>
            <Pressable
              onPress={handleSetupPassword}
              disabled={isSettingUp}
              className={`py-4 rounded-xl items-center ${isSettingUp ? 'bg-slate-400' : 'bg-emerald-600'}`}
            >
              <Text className="text-white text-lg font-bold">{isSettingUp ? 'Setting up...' : 'Set Password'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Login Screen
  if (!showDashboard) {
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
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  className="flex-1 px-4 py-3 text-base text-slate-900"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="px-4 py-3">
                  {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={handleLogin}
              disabled={isVerifying}
              className={`py-4 rounded-xl items-center ${isVerifying ? 'bg-slate-500' : 'bg-slate-900'}`}
            >
              <Text className="text-white text-lg font-bold">{isVerifying ? 'Verifying...' : 'Unlock'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.background }} edges={['top', 'bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* HERO HEADER - Business Name */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          className="px-5 pt-6 pb-4"
          style={{ backgroundColor: COLORS.primary }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <LogOut size={16} color="#ffffff" />
              <View>
                <Text className="text-white font-medium text-xs">Logout</Text>
                <Text className="text-white/80 text-[10px]">Déconnexion</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleRefreshData}
              className="p-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <RefreshCw size={18} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={() => setShowAddLocation(true)}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <Plus size={16} color="#ffffff" />
              <View className="ml-1">
                <Text className="text-white font-medium text-xs">Add Washroom</Text>
                <Text className="text-white/80 text-[10px]">Ajouter un emplacement</Text>
              </View>
            </Pressable>
          </View>

          <View className="items-center py-4">
            <View
              className="rounded-2xl p-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <Image
                source={require('../../assets/image-1767959752.png')}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
            </View>
            <Text
              className="text-2xl font-black text-center mt-3"
              style={{ color: COLORS.white, letterSpacing: 0.5 }}
            >
              {currentBusiness?.name || 'Acadia Clean'}
            </Text>
            <Text
              className="text-sm font-medium mt-1"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              Business Portal Dashboard
            </Text>
          </View>
        </Animated.View>

        {/* CURRENT STATUS GRID */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          className="px-5 py-4"
        >
          {displayLocations.length === 0 ? (
            <View
              className="rounded-2xl p-6 items-center"
              style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}
            >
              <MapPin size={40} color={COLORS.slate400} />
              <Text className="text-base text-center mt-3" style={{ color: COLORS.slate500 }}>
                No washroom locations yet. Tap "Add Washroom" to create your first.
              </Text>
              <Text className="text-sm text-center mt-1" style={{ color: COLORS.slate400 }}>
                Aucun emplacement. Appuyez sur "Ajouter un emplacement" pour créer le premier.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
              {displayLocations.map((location) => {
                const status = getLocationStatus(location.id);
                const statusColor = status === 'clean' ? COLORS.primary : status === 'attention' ? COLORS.amber : COLORS.slate400;
                const statusBg = status === 'clean' ? COLORS.primaryLight : status === 'attention' ? COLORS.amberLight : COLORS.slate100;
                const statusText = status === 'clean' ? 'CLEAN' : status === 'attention' ? 'ATTENTION' : 'NO DATA';

                return (
                  <Pressable
                    key={location.id}
                    onPress={() => setSelectedLocationId(location.id)}
                    className="active:opacity-80"
                    style={{ width: '50%', padding: 4 }}
                  >
                    <View
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: COLORS.white,
                        borderWidth: 2,
                        borderColor: statusColor,
                      }}
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: statusBg }}
                        >
                          {status === 'clean' ? (
                            <CheckCircle2 size={22} color={statusColor} />
                          ) : status === 'attention' ? (
                            <AlertTriangle size={22} color={statusColor} />
                          ) : (
                            <MapPin size={22} color={statusColor} />
                          )}
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleViewPublicPage(location.id);
                          }}
                          className="p-1.5 rounded-md active:opacity-70"
                          style={{ backgroundColor: COLORS.slate100 }}
                        >
                          <ExternalLink size={14} color={COLORS.slate500} />
                        </Pressable>
                      </View>
                      <Text
                        className="text-sm font-bold mb-1"
                        style={{ color: COLORS.slate800 }}
                        numberOfLines={1}
                      >
                        {location.name}
                      </Text>
                      <Text
                        className="text-xs font-bold"
                        style={{ color: statusColor }}
                      >
                        {statusText}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* RECENT CLEANING LOGS */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="px-5 py-4"
        >
          <View className="mb-3">
            <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }}>
              Recent Cleaning Logs
            </Text>
            <Text className="text-xs" style={{ color: COLORS.slate400 }}>
              Journaux de nettoyage récents
            </Text>
          </View>

          {isLoadingLogs ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text className="text-sm mt-2" style={{ color: COLORS.slate500 }}>Loading logs...</Text>
            </View>
          ) : recentLogs.length === 0 ? (
            <View
              className="rounded-xl p-6 items-center"
              style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}
            >
              <Text className="text-sm" style={{ color: COLORS.slate500 }}>Empty</Text>
              <Text className="text-xs" style={{ color: COLORS.slate400 }}>Vide</Text>
            </View>
          ) : (
            <View
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}
            >
              {recentLogs.map((log, index) => {
                const isClean = log.status === 'complete';
                const needsAttention = log.status === 'attention_required';
                return (
                  <View
                    key={log.id}
                    className="flex-row items-center p-3"
                    style={{
                      borderBottomWidth: index < recentLogs.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.slate100,
                    }}
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: needsAttention ? COLORS.amberLight : COLORS.primaryLight }}
                    >
                      {needsAttention ? (
                        <AlertTriangle size={16} color={COLORS.amber} />
                      ) : (
                        <CheckCircle2 size={16} color={COLORS.primary} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" style={{ color: COLORS.slate800 }}>
                        {log.location_name}
                      </Text>
                      <Text className="text-xs" style={{ color: COLORS.slate500 }}>
                        {log.staff_name} • {formatTimeAgo(log.timestamp)}
                      </Text>
                    </View>
                    <View className="items-end">
                      {needsAttention ? (
                        <>
                          <Text className="text-xs font-bold" style={{ color: COLORS.amber }}>ATTENTION</Text>
                          <Text className="text-[10px]" style={{ color: COLORS.amber }}>Attention requise</Text>
                        </>
                      ) : (
                        <>
                          <Text className="text-xs font-bold" style={{ color: COLORS.primary }}>CLEAN</Text>
                          <Text className="text-[10px]" style={{ color: COLORS.primary }}>Propre</Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* INSPECTOR MODE - At Bottom */}
        <Animated.View
          entering={FadeIn.delay(400).duration(500)}
          className="px-5 py-4 mb-4"
        >
          <Pressable
            onPress={() => setShowInspectorMode(!showInspectorMode)}
            className="rounded-xl p-4"
            style={{ backgroundColor: COLORS.indigoDark }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <ClipboardList size={20} color="#a5b4fc" />
                <View className="ml-2">
                  <Text className="text-base font-semibold text-white">
                    Send to Inspector
                  </Text>
                  <Text className="text-xs" style={{ color: '#a5b4fc' }}>
                    Envoyer à l'inspecteur
                  </Text>
                </View>
              </View>
              <ChevronRight
                size={20}
                color="#a5b4fc"
                style={{ transform: [{ rotate: showInspectorMode ? '90deg' : '0deg' }] }}
              />
            </View>

            {showInspectorMode && (
              <View className="mt-4">
                <Text className="text-sm mb-4" style={{ color: '#a5b4fc' }}>
                  Generate audit reports for NB Department of Health compliance.
                </Text>

                <View className="mb-3">
                  <Text className="text-xs font-medium mb-2" style={{ color: '#a5b4fc' }}>
                    Business Name
                  </Text>
                  <TextInput
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Enter business name"
                    placeholderTextColor="#818cf8"
                    className="rounded-lg px-4 py-3 text-base text-white"
                    style={{ backgroundColor: '#4338ca', borderWidth: 1, borderColor: '#6366f1' }}
                  />
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: '#a5b4fc' }}>Start Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={auditStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setAuditStartDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#4338ca', border: '1px solid #6366f1', borderRadius: 8,
                          padding: 12, color: '#fff', fontSize: 14, width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowStartPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#4338ca', borderWidth: 1, borderColor: '#6366f1' }}
                      >
                        <Calendar size={16} color="#a5b4fc" />
                        <Text className="text-white ml-2">
                          {auditStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-2" style={{ color: '#a5b4fc' }}>End Date</Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={auditEndDate.toISOString().split('T')[0]}
                        onChange={(e) => setAuditEndDate(new Date(e.target.value))}
                        style={{
                          backgroundColor: '#4338ca', border: '1px solid #6366f1', borderRadius: 8,
                          padding: 12, color: '#fff', fontSize: 14, width: '100%',
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => setShowEndPicker(true)}
                        className="flex-row items-center rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#4338ca', borderWidth: 1, borderColor: '#6366f1' }}
                      >
                        <Calendar size={16} color="#a5b4fc" />
                        <Text className="text-white ml-2">
                          {auditEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={generateAuditReportPDF}
                  disabled={isGeneratingReport}
                  className="flex-row items-center justify-center py-4 rounded-lg"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  {isGeneratingReport ? (
                    <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold ml-2">Generating...</Text></>
                  ) : (
                    <><FileText size={20} color="#fff" /><Text className="text-white font-bold ml-2">Generate Audit Report (PDF)</Text></>
                  )}
                </Pressable>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Compliance Footer */}
        <Animated.View
          entering={FadeIn.delay(500).duration(500)}
          className="px-5 pb-4"
        >
          <View
            className="rounded-xl p-4 items-center"
            style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}
          >
            <View className="flex-row items-center">
              <CheckCircle2 size={14} color={COLORS.primary} />
              <Text className="text-sm font-semibold ml-1.5" style={{ color: COLORS.primary }}>
                Compliance Verified
              </Text>
            </View>
            <Text className="text-xs mt-0.5" style={{ color: COLORS.slate400 }}>
              Conformité vérifiée
            </Text>
          </View>
        </Animated.View>

        {/* Powered by Acadia Clean Footer */}
        <View className="items-center pb-8">
          <Text className="text-xs" style={{ color: COLORS.slate400 }}>
            Powered by <Text className="font-semibold" style={{ color: COLORS.primary }}>Acadia Clean</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Add Location Modal */}
      <Modal
        visible={showAddLocation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddLocation(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.background }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.slate200 }}>
            <Pressable onPress={() => setShowAddLocation(false)}>
              <Text className="text-base font-medium" style={{ color: COLORS.slate500 }}>Cancel</Text>
            </Pressable>
            <View>
              <Text className="text-lg font-bold text-center" style={{ color: COLORS.slate800 }}>New Location</Text>
              <Text className="text-xs text-center" style={{ color: COLORS.slate400 }}>Nouvel emplacement</Text>
            </View>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView className="flex-1 px-5 py-6">
            <View className="mb-4">
              <Text className="text-sm font-semibold" style={{ color: COLORS.slate700 }}>Location Name</Text>
              <Text className="text-xs mb-2" style={{ color: COLORS.slate400 }}>Nom de l'emplacement</Text>
              <TextInput
                value={newLocationName}
                onChangeText={setNewLocationName}
                placeholder="e.g., Main Floor Restroom"
                placeholderTextColor={COLORS.slate400}
                className="rounded-xl px-4 py-4 text-base"
                style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200, color: COLORS.slate800 }}
              />
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2" style={{ color: COLORS.slate700 }}>PIN / NIP</Text>
              <TextInput
                value={newLocationPin}
                onChangeText={(text) => setNewLocationPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="e.g., 1234"
                placeholderTextColor={COLORS.slate400}
                keyboardType="number-pad"
                maxLength={4}
                className="rounded-xl px-4 py-4 text-base"
                style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200, color: COLORS.slate800 }}
              />
              <Text className="text-xs mt-1" style={{ color: COLORS.slate500 }}>Enter PIN to submit cleaning logs</Text>
              <Text className="text-xs" style={{ color: COLORS.slate400 }}>Entrez le NIP pour soumettre les journaux de nettoyage</Text>
            </View>
            <View className="mb-6">
              <Text className="text-sm font-semibold" style={{ color: COLORS.slate700 }}>Alert Email</Text>
              <Text className="text-xs mb-2" style={{ color: COLORS.slate400 }}>Courriel d'alerte</Text>
              <TextInput
                value={newLocationEmail}
                onChangeText={setNewLocationEmail}
                placeholder="supervisor@example.com"
                placeholderTextColor={COLORS.slate400}
                keyboardType="email-address"
                autoCapitalize="none"
                className="rounded-xl px-4 py-4 text-base"
                style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200, color: COLORS.slate800 }}
              />
              <Text className="text-xs mt-1" style={{ color: COLORS.slate500 }}>Receives alerts when issues need attention</Text>
              <Text className="text-xs" style={{ color: COLORS.slate400 }}>Reçoit des alertes lorsque des problèmes nécessitent une attention particulière</Text>
            </View>
            <Pressable
              onPress={handleAddNewLocation}
              disabled={isAddingLocation}
              className="flex-row items-center justify-center py-4 rounded-xl"
              style={{ backgroundColor: isAddingLocation ? COLORS.slate400 : COLORS.primary }}
            >
              {isAddingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="items-center">
                  <View className="flex-row items-center">
                    <Plus size={20} color="#fff" />
                    <Text className="text-white font-bold text-base ml-2">Create Location</Text>
                  </View>
                  <Text className="text-white/80 text-xs mt-0.5">Créer l'emplacement</Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Location Settings Modal */}
      <Modal
        visible={!!selectedLocationId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLocationId(null)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.background }}>
          {(() => {
            const location = displayLocations.find(l => l.id === selectedLocationId);
            if (!location) return null;

            return (
              <>
                <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.slate200 }}>
                  <Pressable onPress={() => setSelectedLocationId(null)}>
                    <Text className="text-base font-medium" style={{ color: COLORS.slate500 }}>Close</Text>
                  </Pressable>
                  <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }} numberOfLines={1}>{location.name}</Text>
                  <View style={{ width: 50 }} />
                </View>
                <ScrollView className="flex-1 px-5 py-6">
                  {/* QR Code URL Actions */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd' }}>
                    <View className="mb-2">
                      <View className="flex-row items-center">
                        <Link size={16} color="#2563eb" />
                        <Text className="text-sm font-semibold ml-2" style={{ color: '#1e40af' }}>QR Code URL</Text>
                      </View>
                      <Text className="text-xs ml-6" style={{ color: '#3b82f6' }}>URL du code QR</Text>
                    </View>
                    <Text className="text-xs font-mono mb-3" style={{ color: '#1e3a8a' }} selectable>
                      {getLocationUrl(location.id)}
                    </Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleCopyUrl(getLocationUrl(location.id))}
                        className="flex-1 items-center justify-center py-3 rounded-lg"
                        style={{ backgroundColor: '#2563eb' }}
                      >
                        <View className="flex-row items-center">
                          <Copy size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2">Copy</Text>
                        </View>
                        <Text className="text-white/80 text-[10px]">Copier</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleShareUrl(location.name, getLocationUrl(location.id))}
                        className="flex-1 items-center justify-center py-3 rounded-lg"
                        style={{ backgroundColor: COLORS.slate600 }}
                      >
                        <View className="flex-row items-center">
                          <ExternalLink size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2">Share</Text>
                        </View>
                        <Text className="text-white/80 text-[10px]">Partager</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Staff PIN */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.amberLight, borderWidth: 1, borderColor: '#fcd34d' }}>
                    <View className="mb-2">
                      <View className="flex-row items-center">
                        <Key size={16} color={COLORS.amber} />
                        <Text className="text-sm font-semibold ml-2" style={{ color: '#92400e' }}>Staff PIN</Text>
                      </View>
                      <Text className="text-xs ml-6" style={{ color: '#b45309' }}>NIP du personnel</Text>
                    </View>
                    {location.pinCode ? (
                      <View>
                        <Text className="text-3xl font-black tracking-widest" style={{ color: '#92400e' }}>{location.pinCode}</Text>
                        <Text className="text-xs mt-1" style={{ color: '#b45309' }}>Share with staff only</Text>
                        <Text className="text-[10px]" style={{ color: '#b45309' }}>Partager avec le personnel seulement</Text>
                      </View>
                    ) : (
                      <View>
                        <Text className="text-sm italic" style={{ color: '#b45309' }}>No PIN set</Text>
                        <Text className="text-xs italic" style={{ color: '#b45309' }}>Aucun NIP défini</Text>
                      </View>
                    )}
                  </View>

                  {/* View Public Page */}
                  <Pressable
                    onPress={() => handleViewPublicPage(location.id)}
                    className="items-center justify-center py-4 rounded-xl mb-4"
                    style={{ backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary }}
                  >
                    <View className="flex-row items-center">
                      <ExternalLink size={20} color={COLORS.primary} />
                      <Text className="font-bold ml-2" style={{ color: COLORS.primary }}>View Public Page</Text>
                    </View>
                    <Text className="text-xs" style={{ color: COLORS.primaryDark }}>Voir la page publique</Text>
                  </Pressable>

                  {/* Supervisor Email */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200 }}>
                    <View className="mb-2">
                      <View className="flex-row items-center">
                        <Mail size={16} color={COLORS.slate500} />
                        <Text className="text-sm font-semibold ml-2" style={{ color: COLORS.slate700 }}>Alert Email</Text>
                      </View>
                      <Text className="text-xs ml-6" style={{ color: COLORS.slate400 }}>Courriel d'alerte</Text>
                    </View>
                    <Text className="text-base" style={{ color: COLORS.slate800 }}>
                      {location.supervisorEmail || 'No email set'}
                    </Text>
                    {!location.supervisorEmail && (
                      <Text className="text-xs" style={{ color: COLORS.slate400 }}>Aucun courriel défini</Text>
                    )}
                  </View>

                  {/* Export CSV */}
                  <Pressable
                    onPress={() => handleExport(location.id)}
                    disabled={exportingId === location.id}
                    className="items-center justify-center py-4 rounded-xl mb-4"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    <View className="flex-row items-center">
                      <Download size={20} color="#fff" />
                      <Text className="text-white font-bold ml-2">
                        {exportingId === location.id ? 'Exporting...' : 'Export 6-Month History'}
                      </Text>
                    </View>
                    <Text className="text-white/80 text-xs">
                      {exportingId === location.id ? 'Exportation...' : 'Exporter l\'historique de 6 mois'}
                    </Text>
                  </Pressable>

                  {/* Delete */}
                  <Pressable
                    onPress={() => {
                      setSelectedLocationId(null);
                      setTimeout(() => handleDeleteLocation(location), 300);
                    }}
                    disabled={deletingLocationId === location.id}
                    className="items-center justify-center py-4 rounded-xl"
                    style={{ backgroundColor: COLORS.redLight, borderWidth: 1, borderColor: '#fecaca' }}
                  >
                    <View className="flex-row items-center">
                      <Trash2 size={20} color={COLORS.red} />
                      <Text className="font-bold ml-2" style={{ color: COLORS.red }}>Delete Location</Text>
                    </View>
                    <Text className="text-xs" style={{ color: COLORS.red }}>Supprimer l'emplacement</Text>
                  </Pressable>
                </ScrollView>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Newly Created Location Success Modal */}
      <Modal
        visible={!!newlyCreatedLocation}
        animationType="fade"
        transparent
        onRequestClose={() => setNewlyCreatedLocation(null)}
      >
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: COLORS.white }}>
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primaryLight }}>
                <CheckCircle2 size={32} color={COLORS.primary} />
              </View>
            </View>
            <Text className="text-xl font-bold text-center mb-2" style={{ color: COLORS.slate800 }}>
              Location Created!
            </Text>
            <Text className="text-base font-semibold text-center mb-4" style={{ color: COLORS.primary }}>
              {newlyCreatedLocation?.name}
            </Text>
            <View className="rounded-lg p-3 mb-4" style={{ backgroundColor: COLORS.slate100 }}>
              <Text className="text-xs text-center font-mono" style={{ color: COLORS.slate700 }} selectable>
                {newlyCreatedLocation ? getLocationUrl(newlyCreatedLocation.id) : ''}
              </Text>
            </View>
            <View className="flex-row gap-2 mb-3">
              <Pressable
                onPress={() => newlyCreatedLocation && handleCopyUrl(getLocationUrl(newlyCreatedLocation.id))}
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Copy size={16} color="#fff" />
                <Text className="text-white font-semibold ml-2">Copy URL</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setNewlyCreatedLocation(null)}
              className="py-3 items-center"
            >
              <Text className="font-medium" style={{ color: COLORS.slate500 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartPicker && Platform.OS !== 'web' && (
        <Modal transparent animationType="slide" visible={showStartPicker} onRequestClose={() => setShowStartPicker(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <Pressable className="flex-1" onPress={() => setShowStartPicker(false)} />
            <View className="bg-white rounded-t-3xl p-4 pb-8">
              <View className="flex-row justify-between items-center mb-4 px-2">
                <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }}>Select Start Date</Text>
                <Pressable onPress={() => setShowStartPicker(false)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: COLORS.indigo }}>
                  <Text className="text-white font-semibold">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={auditStartDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowStartPicker(false);
                  if (date) setAuditStartDate(date);
                }}
                maximumDate={auditEndDate}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndPicker && Platform.OS !== 'web' && (
        <Modal transparent animationType="slide" visible={showEndPicker} onRequestClose={() => setShowEndPicker(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <Pressable className="flex-1" onPress={() => setShowEndPicker(false)} />
            <View className="bg-white rounded-t-3xl p-4 pb-8">
              <View className="flex-row justify-between items-center mb-4 px-2">
                <Text className="text-lg font-bold" style={{ color: COLORS.slate800 }}>Select End Date</Text>
                <Pressable onPress={() => setShowEndPicker(false)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: COLORS.indigo }}>
                  <Text className="text-white font-semibold">Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={auditEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowEndPicker(false);
                  if (date) setAuditEndDate(date);
                }}
                minimumDate={auditStartDate}
                maximumDate={new Date()}
                style={{ height: 200, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
