import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput,
  ActivityIndicator, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin, CheckCircle2, AlertTriangle, AlertOctagon, ExternalLink, Power,
  Sparkles, Download, Mail, Key, ChevronRight, Save, X, Clock,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useManagerContext } from './ManagerContext';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

export function ManagerLocationsTab() {
  const ctx = useManagerContext();

  // Location settings modal
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editAlertEmail, setEditAlertEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // PIN management
  const [showPinManagement, setShowPinManagement] = useState(false);
  const [newStaffPin, setNewStaffPin] = useState('');
  const [confirmStaffPin, setConfirmStaffPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLocationId, setExportLocationId] = useState<string | null>(null);
  const [exportLocationName, setExportLocationName] = useState('');
  const [exportStartDate, setExportStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [exportEndDate, setExportEndDate] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const openLocationSettings = (locationId: string) => {
    const loc = ctx.displayLocations.find(l => l.id === locationId);
    setSelectedLocationId(locationId);
    setEditAlertEmail(loc?.supervisorEmail || '');
    setShowPinManagement(false);
    setNewStaffPin('');
    setConfirmStaffPin('');
  };

  const handleSaveEmail = async () => {
    if (!selectedLocationId) return;
    setIsSavingEmail(true);
    await ctx.handleSaveAlertEmail(selectedLocationId, editAlertEmail.trim());
    setIsSavingEmail(false);
  };

  const handleSavePin = async () => {
    if (!selectedLocationId) return;
    if (!newStaffPin || newStaffPin.length < 4 || newStaffPin.length > 5 || !/^\d{4,5}$/.test(newStaffPin)) {
      Alert.alert('Error', 'Please enter a valid 4 or 5-digit PIN');
      return;
    }
    if (newStaffPin !== confirmStaffPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }
    setIsSavingPin(true);
    await ctx.handleSaveStaffPin(selectedLocationId, newStaffPin);
    setIsSavingPin(false);
    setNewStaffPin('');
    setConfirmStaffPin('');
    setShowPinManagement(false);
  };

  const openExportModal = (locationId: string) => {
    const loc = ctx.displayLocations.find(l => l.id === locationId);
    if (!loc) return;
    setExportLocationId(locationId);
    setExportLocationName(loc.name);
    setExportStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    setExportEndDate(new Date());
    setShowExportModal(true);
    setSelectedLocationId(null);
  };

  const handleExportPDF = async () => {
    if (!exportLocationId) return;
    setIsExporting(true);
    try {
      await ctx.handlePremiumExport(exportLocationId, exportLocationName, exportStartDate, exportEndDate);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
    setIsExporting(false);
    setShowExportModal(false);
  };

  // Get last two cleaning times for a location
  const getRecentCleaningTimes = (locationId: string) => {
    const locationLogs = ctx.allLogs.filter(log => log.location_id === locationId);
    if (locationLogs.length === 0) return { first: null, second: null, firstStaff: null, secondStaff: null };
    return {
      first: ctx.formatDateTime(locationLogs[0].timestamp),
      firstStaff: locationLogs[0].staff_name,
      second: locationLogs[1] ? ctx.formatDateTime(locationLogs[1].timestamp) : null,
      secondStaff: locationLogs[1]?.staff_name || null,
    };
  };

  if (ctx.displayLocations.length === 0) {
    return (
      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View
          className="rounded-2xl p-8 items-center"
          style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}
        >
          <MapPin size={48} color={C.textMuted} />
          <Text className="text-base text-center mt-4 font-medium" style={{ color: C.textPrimary }}>
            No washroom locations yet
          </Text>
          <Text className="text-sm text-center mt-2" style={{ color: C.textMuted }}>
            Contact your administrator to add locations.
          </Text>
          <Text className="text-xs text-center mt-1" style={{ color: C.textMuted }}>
            Contactez votre administrateur pour ajouter des emplacements.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
        {ctx.displayLocations.map((location, index) => {
          const isInactive = location.isActive === false;
          const status = ctx.getLocationStatus(location.id);
          const isNew = status === 'unknown' && !isInactive;
          const recentCleanings = getRecentCleaningTimes(location.id);

          const statusConfig = isInactive
            ? { color: '#94a3b8', bg: '#f1f5f9', text: 'INACTIVE', textFr: 'Inactif', icon: Power, borderColor: '#e2e8f0' }
            : isNew
            ? { color: '#2563eb', bg: '#dbeafe', text: 'NEW', textFr: 'Nouveau', icon: Sparkles, borderColor: '#93c5fd' }
            : status === 'issue'
            ? { color: '#dc2626', bg: '#fef2f2', text: 'ISSUE IDENTIFIED', textFr: 'Problème identifié', icon: AlertOctagon, borderColor: '#fca5a5' }
            : status === 'clean'
            ? { color: C.actionGreen, bg: C.successBg, text: 'CLEAN', textFr: 'Propre', icon: CheckCircle2, borderColor: '#86efac' }
            : status === 'attention'
            ? { color: '#d97706', bg: C.warningBg, text: 'ATTENTION', textFr: 'Attention requise', icon: AlertTriangle, borderColor: '#fcd34d' }
            : { color: '#94a3b8', bg: '#f1f5f9', text: 'NO DATA', textFr: 'Pas de données', icon: MapPin, borderColor: '#e2e8f0' };

          const StatusIcon = statusConfig.icon;

          return (
            <Animated.View key={location.id} entering={FadeInDown.delay(index * 60).duration(400)}>
              <Pressable
                onPress={() => openLocationSettings(location.id)}
                className="mb-4 active:opacity-90"
                style={{ opacity: isInactive ? 0.6 : 1 }}
              >
                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: C.white,
                    borderLeftWidth: 6,
                    borderLeftColor: statusConfig.color,
                    ...D.shadow.sm,
                  }}
                >
                  {/* Status banner */}
                  <View
                    className="px-5 py-4 flex-row items-center justify-between"
                    style={{ backgroundColor: statusConfig.bg }}
                  >
                    <View className="flex-row items-center">
                      <StatusIcon size={28} color={statusConfig.color} />
                      <View className="ml-3">
                        <Text className="text-2xl font-black tracking-wide" style={{ color: statusConfig.color }}>
                          {statusConfig.text}
                        </Text>
                        <Text className="text-sm font-medium" style={{ color: statusConfig.color, opacity: 0.8 }}>
                          {statusConfig.textFr}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={statusConfig.color} />
                  </View>

                  {/* Main content */}
                  <View className="px-5 py-5">
                    {/* Location name - large */}
                    <Text
                      className="text-xl font-bold mb-3"
                      style={{ color: C.textPrimary }}
                      numberOfLines={2}
                    >
                      {location.name}
                    </Text>

                    {/* Recent Cleanings - shows last two timestamps like public page */}
                    {recentCleanings.first ? (
                      <View className="py-2.5 px-3 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                        <View className="flex-row items-center mb-2">
                          <Clock size={14} color={C.textMuted} />
                          <Text className="text-xs font-medium ml-1.5" style={{ color: C.textMuted }}>
                            Recent Cleanings / Nettoyages récents
                          </Text>
                        </View>
                        {/* Most recent cleaning */}
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-semibold" style={{ color: C.textPrimary }}>
                            {recentCleanings.first}
                          </Text>
                          {recentCleanings.firstStaff && (
                            <Text className="text-xs" style={{ color: C.textMuted }}>
                              {recentCleanings.firstStaff}
                            </Text>
                          )}
                        </View>
                        {/* Second most recent cleaning */}
                        {recentCleanings.second && (
                          <View className="flex-row items-center justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                            <Text className="text-sm" style={{ color: C.textMuted }}>
                              {recentCleanings.second}
                            </Text>
                            {recentCleanings.secondStaff && (
                              <Text className="text-xs" style={{ color: C.textMuted }}>
                                {recentCleanings.secondStaff}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View className="flex-row items-center py-2.5 px-3 rounded-xl" style={{ backgroundColor: statusConfig.bg }}>
                        <StatusIcon size={16} color={statusConfig.color} />
                        <Text className="text-sm font-medium ml-2.5" style={{ color: statusConfig.color }}>
                          {isNew ? 'Awaiting first scan / En attente du premier scan' : statusConfig.textFr}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Location Settings Modal */}
      <Modal
        visible={!!selectedLocationId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedLocationId(null)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: C.mintBackground }}>
          {(() => {
            const location = ctx.displayLocations.find(l => l.id === selectedLocationId);
            if (!location) return null;
            const status = ctx.getLocationStatus(location.id);

            return (
              <>
                {/* Header */}
                <View
                  className="flex-row items-center justify-between px-5 py-4"
                  style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}
                >
                  <Pressable onPress={() => setSelectedLocationId(null)} className="py-1">
                    <Text className="text-base font-medium" style={{ color: C.textMuted }}>Close</Text>
                  </Pressable>
                  <Text className="text-lg font-bold" style={{ color: C.textPrimary }} numberOfLines={1}>
                    {location.name}
                  </Text>
                  <View style={{ width: 50 }} />
                </View>

                <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
                  {/* View Public Page */}
                  <Pressable
                    onPress={() => {
                      setSelectedLocationId(null);
                      setTimeout(() => ctx.handleViewPublicPage(location.id), 100);
                    }}
                    className="flex-row items-center justify-center py-4 rounded-xl mb-4 active:opacity-80"
                    style={{ backgroundColor: C.emeraldLight, borderWidth: 1, borderColor: C.emeraldDark }}
                  >
                    <ExternalLink size={18} color={C.emeraldDark} />
                    <View className="ml-2">
                      <Text className="font-bold" style={{ color: C.emeraldDark }}>View Public Page</Text>
                      <Text className="text-xs" style={{ color: C.emerald }}>Voir la page publique</Text>
                    </View>
                  </Pressable>

                  {/* Export History */}
                  <Pressable
                    onPress={() => openExportModal(location.id)}
                    className="flex-row items-center justify-center py-4 rounded-xl mb-4 active:opacity-80"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    <Download size={18} color="#fff" />
                    <View className="ml-2">
                      <Text className="font-bold text-white">Export History (PDF)</Text>
                      <Text className="text-xs text-white/80">Exporter l'historique</Text>
                    </View>
                  </Pressable>

                  {/* Staff PIN - Owner only */}
                  {ctx.canPerformAction('canEditSettings') && (
                    <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d' }}>
                      <Pressable onPress={() => setShowPinManagement(!showPinManagement)}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Key size={16} color="#92400e" />
                            <Text className="text-sm font-semibold ml-2" style={{ color: '#92400e' }}>Staff PIN</Text>
                          </View>
                          <ChevronRight
                            size={18} color="#92400e"
                            style={{ transform: [{ rotate: showPinManagement ? '90deg' : '0deg' }] }}
                          />
                        </View>
                        <Text className="text-xs mt-1" style={{ color: '#b45309' }}>NIP du personnel</Text>
                        {(ctx.currentBusiness?.staff_pin_display || location.pinCode) && (
                          <Text className="text-3xl font-black tracking-widest mt-2" style={{ color: '#92400e' }}>
                            {ctx.currentBusiness?.staff_pin_display || location.pinCode}
                          </Text>
                        )}
                      </Pressable>

                      {showPinManagement && (
                        <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: '#fcd34d' }}>
                          <View className="mb-3">
                            <Text className="text-xs font-medium mb-2" style={{ color: '#92400e' }}>
                              New PIN (4-5 digits)
                            </Text>
                            <TextInput
                              value={newStaffPin} onChangeText={setNewStaffPin}
                              placeholder="Enter new PIN" placeholderTextColor="#d97706"
                              keyboardType="numeric" maxLength={5} secureTextEntry
                              className="rounded-lg px-4 py-3 text-base"
                              style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', color: '#92400e' }}
                            />
                          </View>
                          <View className="mb-4">
                            <Text className="text-xs font-medium mb-2" style={{ color: '#92400e' }}>
                              Confirm PIN / Confirmer le NIP
                            </Text>
                            <TextInput
                              value={confirmStaffPin} onChangeText={setConfirmStaffPin}
                              placeholder="Confirm new PIN" placeholderTextColor="#d97706"
                              keyboardType="numeric" maxLength={5} secureTextEntry
                              className="rounded-lg px-4 py-3 text-base"
                              style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', color: '#92400e' }}
                            />
                          </View>
                          <Pressable
                            onPress={handleSavePin} disabled={isSavingPin}
                            className="flex-row items-center justify-center py-3 rounded-lg"
                            style={{ backgroundColor: isSavingPin ? '#d97706' : '#92400e' }}
                          >
                            {isSavingPin ? <ActivityIndicator size="small" color="#fff" /> : (
                              <><Save size={18} color="#fff" /><Text className="text-white font-bold ml-2">Save PIN</Text></>
                            )}
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Alert Email */}
                  <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
                    <View className="flex-row items-center mb-2">
                      <Mail size={16} color={C.textMuted} />
                      <Text className="text-sm font-semibold ml-2" style={{ color: C.textPrimary }}>Alert Email</Text>
                    </View>
                    <Text className="text-xs mb-3" style={{ color: C.textMuted }}>
                      {ctx.useGlobalAlerts
                        ? 'Global alerts are ON. This email receives alerts in addition to global list.'
                        : 'Only this email will receive alerts for this location.'}
                    </Text>
                    <TextInput
                      value={editAlertEmail} onChangeText={setEditAlertEmail}
                      placeholder="supervisor@example.com" placeholderTextColor={C.textMuted}
                      keyboardType="email-address" autoCapitalize="none"
                      className="rounded-lg px-4 py-3 mb-3"
                      style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: C.textPrimary }}
                    />
                    <Pressable
                      onPress={handleSaveEmail} disabled={isSavingEmail}
                      className="flex-row items-center justify-center py-3 rounded-lg"
                      style={{ backgroundColor: isSavingEmail ? C.textMuted : C.actionGreen }}
                    >
                      {isSavingEmail ? <ActivityIndicator size="small" color="#fff" /> : (
                        <><Save size={16} color="#fff" /><Text className="text-white font-semibold ml-2">Save Email</Text></>
                      )}
                    </Pressable>
                  </View>

                  {/* Active Toggle */}
                  <View className="rounded-xl p-4 mb-4" style={{
                    backgroundColor: location.isActive !== false ? C.emeraldLight : '#fef2f2',
                    borderWidth: 1,
                    borderColor: location.isActive !== false ? '#86efac' : '#fecaca',
                  }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <Power size={18} color={location.isActive !== false ? C.actionGreen : '#ef4444'} />
                        <View className="ml-3">
                          <Text className="text-sm font-semibold" style={{ color: location.isActive !== false ? C.emeraldDark : '#ef4444' }}>
                            {location.isActive !== false ? 'Active' : 'Inactive'}
                          </Text>
                          <Text className="text-xs" style={{ color: C.textMuted }}>
                            {location.isActive !== false ? 'Emplacement actif' : 'Emplacement inactif'}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={location.isActive !== false}
                        onValueChange={() => ctx.handleToggleLocationActive(location)}
                        trackColor={{ false: '#fca5a5', true: '#86efac' }}
                        thumbColor={location.isActive !== false ? C.actionGreen : '#ef4444'}
                        ios_backgroundColor="#fca5a5"
                      />
                    </View>
                  </View>
                </ScrollView>
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Export Date Range Modal */}
      <Modal
        visible={showExportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>Export History</Text>
              <Text className="text-sm" style={{ color: C.textMuted }}>{exportLocationName}</Text>
            </View>
            <Pressable onPress={() => setShowExportModal(false)} className="p-2 rounded-full" style={{ backgroundColor: C.borderLight }}>
              <X size={20} color={C.textMuted} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
              <Text className="text-sm font-semibold mb-3" style={{ color: C.emeraldDark }}>
                Select Date Range / Sélectionner la période
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>Start Date</Text>
                  <input
                    type="date"
                    value={exportStartDate.toISOString().split('T')[0]}
                    onChange={(e: any) => setExportStartDate(new Date(e.target.value))}
                    style={{
                      backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
                      padding: 12, color: '#1e293b', fontSize: 14, width: '100%',
                    }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>End Date</Text>
                  <input
                    type="date"
                    value={exportEndDate.toISOString().split('T')[0]}
                    onChange={(e: any) => setExportEndDate(new Date(e.target.value))}
                    style={{
                      backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
                      padding: 12, color: '#1e293b', fontSize: 14, width: '100%',
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Quick Select */}
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
              <Text className="text-xs font-medium mb-3" style={{ color: C.textMuted }}>Quick Select</Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { label: '7 Days', days: 7 },
                  { label: '14 Days', days: 14 },
                  { label: '30 Days', days: 30 },
                  { label: '90 Days', days: 90 },
                ].map(opt => (
                  <Pressable
                    key={opt.days}
                    onPress={() => {
                      const end = new Date();
                      const start = new Date(); start.setDate(start.getDate() - opt.days);
                      setExportStartDate(start); setExportEndDate(end);
                    }}
                    className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last {opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleExportPDF} disabled={isExporting}
              className="flex-row items-center justify-center py-4 rounded-xl mb-4"
              style={{ backgroundColor: isExporting ? '#94a3b8' : C.actionGreen }}
            >
              {isExporting ? (
                <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold ml-2">Generating PDF...</Text></>
              ) : (
                <><Download size={20} color="#fff" /><Text className="text-white font-bold ml-2">Export to PDF</Text></>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
