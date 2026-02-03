import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  MapPin,
  SprayCan,
  Brush,
  Droplets,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  ChevronLeft,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import {
  getLogsForLocation as getSupabaseLogs,
  rowToCleaningLog,
  CleaningLogRow,
} from '@/lib/supabase';

// Mint & Emerald color palette
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
};

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// Timeline icons for cleaning tasks
const TIMELINE_ITEMS = [
  { icon: SprayCan, label: 'Surfaces Sanitized', time: '' },
  { icon: Brush, label: 'Floor Cleaned', time: '' },
  { icon: Droplets, label: 'Supplies Restocked', time: '' },
];

export default function PublicCleaningLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseLogs, setSupabaseLogs] = useState<CleaningLogRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const currentLocationRef = useRef<string | null>(null);
  const location = useStore((s) => s.getLocationById(id ?? ''));

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

  // Fetch logs from Supabase
  useEffect(() => {
    if (currentLocationRef.current !== id) {
      setSupabaseLogs([]);
      setLoadError(null);
      currentLocationRef.current = id ?? null;
    }

    async function fetchLogs() {
      if (!id) return;
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await getSupabaseLogs(id);
        if (currentLocationRef.current !== id) return;

        if (result.success && result.data) {
          setSupabaseLogs(result.data);
        } else {
          setLoadError(result.error ?? 'Failed to load cleaning records');
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
    fetchLogs();
  }, [id]);

  const handleRetryLoad = () => {
    setLoadError(null);
    setIsLoading(true);
    getSupabaseLogs(id ?? '')
      .then((result) => {
        if (result.success && result.data) {
          setSupabaseLogs(result.data);
          setLoadError(null);
        } else {
          setLoadError(result.error ?? 'Failed to load cleaning records');
        }
        setIsLoading(false);
      })
      .catch(() => {
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTimeSince = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!location) {
    return (
      <LinearGradient
        colors={[COLORS.mintWhite, COLORS.mintLight, COLORS.mintMedium]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-2xl font-bold text-center" style={{ color: COLORS.textDark }}>
              Location Not Found
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
            <>
              {/* Main Status Card - Glass Effect */}
              <Animated.View
                entering={FadeInDown.duration(600).springify()}
                className="rounded-3xl overflow-hidden mb-6"
                style={{
                  backgroundColor: COLORS.glass,
                  borderWidth: 1,
                  borderColor: COLORS.glassBorder,
                  shadowColor: COLORS.emerald,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 8,
                }}
              >
                {/* Status Header */}
                <View className="px-6 pt-8 pb-6 items-center">
                  {/* Sparkle Icon with Animation */}
                  <Animated.View style={animatedSparkleStyle} className="mb-4">
                    <View
                      className="w-24 h-24 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: isClean
                          ? COLORS.mintLight
                          : needsAttention
                          ? COLORS.amberLight
                          : COLORS.mintLight,
                      }}
                    >
                      {isClean ? (
                        <Sparkles size={48} color={COLORS.emerald} strokeWidth={1.5} />
                      ) : needsAttention ? (
                        <AlertTriangle size={48} color={COLORS.amber} strokeWidth={1.5} />
                      ) : (
                        <Clock size={48} color={COLORS.textMuted} strokeWidth={1.5} />
                      )}
                    </View>
                  </Animated.View>

                  {/* Status Text */}
                  <Text
                    className="text-sm font-semibold uppercase tracking-widest mb-2"
                    style={{ color: COLORS.textMuted }}
                  >
                    Status
                  </Text>
                  <Text
                    className="text-3xl font-bold text-center"
                    style={{
                      color: isClean
                        ? COLORS.emeraldDark
                        : needsAttention
                        ? COLORS.amber
                        : COLORS.textDark,
                    }}
                  >
                    {isClean
                      ? 'Sparkling Clean'
                      : needsAttention
                      ? 'Attention Required'
                      : 'Awaiting Inspection'}
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
              </Animated.View>

              {/* Timeline Cards */}
              {lastLog && isClean && (
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest mb-3 ml-1"
                    style={{ color: COLORS.textMuted }}
                  >
                    Cleaning Timeline
                  </Text>

                  <View className="space-y-3">
                    {TIMELINE_ITEMS.map((item, index) => {
                      const Icon = item.icon;
                      const isCompleted = true; // All items completed for "clean" status
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
                                className="w-0.5 h-6 mt-2"
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
                    Recent History
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
                            {formatDate(log.timestamp)} • {log.staffName || 'Staff'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Footer */}
              <Animated.View
                entering={FadeIn.delay(800).duration(600)}
                className="items-center mt-8 mb-4"
              >
                <View
                  className="flex-row items-center px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
                >
                  <Sparkles size={14} color={COLORS.emerald} />
                  <Text
                    className="text-xs font-medium ml-1.5"
                    style={{ color: COLORS.emeraldDark }}
                  >
                    Acadia Clean Compliance
                  </Text>
                </View>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
