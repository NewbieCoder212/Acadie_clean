import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput,
  ActivityIndicator, Switch, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mail, ChevronRight, Save, Plus, X, ClipboardList, FileText,
  Calendar, Users, UserPlus, Shield, Eye, Crown, Trash2, Clock, Key,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useManagerContext, SafeManagerRow, ManagerPermissions, ManagerRole, AlertSchedule } from './ManagerContext';
import { DEFAULT_ALERT_SCHEDULE, updateAllWashroomPinsForBusiness } from '@/lib/supabase';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';
import { TimePickerModal } from '@/components/TimePickerModal';
import { parseTimeString } from '@/lib/timezone';

type TeamMember = SafeManagerRow & { role: ManagerRole; permissions: ManagerPermissions };

export function ManagerSettingsTab() {
  const ctx = useManagerContext();

  // Alert settings
  const [localGlobalEmails, setLocalGlobalEmails] = useState<string[]>([]);
  const [localUseGlobal, setLocalUseGlobal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  // Per-day schedule
  const [localSchedule, setLocalSchedule] = useState<AlertSchedule>(DEFAULT_ALERT_SCHEDULE);

  // Combined saving state for alerts + schedule
  const [isSavingAllSettings, setIsSavingAllSettings] = useState(false);

  // PIN Management
  const [showPinSection, setShowPinSection] = useState(false);
  const [newUniversalPin, setNewUniversalPin] = useState('');
  const [confirmUniversalPin, setConfirmUniversalPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Time Picker Modal
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDay, setTimePickerDay] = useState<string>('');
  const [timePickerField, setTimePickerField] = useState<'start' | 'end'>('start');
  const [timePickerInitial, setTimePickerInitial] = useState('08:00');

  // Inspector / Audit
  const [showInspector, setShowInspector] = useState(false);
  const [localBusinessName, setLocalBusinessName] = useState('');
  const [localBusinessAddress, setLocalBusinessAddress] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [auditStartDate, setAuditStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [auditEndDate, setAuditEndDate] = useState<Date>(new Date());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Team
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<ManagerRole>('supervisor');
  const [isInviting, setIsInviting] = useState(false);

  // Sync from context
  useEffect(() => {
    setLocalGlobalEmails(ctx.globalAlertEmails);
    setLocalUseGlobal(ctx.useGlobalAlerts);
    setLocalBusinessName(ctx.businessName);
    setLocalBusinessAddress(ctx.businessAddress);
    setLocalSchedule(ctx.alertSchedule);
  }, [ctx.globalAlertEmails, ctx.useGlobalAlerts, ctx.businessName, ctx.businessAddress, ctx.alertSchedule]);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (localGlobalEmails.includes(email)) {
      Alert.alert('Error', 'This email is already in the list');
      return;
    }
    setLocalGlobalEmails(prev => [...prev, email]);
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setLocalGlobalEmails(prev => prev.filter(e => e !== email));
  };

  const handleSaveAlertSettings = async () => {
    setIsSavingAlerts(true);
    await ctx.handleSaveGlobalAlertSettings(localGlobalEmails, localUseGlobal);
    setIsSavingAlerts(false);
  };

  // Combined save for alert emails + schedule
  const handleSaveAllAlertSettings = async () => {
    setIsSavingAllSettings(true);
    await ctx.handleSaveGlobalAlertSettings(localGlobalEmails, localUseGlobal);
    await ctx.handleSaveAlertSchedule(localSchedule);
    setIsSavingAllSettings(false);
    Alert.alert('Success', 'Alert settings and schedule saved!\nParamètres d\'alerte et horaire enregistrés!');
  };

  // Save universal PIN for all washrooms
  const handleSaveUniversalPin = async () => {
    if (!newUniversalPin || newUniversalPin.length < 4 || newUniversalPin.length > 5 || !/^\d{4,5}$/.test(newUniversalPin)) {
      Alert.alert('Error', 'Please enter a valid 4 or 5-digit PIN');
      return;
    }
    if (newUniversalPin !== confirmUniversalPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }
    if (!ctx.currentBusiness?.name) {
      Alert.alert('Error', 'Business not found');
      return;
    }
    setIsSavingPin(true);
    const result = await updateAllWashroomPinsForBusiness(ctx.currentBusiness.name, newUniversalPin);
    setIsSavingPin(false);
    if (result.success) {
      Alert.alert('Success', `PIN updated for ${result.updatedCount} locations!\nNIP mis à jour pour ${result.updatedCount} emplacements!`);
      setNewUniversalPin('');
      setConfirmUniversalPin('');
      setShowPinSection(false);
      ctx.handleRefreshData();
    } else {
      Alert.alert('Error', result.error || 'Failed to update PIN');
    }
  };

  const ALL_DAYS: { key: string; label: string }[] = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  const toggleDayEnabled = (dayKey: string) => {
    setLocalSchedule(prev => {
      const current = prev[dayKey as keyof AlertSchedule] || { enabled: false, start: '08:00', end: '18:00' };
      return { ...prev, [dayKey]: { ...current, enabled: !current.enabled } };
    });
  };

  const updateDayTime = (dayKey: string, field: 'start' | 'end', value: string) => {
    setLocalSchedule(prev => {
      const current = prev[dayKey as keyof AlertSchedule] || { enabled: true, start: '08:00', end: '18:00' };
      return { ...prev, [dayKey]: { ...current, [field]: value } };
    });
  };

  const openTimePicker = (dayKey: string, field: 'start' | 'end', currentValue: string) => {
    setTimePickerDay(dayKey);
    setTimePickerField(field);
    setTimePickerInitial(currentValue);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time: string) => {
    if (timePickerDay) {
      updateDayTime(timePickerDay, timePickerField, time);
    }
  };

  // Format 24h time to 12h display
  const formatTimeDisplay = (time24: string): string => {
    const { hours, minutes } = parseTimeString(time24);
    const m = minutes.toString().padStart(2, '0');
    if (hours === 0) return `12:${m} AM`;
    if (hours < 12) return `${hours}:${m} AM`;
    if (hours === 12) return `12:${m} PM`;
    return `${hours - 12}:${m} PM`;
  };

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    await ctx.handleSaveBusinessAddress(localBusinessAddress);
    setIsSavingAddress(false);
  };

  const handleGenerateAudit = async () => {
    setIsGeneratingReport(true);
    try {
      await ctx.generateAuditReportPDF(localBusinessName, auditStartDate, auditEndDate);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate report');
    }
    setIsGeneratingReport(false);
  };

  const handleOpenTeam = async () => {
    setShowTeamModal(true);
    setIsLoadingTeam(true);
    const members = await ctx.loadTeamMembers();
    setTeamMembers(members);
    setIsLoadingTeam(false);
  };

  const handleInvite = async () => {
    setIsInviting(true);
    const success = await ctx.handleInviteUser(inviteEmail.trim(), inviteName.trim(), inviteRole);
    if (success) {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      // Refresh team list
      const members = await ctx.loadTeamMembers();
      setTeamMembers(members);
    }
    setIsInviting(false);
  };

  return (
    <>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}>

        {/* Alert Email Settings - Owner only */}
        {ctx.canPerformAction('canEditSettings') && (
          <Animated.View entering={FadeIn.delay(100).duration(400)}>
            <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: C.white, ...D.shadow.sm }}>
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#dbeafe' }}>
                  <Mail size={20} color="#1e40af" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold" style={{ color: C.textPrimary }}>Alert Email Settings</Text>
                  <Text className="text-xs" style={{ color: C.textMuted }}>Paramètres des courriels d'alerte</Text>
                </View>
              </View>

              {/* Global toggle */}
              <View className="rounded-xl p-3 mb-3" style={{ backgroundColor: '#f1f5f9' }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-xs font-semibold" style={{ color: C.textPrimary }}>
                      Use Global Emails for All Locations
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                      Utiliser les courriels globaux
                    </Text>
                  </View>
                  <Switch
                    value={localUseGlobal} onValueChange={setLocalUseGlobal}
                    trackColor={{ false: '#d1d5db', true: '#86efac' }}
                    thumbColor={localUseGlobal ? C.actionGreen : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Email list */}
              {localGlobalEmails.length > 0 && (
                <View className="mb-3">
                  {localGlobalEmails.map((email, idx) => (
                    <View key={idx} className="flex-row items-center justify-between rounded-lg px-3 py-2 mb-1.5" style={{ backgroundColor: '#f1f5f9' }}>
                      <Text className="text-sm flex-1" style={{ color: C.textPrimary }} numberOfLines={1}>{email}</Text>
                      <Pressable onPress={() => handleRemoveEmail(email)} className="p-1 ml-2 rounded-full" style={{ backgroundColor: '#fee2e2' }}>
                        <X size={14} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {localGlobalEmails.length === 0 && (
                <View className="rounded-lg p-3 mb-3 items-center" style={{ backgroundColor: '#f8fafc' }}>
                  <Text className="text-xs" style={{ color: C.textMuted }}>No global emails added yet</Text>
                </View>
              )}

              {/* Add email */}
              <View className="flex-row items-center gap-2 mb-3">
                <TextInput
                  value={newEmail} onChangeText={setNewEmail}
                  placeholder="supervisor@example.com" placeholderTextColor={C.textMuted}
                  keyboardType="email-address" autoCapitalize="none"
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm"
                  style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', color: C.textPrimary }}
                />
                <Pressable onPress={handleAddEmail} className="rounded-lg p-2.5" style={{ backgroundColor: C.actionGreen }}>
                  <Plus size={18} color="#fff" />
                </Pressable>
              </View>

            </View>
          </Animated.View>
        )}

        {/* Business Hours Schedule - Owner/Supervisor */}
        {ctx.canPerformAction('canEditSettings') && (
          <Animated.View entering={FadeIn.delay(150).duration(400)}>
            <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: C.white, ...D.shadow.sm }}>
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
                  <Clock size={20} color="#d97706" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold" style={{ color: C.textPrimary }}>Business Hours Schedule</Text>
                  <Text className="text-xs" style={{ color: C.textMuted }}>Horaire d'ouverture (alerts only during these hours)</Text>
                </View>
              </View>

              {ALL_DAYS.map((day) => {
                const daySchedule = localSchedule[day.key as keyof AlertSchedule];
                const isEnabled = daySchedule?.enabled ?? false;
                const startTime = daySchedule?.start ?? '08:00';
                const endTime = daySchedule?.end ?? '18:00';

                return (
                  <View
                    key={day.key}
                    className="rounded-xl p-3 mb-2"
                    style={{ backgroundColor: isEnabled ? '#f0fdf4' : '#f8fafc', borderWidth: 1, borderColor: isEnabled ? '#bbf7d0' : '#e2e8f0' }}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-sm font-semibold" style={{ color: isEnabled ? C.textPrimary : C.textMuted }}>
                        {day.label}
                      </Text>
                      <Switch
                        value={isEnabled}
                        onValueChange={() => toggleDayEnabled(day.key)}
                        trackColor={{ false: '#d1d5db', true: '#86efac' }}
                        thumbColor={isEnabled ? C.actionGreen : '#f4f3f4'}
                      />
                    </View>
                    {isEnabled && (
                      <View className="flex-row items-center gap-2 mt-1">
                        <Pressable
                          onPress={() => openTimePicker(day.key, 'start', startTime)}
                          className="flex-1 rounded-lg px-3 py-2.5 items-center active:opacity-70"
                          style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.actionGreen }}
                        >
                          <Text className="text-sm font-medium" style={{ color: C.emeraldDark }}>
                            {formatTimeDisplay(startTime)}
                          </Text>
                        </Pressable>
                        <Text className="text-xs font-medium" style={{ color: C.textMuted }}>to</Text>
                        <Pressable
                          onPress={() => openTimePicker(day.key, 'end', endTime)}
                          className="flex-1 rounded-lg px-3 py-2.5 items-center active:opacity-70"
                          style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.actionGreen }}
                        >
                          <Text className="text-sm font-medium" style={{ color: C.emeraldDark }}>
                            {formatTimeDisplay(endTime)}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              <Text className="text-[10px] mb-3 mt-1" style={{ color: C.textMuted }}>
                Tap times to change. All times in Atlantic timezone (Moncton/Dieppe).
              </Text>

              <Pressable
                onPress={handleSaveAllAlertSettings} disabled={isSavingAllSettings}
                className="flex-row items-center justify-center py-3 rounded-lg"
                style={{ backgroundColor: isSavingAllSettings ? C.textMuted : C.actionGreen }}
              >
                {isSavingAllSettings ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <><Save size={16} color="#fff" /><Text className="text-white font-bold ml-2">Save Alert & Schedule Settings</Text></>
                )}
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* PIN for All Washrooms - Owner only */}
        {ctx.canPerformAction('canEditSettings') && (
          <Animated.View entering={FadeIn.delay(175).duration(400)}>
            <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', ...D.shadow.sm }}>
              <Pressable onPress={() => setShowPinSection(!showPinSection)}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#fde68a' }}>
                      <Key size={20} color="#92400e" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-bold" style={{ color: '#92400e' }}>PIN for All Washrooms</Text>
                      <Text className="text-xs" style={{ color: '#b45309' }}>NIP pour tous les emplacements</Text>
                    </View>
                  </View>
                  <ChevronRight
                    size={18} color="#92400e"
                    style={{ transform: [{ rotate: showPinSection ? '90deg' : '0deg' }] }}
                  />
                </View>
              </Pressable>

              {/* Current PIN Display */}
              {ctx.currentBusiness?.staff_pin_display && (
                <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: '#fcd34d' }}>
                  <Text className="text-xs font-medium" style={{ color: '#b45309' }}>Current PIN / NIP actuel</Text>
                  <Text className="text-3xl font-black tracking-widest mt-1" style={{ color: '#92400e' }}>
                    {ctx.currentBusiness.staff_pin_display}
                  </Text>
                </View>
              )}

              {showPinSection && (
                <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: '#fcd34d' }}>
                  <Text className="text-xs mb-3" style={{ color: '#b45309' }}>
                    Update the staff PIN for all washroom locations at once.
                  </Text>

                  <View className="mb-3">
                    <Text className="text-xs font-medium mb-1.5" style={{ color: '#92400e' }}>New PIN (4-5 digits)</Text>
                    <TextInput
                      value={newUniversalPin} onChangeText={setNewUniversalPin}
                      placeholder="Enter new PIN" placeholderTextColor="#d97706"
                      keyboardType="numeric" maxLength={5} secureTextEntry
                      className="rounded-lg px-4 py-3 text-base"
                      style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', color: '#92400e' }}
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-xs font-medium mb-1.5" style={{ color: '#92400e' }}>Confirm PIN / Confirmer le NIP</Text>
                    <TextInput
                      value={confirmUniversalPin} onChangeText={setConfirmUniversalPin}
                      placeholder="Confirm new PIN" placeholderTextColor="#d97706"
                      keyboardType="numeric" maxLength={5} secureTextEntry
                      className="rounded-lg px-4 py-3 text-base"
                      style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', color: '#92400e' }}
                    />
                  </View>

                  <Pressable
                    onPress={handleSaveUniversalPin} disabled={isSavingPin}
                    className="flex-row items-center justify-center py-3 rounded-lg"
                    style={{ backgroundColor: isSavingPin ? '#d97706' : '#92400e' }}
                  >
                    {isSavingPin ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <><Save size={16} color="#fff" /><Text className="text-white font-bold ml-2">Update PIN for All Locations</Text></>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Inspector / Audit Reports */}
        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: C.white, ...D.shadow.sm }}>
            <Pressable onPress={() => setShowInspector(!showInspector)}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: C.emeraldLight }}>
                    <ClipboardList size={20} color={C.emeraldDark} />
                  </View>
                  <View className="ml-3">
                    <Text className="text-sm font-bold" style={{ color: C.textPrimary }}>Send to Inspector</Text>
                    <Text className="text-xs" style={{ color: C.textMuted }}>Envoyer à l'inspecteur</Text>
                  </View>
                </View>
                <ChevronRight
                  size={18} color={C.textMuted}
                  style={{ transform: [{ rotate: showInspector ? '90deg' : '0deg' }] }}
                />
              </View>
            </Pressable>

            {showInspector && (
              <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: C.borderLight }}>
                <Text className="text-xs mb-4" style={{ color: C.textMuted }}>
                  Generate audit reports for NB Department of Health compliance.
                </Text>

                <View className="mb-3">
                  <Text className="text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Business Name</Text>
                  <TextInput
                    value={localBusinessName} onChangeText={setLocalBusinessName}
                    placeholder="Enter business name" placeholderTextColor={C.textMuted}
                    className="rounded-lg px-3 py-2.5 text-sm"
                    style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', color: C.textPrimary }}
                  />
                </View>

                <View className="mb-3">
                  <Text className="text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Business Address</Text>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={localBusinessAddress} onChangeText={setLocalBusinessAddress}
                      placeholder="Enter business address" placeholderTextColor={C.textMuted}
                      className="flex-1 rounded-lg px-3 py-2.5 text-sm"
                      style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', color: C.textPrimary }}
                    />
                    <Pressable onPress={handleSaveAddress} disabled={isSavingAddress} className="rounded-lg p-2.5" style={{ backgroundColor: C.actionGreen }}>
                      {isSavingAddress ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
                    </Pressable>
                  </View>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Start Date</Text>
                    <input
                      type="date"
                      value={auditStartDate.toISOString().split('T')[0]}
                      onChange={(e: any) => setAuditStartDate(new Date(e.target.value))}
                      style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, color: '#1e293b', fontSize: 14, width: '100%' }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>End Date</Text>
                    <input
                      type="date"
                      value={auditEndDate.toISOString().split('T')[0]}
                      onChange={(e: any) => setAuditEndDate(new Date(e.target.value))}
                      style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, color: '#1e293b', fontSize: 14, width: '100%' }}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleGenerateAudit} disabled={isGeneratingReport}
                  className="flex-row items-center justify-center py-3.5 rounded-lg"
                  style={{ backgroundColor: isGeneratingReport ? C.textMuted : C.actionGreen }}
                >
                  {isGeneratingReport ? (
                    <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold ml-2">Generating...</Text></>
                  ) : (
                    <><FileText size={18} color="#fff" /><Text className="text-white font-bold ml-2">Generate Audit Report (PDF)</Text></>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Compliance Footer */}
        <View className="rounded-xl p-3 items-center mt-2" style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: C.borderLight }}>
          <Text className="text-xs font-medium" style={{ color: C.actionGreen }}>Compliance Verified / Conformité vérifiée</Text>
        </View>

        <View className="items-center mt-4">
          <Text className="text-xs" style={{ color: C.textMuted }}>
            Powered by <Text className="font-semibold" style={{ color: C.emeraldDark }}>Acadia Clean IQ</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Team Management Modal */}
      <Modal visible={showTeamModal} transparent animationType="slide" onRequestClose={() => setShowTeamModal(false)}>
        <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable className="flex-1" onPress={() => setShowTeamModal(false)} />
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xl font-bold" style={{ color: C.textPrimary }}>Team Management</Text>
                <Text className="text-sm" style={{ color: C.textMuted }}>Gestion de l'équipe</Text>
              </View>
              <Pressable onPress={() => setShowTeamModal(false)} className="p-2">
                <X size={24} color={C.textMuted} />
              </Pressable>
            </View>

            {ctx.canPerformAction('canInviteUsers') && (
              <Pressable
                onPress={() => setShowInviteModal(true)}
                className="flex-row items-center justify-center py-3 rounded-xl mb-4"
                style={{ backgroundColor: C.emeraldLight, borderWidth: 2, borderColor: C.emeraldDark }}
              >
                <UserPlus size={20} color={C.emeraldDark} />
                <Text className="ml-2 font-semibold" style={{ color: C.emeraldDark }}>Invite Team Member</Text>
              </Pressable>
            )}

            <ScrollView style={{ maxHeight: 400 }}>
              {isLoadingTeam ? (
                <ActivityIndicator color={C.emeraldDark} style={{ marginVertical: 20 }} />
              ) : teamMembers.length === 0 ? (
                <View className="py-8 items-center">
                  <Users size={40} color={C.textMuted} />
                  <Text className="mt-2 text-center" style={{ color: C.textMuted }}>No team members yet</Text>
                </View>
              ) : (
                teamMembers.map((member) => (
                  <View key={member.id} className="flex-row items-center py-3 border-b" style={{ borderBottomColor: C.borderLight }}>
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{
                      backgroundColor: member.role === 'owner' ? '#FEF3C7' : member.role === 'supervisor' ? '#DBEAFE' : '#F3F4F6',
                    }}>
                      {member.role === 'owner' ? <Crown size={20} color="#D97706" /> :
                       member.role === 'supervisor' ? <Shield size={20} color="#2563EB" /> :
                       <Eye size={20} color="#6B7280" />}
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: C.textPrimary }}>{member.name || member.email}</Text>
                      <Text className="text-sm" style={{ color: C.textMuted }}>{member.email}</Text>
                      <Text className="text-xs mt-0.5 font-medium" style={{
                        color: member.role === 'owner' ? '#D97706' : member.role === 'supervisor' ? '#2563EB' : '#6B7280',
                      }}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Text>
                    </View>
                    {ctx.canPerformAction('canInviteUsers') && member.id !== ctx.currentManager?.id && member.role !== 'owner' && (
                      <Pressable onPress={() => ctx.handleRemoveUser(member.id, member.name)} className="p-2">
                        <Trash2 size={18} color={C.error} />
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => setShowInviteModal(false)}>
        <View className="flex-1 justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <View className="bg-white rounded-2xl p-6" style={{ ...D.shadow.lg }}>
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xl font-bold" style={{ color: C.textPrimary }}>Invite Team Member</Text>
                <Text className="text-sm" style={{ color: C.textMuted }}>Inviter un membre</Text>
              </View>
              <Pressable onPress={() => setShowInviteModal(false)} className="p-2">
                <X size={24} color={C.textMuted} />
              </Pressable>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>Email *</Text>
              <View className="flex-row items-center rounded-xl px-4" style={{ backgroundColor: '#f8fafc', borderWidth: 2, borderColor: C.borderLight }}>
                <Mail size={16} color={C.textMuted} />
                <TextInput
                  value={inviteEmail} onChangeText={setInviteEmail}
                  placeholder="user@example.com" placeholderTextColor={C.textMuted}
                  keyboardType="email-address" autoCapitalize="none"
                  className="flex-1 py-3 px-3" style={{ color: C.textPrimary }}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>Name (Optional)</Text>
              <TextInput
                value={inviteName} onChangeText={setInviteName}
                placeholder="John Doe" placeholderTextColor={C.textMuted}
                className="py-3 px-4 rounded-xl"
                style={{ backgroundColor: '#f8fafc', borderWidth: 2, borderColor: C.borderLight, color: C.textPrimary }}
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-semibold mb-2" style={{ color: C.textPrimary }}>Role</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setInviteRole('supervisor')}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: inviteRole === 'supervisor' ? '#DBEAFE' : '#f8fafc',
                    borderWidth: 2, borderColor: inviteRole === 'supervisor' ? '#2563EB' : C.borderLight,
                  }}
                >
                  <Shield size={18} color={inviteRole === 'supervisor' ? '#2563EB' : C.textMuted} />
                  <Text className="mt-1 font-medium text-xs" style={{ color: inviteRole === 'supervisor' ? '#2563EB' : C.textMuted }}>Supervisor</Text>
                </Pressable>
                <Pressable
                  onPress={() => setInviteRole('viewer')}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: inviteRole === 'viewer' ? '#F3F4F6' : '#f8fafc',
                    borderWidth: 2, borderColor: inviteRole === 'viewer' ? '#6B7280' : C.borderLight,
                  }}
                >
                  <Eye size={18} color={inviteRole === 'viewer' ? '#6B7280' : C.textMuted} />
                  <Text className="mt-1 font-medium text-xs" style={{ color: inviteRole === 'viewer' ? '#6B7280' : C.textMuted }}>Viewer</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleInvite} disabled={isInviting || !inviteEmail.trim()}
              className="py-4 rounded-xl items-center"
              style={{ backgroundColor: isInviting || !inviteEmail.trim() ? C.textMuted : C.actionGreen }}
            >
              {isInviting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Send Invite</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onSelect={handleTimeSelect}
        initialTime={timePickerInitial}
        title={timePickerField === 'start' ? 'Start Time' : 'End Time'}
        titleFr={timePickerField === 'start' ? 'Heure de début' : 'Heure de fin'}
      />
    </>
  );
}
