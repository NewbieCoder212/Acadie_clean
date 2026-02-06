import { useState, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2, AlertOctagon, MapPin, Clock, Download, X,
  Calendar, ClipboardList, History,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useManagerContext, CleaningLogRow, ReportedIssueRow, ResolutionAction, RESOLUTION_ACTIONS } from './ManagerContext';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

export function ManagerActivityTab() {
  const ctx = useManagerContext();

  // Sub-tab: 'logs' or 'issues'
  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'issues'>('logs');

  // Show resolved issues section
  const [showResolvedIssues, setShowResolvedIssues] = useState(false);

  // 14 Days modal
  const [show14DaysModal, setShow14DaysModal] = useState(false);
  const [fourteenDaysLogs, setFourteenDaysLogs] = useState<CleaningLogRow[]>([]);
  const [viewing14DaysLocationName, setViewing14DaysLocationName] = useState('');
  const [isLoading14Days, setIsLoading14Days] = useState(false);

  // Resolution modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ReportedIssueRow | null>(null);

  // Incident export
  const [showIncidentExport, setShowIncidentExport] = useState(false);
  const [incidentStartDate, setIncidentStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [incidentEndDate, setIncidentEndDate] = useState<Date>(new Date());
  const [includeOpenIncidents, setIncludeOpenIncidents] = useState(true);
  const [isExportingIncidents, setIsExportingIncidents] = useState(false);

  const handleView14Days = async (locationId: string) => {
    setIsLoading14Days(true);
    setShow14DaysModal(true);
    const result = await ctx.handleView14Days(locationId);
    setFourteenDaysLogs(result.logs);
    setViewing14DaysLocationName(result.locationName);
    setIsLoading14Days(false);
  };

  const handleExportIncidents = async () => {
    setIsExportingIncidents(true);
    try {
      await ctx.handleExportIncidentReports(incidentStartDate, incidentEndDate, includeOpenIncidents);
    } catch (e) {
      // handled in context
    }
    setIsExportingIncidents(false);
    setShowIncidentExport(false);
  };

  const handleOpenResolveModal = (issue: ReportedIssueRow) => {
    setSelectedIssue(issue);
    setShowResolveModal(true);
  };

  const handleSelectResolution = async (action: ResolutionAction) => {
    if (!selectedIssue) return;
    setShowResolveModal(false);
    await ctx.handleResolveIssue(selectedIssue.id, action, selectedIssue);
    setSelectedIssue(null);
  };

  const issueTypeLabels: Record<string, string> = {
    out_of_supplies: 'Out of Supplies',
    needs_cleaning: 'Needs Cleaning',
    maintenance_required: 'Maintenance Required',
    safety_concern: 'Safety Concern',
    other: 'Other',
  };

  const issueTypeLabelsFr: Record<string, string> = {
    out_of_supplies: 'Rupture de stock',
    needs_cleaning: 'Nécessite un nettoyage',
    maintenance_required: 'Entretien requis',
    safety_concern: 'Problème de sécurité',
    other: 'Autre',
  };

  // Get resolution options for the selected issue
  const resolutionOptions = selectedIssue
    ? RESOLUTION_ACTIONS[selectedIssue.issue_type] || RESOLUTION_ACTIONS['other']
    : [];

  // Resolved issues from the last 30 days
  const resolvedIssues30Days = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return ctx.reportedIssues
      .filter(issue => {
        if (issue.status !== 'resolved') return false;
        const resolvedAt = issue.resolved_at ? new Date(issue.resolved_at) : null;
        return resolvedAt && resolvedAt >= thirtyDaysAgo;
      })
      .sort((a, b) => {
        const dateA = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
        const dateB = b.resolved_at ? new Date(b.resolved_at).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
  }, [ctx.reportedIssues]);

  return (
    <>
      <View className="flex-1">
        {/* Sub-tab toggle */}
        <View className="flex-row mx-4 mt-3 mb-2 p-1 rounded-xl" style={{ backgroundColor: '#f1f5f9' }}>
          <Pressable
            onPress={() => setActiveSubTab('logs')}
            className="flex-1 py-2.5 rounded-lg items-center"
            style={{ backgroundColor: activeSubTab === 'logs' ? C.white : 'transparent', ...(activeSubTab === 'logs' ? D.shadow.sm : {}) }}
          >
            <Text className="text-sm font-semibold" style={{ color: activeSubTab === 'logs' ? C.emeraldDark : C.textMuted }}>
              Cleaning Logs
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSubTab('issues')}
            className="flex-1 py-2.5 rounded-lg items-center flex-row justify-center"
            style={{ backgroundColor: activeSubTab === 'issues' ? C.white : 'transparent', ...(activeSubTab === 'issues' ? D.shadow.sm : {}) }}
          >
            <Text className="text-sm font-semibold" style={{ color: activeSubTab === 'issues' ? C.emeraldDark : C.textMuted }}>
              Issues
            </Text>
            {ctx.openIssues.length > 0 && (
              <View className="ml-1.5 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.error }}>
                <Text className="text-[10px] font-bold text-white">{ctx.openIssues.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Logs View */}
        {activeSubTab === 'logs' && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {ctx.isLoadingLogs ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={C.actionGreen} />
                <Text className="text-sm mt-3" style={{ color: C.textMuted }}>Loading logs...</Text>
              </View>
            ) : ctx.recentLogs.length === 0 ? (
              <Animated.View entering={FadeIn.duration(400)} className="rounded-xl p-8 items-center mt-2" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
                <ClipboardList size={40} color={C.textMuted} />
                <Text className="text-sm font-medium mt-3" style={{ color: C.textMuted }}>No cleaning logs yet</Text>
                <Text className="text-xs mt-1" style={{ color: C.textMuted }}>Aucun journal de nettoyage</Text>
              </Animated.View>
            ) : (
              <View className="mt-2">
                {ctx.recentLogs.map((log, index) => {
                  const isCompliant = log.status === 'complete';

                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => handleView14Days(log.location_id)}
                      className="rounded-xl mb-3 p-4 active:opacity-80"
                      style={{
                        backgroundColor: C.white,
                        borderWidth: 1.5,
                        borderColor: isCompliant ? '#86efac' : '#fcd34d',
                        borderLeftWidth: 5,
                        borderLeftColor: isCompliant ? C.actionGreen : C.warning,
                        ...D.shadow.sm,
                      }}
                    >
                      {/* Top row: Location name + Status badge */}
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-base font-bold flex-1 mr-3" style={{ color: C.textPrimary }} numberOfLines={1}>
                          {log.location_name}
                        </Text>
                        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: isCompliant ? C.actionGreen : C.warning }}>
                          <Text className="text-xs font-bold text-white">
                            {isCompliant ? 'COMPLIANT' : 'ATTENTION'}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom row: Staff + Date/Time */}
                      <View className="flex-row items-center justify-between mt-1">
                        <View className="flex-row items-center">
                          <View className="w-6 h-6 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#f1f5f9' }}>
                            <Text className="text-[10px] font-bold" style={{ color: C.textMuted }}>
                              {log.staff_name?.charAt(0)?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                          <Text className="text-sm font-medium" style={{ color: C.textPrimary }} numberOfLines={1}>
                            {log.staff_name}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Clock size={12} color={C.textMuted} />
                          <Text className="text-xs ml-1" style={{ color: C.textMuted }}>
                            {ctx.formatDateTime(log.timestamp)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Issues View */}
        {activeSubTab === 'issues' && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {/* Export button row */}
            <View className="flex-row items-center justify-end mt-1 mb-2">
              <Pressable
                onPress={() => setShowIncidentExport(true)}
                className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-80"
                style={{ backgroundColor: C.emeraldLight }}
              >
                <Download size={14} color={C.emeraldDark} />
                <Text className="text-xs font-semibold ml-1" style={{ color: C.emeraldDark }}>Export</Text>
              </Pressable>
            </View>

            {ctx.openIssues.length === 0 ? (
              <Animated.View entering={FadeIn.duration(400)} className="rounded-xl p-8 items-center" style={{ backgroundColor: C.successBg, borderWidth: 1, borderColor: C.borderLight }}>
                <CheckCircle2 size={32} color={C.actionGreen} />
                <Text className="text-sm font-medium mt-3" style={{ color: C.actionGreen }}>No Open Issues</Text>
                <Text className="text-xs mt-1" style={{ color: C.textMuted }}>Aucun problème signalé</Text>
              </Animated.View>
            ) : (
              <View className="rounded-xl overflow-hidden" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.error, ...D.shadow.sm }}>
                {ctx.openIssues.map((issue, index) => (
                  <Animated.View
                    key={issue.id}
                    entering={FadeInDown.delay(index * 60).duration(400)}
                    className="p-4"
                    style={{
                      borderBottomWidth: index < ctx.openIssues.length - 1 ? 1 : 0,
                      borderBottomColor: C.borderLight,
                      backgroundColor: '#fef2f2',
                    }}
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-row items-center flex-1">
                        <AlertOctagon size={16} color={C.error} />
                        <Text className="text-sm font-bold ml-2" style={{ color: C.error }} numberOfLines={1}>
                          {issueTypeLabels[issue.issue_type] || issue.issue_type}
                        </Text>
                      </View>
                      <Text className="text-[10px]" style={{ color: C.textMuted }}>
                        {ctx.formatTimeAgo(issue.created_at)}
                      </Text>
                    </View>

                    <Text className="text-[10px] mb-1" style={{ color: C.textMuted }}>
                      {issueTypeLabelsFr[issue.issue_type] || issue.issue_type}
                    </Text>

                    <View className="flex-row items-center mb-2">
                      <MapPin size={12} color={C.textMuted} />
                      <Text className="text-xs ml-1" style={{ color: C.textPrimary }}>{issue.location_name}</Text>
                    </View>

                    {issue.description && (
                      <Text className="text-xs mb-3 p-2 rounded-lg" style={{ backgroundColor: C.white, color: C.textPrimary }}>
                        "{issue.description}"
                      </Text>
                    )}

                    <Pressable
                      onPress={() => handleOpenResolveModal(issue)}
                      disabled={ctx.resolvingIssueId === issue.id}
                      className="flex-row items-center justify-center py-2.5 rounded-lg active:opacity-80"
                      style={{ backgroundColor: C.actionGreen }}
                    >
                      {ctx.resolvingIssueId === issue.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color="#fff" />
                          <Text className="text-sm font-bold text-white ml-2">Resolve / Résoudre</Text>
                        </>
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Resolved Issues Section - Past 30 Days */}
            <View className="mt-4">
              <Pressable
                onPress={() => setShowResolvedIssues(!showResolvedIssues)}
                className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-2"
                style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac' }}
              >
                <View className="flex-row items-center">
                  <History size={16} color={C.actionGreen} />
                  <Text className="text-sm font-semibold ml-2" style={{ color: C.emeraldDark }}>
                    Resolved Issues (30 Days)
                  </Text>
                  <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: C.actionGreen }}>
                    <Text className="text-[10px] font-bold text-white">{resolvedIssues30Days.length}</Text>
                  </View>
                </View>
                <Text className="text-xs" style={{ color: C.textMuted }}>
                  {showResolvedIssues ? 'Hide' : 'Show'}
                </Text>
              </Pressable>

              {showResolvedIssues && (
                <Animated.View entering={FadeIn.duration(300)}>
                  {resolvedIssues30Days.length === 0 ? (
                    <View className="rounded-xl p-6 items-center" style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: C.borderLight }}>
                      <Text className="text-sm" style={{ color: C.textMuted }}>No resolved issues in the past 30 days</Text>
                      <Text className="text-xs mt-1" style={{ color: C.textMuted }}>Aucun problème résolu au cours des 30 derniers jours</Text>
                    </View>
                  ) : (
                    <View className="rounded-xl overflow-hidden" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: '#86efac' }}>
                      {resolvedIssues30Days.map((issue, index) => (
                        <View
                          key={issue.id}
                          className="p-3"
                          style={{
                            borderBottomWidth: index < resolvedIssues30Days.length - 1 ? 1 : 0,
                            borderBottomColor: C.borderLight,
                            backgroundColor: '#f0fdf4',
                          }}
                        >
                          <View className="flex-row items-start justify-between mb-1">
                            <View className="flex-row items-center flex-1">
                              <CheckCircle2 size={14} color={C.actionGreen} />
                              <Text className="text-sm font-semibold ml-1.5" style={{ color: C.emeraldDark }} numberOfLines={1}>
                                {issueTypeLabels[issue.issue_type] || issue.issue_type}
                              </Text>
                            </View>
                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
                              <Text className="text-[10px] font-semibold" style={{ color: '#166534' }}>RESOLVED</Text>
                            </View>
                          </View>

                          <View className="flex-row items-center mb-1">
                            <MapPin size={10} color={C.textMuted} />
                            <Text className="text-xs ml-1" style={{ color: C.textMuted }}>{issue.location_name}</Text>
                          </View>

                          {issue.resolution_action_label && (
                            <Text className="text-xs mb-1" style={{ color: C.emeraldDark }}>
                              Action: {issue.resolution_action_label}
                            </Text>
                          )}

                          <View className="flex-row items-center justify-between mt-1">
                            <Text className="text-[10px]" style={{ color: C.textMuted }}>
                              {issue.resolved_by ? `By: ${issue.resolved_by}` : ''}
                            </Text>
                            <View className="flex-row items-center">
                              <Clock size={10} color={C.textMuted} />
                              <Text className="text-[10px] ml-1" style={{ color: C.textMuted }}>
                                {issue.resolved_at ? ctx.formatDateTime(issue.resolved_at) : 'Unknown'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </Animated.View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* 14 Days Modal */}
      <Modal visible={show14DaysModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShow14DaysModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>{viewing14DaysLocationName}</Text>
              <Text className="text-sm" style={{ color: C.textMuted }}>Last 14 Days / 14 derniers jours</Text>
            </View>
            <Pressable onPress={() => setShow14DaysModal(false)} className="p-2 rounded-full" style={{ backgroundColor: C.borderLight }}>
              <X size={20} color={C.textMuted} />
            </Pressable>
          </View>

          {isLoading14Days ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={C.actionGreen} />
              <Text className="mt-3 text-sm" style={{ color: C.textMuted }}>Loading logs...</Text>
            </View>
          ) : fourteenDaysLogs.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <ClipboardList size={48} color={C.textMuted} />
              <Text className="text-base font-medium mt-4 text-center" style={{ color: C.textMuted }}>No cleaning logs found</Text>
            </View>
          ) : (
            <ScrollView className="flex-1 px-5 py-4">
              {fourteenDaysLogs.map((log) => (
                <View
                  key={log.id}
                  className="rounded-xl p-4 mb-3"
                  style={{
                    backgroundColor: C.white,
                    borderWidth: 1,
                    borderColor: log.status === 'complete' ? '#86efac' : '#fcd34d',
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold" style={{ color: C.emeraldDark }}>
                      {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: log.status === 'complete' ? '#dcfce7' : '#fef3c7' }}>
                      <Text className="text-xs font-semibold" style={{ color: log.status === 'complete' ? '#166534' : '#92400e' }}>
                        {log.status === 'complete' ? 'Complete' : 'Attention'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm" style={{ color: C.textMuted }}>Staff: {log.staff_name}</Text>
                  {log.status !== 'complete' && log.notes && (
                    <Text className="text-xs mt-2 italic" style={{ color: C.warning }}>Note: {log.notes}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Incident Export Modal */}
      <Modal visible={showIncidentExport} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowIncidentExport(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>Incident Reports</Text>
              <Text className="text-sm" style={{ color: C.textMuted }}>Rapports d'incidents</Text>
            </View>
            <Pressable onPress={() => setShowIncidentExport(false)} className="p-2 rounded-full" style={{ backgroundColor: C.borderLight }}>
              <X size={20} color={C.textMuted} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4">
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
              <Text className="text-sm font-semibold mb-3" style={{ color: C.emeraldDark }}>Select Date Range</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>Start</Text>
                  <input
                    type="date"
                    value={incidentStartDate.toISOString().split('T')[0]}
                    onChange={(e: any) => setIncidentStartDate(new Date(e.target.value))}
                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, color: '#1e293b', fontSize: 14, width: '100%' }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>End</Text>
                  <input
                    type="date"
                    value={incidentEndDate.toISOString().split('T')[0]}
                    onChange={(e: any) => setIncidentEndDate(new Date(e.target.value))}
                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, color: '#1e293b', fontSize: 14, width: '100%' }}
                  />
                </View>
              </View>
            </View>

            {/* Quick Select */}
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
              <Text className="text-xs font-medium mb-3" style={{ color: C.textMuted }}>Quick Select</Text>
              <View className="flex-row flex-wrap gap-2">
                {[{ label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }, { label: '90 Days', days: 90 }, { label: '6 Months', days: 180 }].map(opt => (
                  <Pressable
                    key={opt.days}
                    onPress={() => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - opt.days); setIncidentStartDate(s); setIncidentEndDate(e); }}
                    className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <Text className="text-xs font-medium" style={{ color: C.textPrimary }}>Last {opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Include Open Toggle */}
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: C.textPrimary }}>Include Open Issues</Text>
                  <Text className="text-xs mt-0.5" style={{ color: C.textMuted }}>Inclure les problèmes en cours</Text>
                </View>
                <Switch
                  value={includeOpenIncidents} onValueChange={setIncludeOpenIncidents}
                  trackColor={{ false: '#d1d5db', true: C.emeraldLight }}
                  thumbColor={includeOpenIncidents ? C.actionGreen : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Summary */}
            <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: C.emeraldLight, borderWidth: 1, borderColor: C.borderLight }}>
              <Text className="text-xs font-medium mb-2" style={{ color: C.emeraldDark }}>Report Preview</Text>
              <View className="flex-row gap-4">
                <View className="items-center">
                  <Text className="text-2xl font-bold" style={{ color: C.emeraldDark }}>{ctx.reportedIssues.length}</Text>
                  <Text className="text-xs" style={{ color: C.textMuted }}>Total</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold" style={{ color: C.actionGreen }}>
                    {ctx.reportedIssues.filter(i => i.status === 'resolved').length}
                  </Text>
                  <Text className="text-xs" style={{ color: C.textMuted }}>Resolved</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold" style={{ color: C.warning }}>
                    {ctx.reportedIssues.filter(i => i.status === 'open').length}
                  </Text>
                  <Text className="text-xs" style={{ color: C.textMuted }}>Open</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleExportIncidents} disabled={isExportingIncidents}
              className="flex-row items-center justify-center py-4 rounded-xl mb-4"
              style={{ backgroundColor: isExportingIncidents ? '#94a3b8' : C.actionGreen }}
            >
              {isExportingIncidents ? (
                <><ActivityIndicator size="small" color="#fff" /><Text className="text-white font-bold ml-2">Generating PDF...</Text></>
              ) : (
                <><Download size={20} color="#fff" /><Text className="text-white font-bold ml-2">Export Incident Reports</Text></>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Resolution Action Modal */}
      <Modal
        visible={showResolveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowResolveModal(false);
          setSelectedIssue(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.mintBackground }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: C.emeraldDark }}>
                Resolve Issue
              </Text>
              <Text className="text-sm" style={{ color: C.textMuted }}>
                Résoudre le problème
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setShowResolveModal(false);
                setSelectedIssue(null);
              }}
              className="p-2 rounded-full"
              style={{ backgroundColor: C.borderLight }}
            >
              <X size={20} color={C.textMuted} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4">
            {/* Issue Info Card */}
            {selectedIssue && (
              <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: C.error }}>
                <View className="flex-row items-center mb-2">
                  <AlertOctagon size={18} color={C.error} />
                  <Text className="text-base font-bold ml-2" style={{ color: C.error }}>
                    {issueTypeLabels[selectedIssue.issue_type] || selectedIssue.issue_type}
                  </Text>
                </View>
                <Text className="text-xs mb-2" style={{ color: C.textMuted }}>
                  {issueTypeLabelsFr[selectedIssue.issue_type] || selectedIssue.issue_type}
                </Text>
                <View className="flex-row items-center mb-2">
                  <MapPin size={14} color={C.textMuted} />
                  <Text className="text-sm ml-1.5" style={{ color: C.textPrimary }}>
                    {selectedIssue.location_name}
                  </Text>
                </View>
                {selectedIssue.description && (
                  <Text className="text-sm p-2 rounded-lg mt-1" style={{ backgroundColor: C.white, color: C.textPrimary }}>
                    "{selectedIssue.description}"
                  </Text>
                )}
              </View>
            )}

            {/* Resolution Options */}
            <Text className="text-sm font-semibold mb-1" style={{ color: C.textPrimary }}>
              How was this resolved?
            </Text>
            <Text className="text-xs mb-4" style={{ color: C.textMuted }}>
              Comment cela a-t-il été résolu?
            </Text>

            <View className="gap-3">
              {resolutionOptions.map((action, index) => (
                <Pressable
                  key={action.value}
                  onPress={() => handleSelectResolution(action)}
                  className="rounded-xl p-4 active:opacity-80"
                  style={{
                    backgroundColor: C.white,
                    borderWidth: 1.5,
                    borderColor: action.createsLog ? C.actionGreen : C.borderMedium,
                    ...D.shadow.sm,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold" style={{ color: C.textPrimary }}>
                        {action.label}
                      </Text>
                      <Text className="text-sm mt-0.5" style={{ color: C.textMuted }}>
                        {action.labelFr}
                      </Text>
                    </View>
                    {action.createsLog && (
                      <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
                        <Text className="text-[10px] font-semibold" style={{ color: '#166534' }}>
                          + Log
                        </Text>
                      </View>
                    )}
                  </View>
                  {action.createsLog && action.logNotes && (
                    <Text className="text-xs mt-2 italic" style={{ color: C.actionGreen }}>
                      Creates cleaning log: "{action.logNotes}"
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Info text */}
            <View className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#f1f5f9' }}>
              <Text className="text-xs" style={{ color: C.textMuted }}>
                Options marked with "+ Log" will create a cleaning log entry, updating the location status to CLEAN.
              </Text>
              <Text className="text-xs mt-2" style={{ color: C.textMuted }}>
                Les options avec "+ Log" créent une entrée de nettoyage et mettent le statut à PROPRE.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
