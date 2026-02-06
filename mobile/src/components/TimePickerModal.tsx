import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';
import { X, Clock, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';
import { parseTimeString, formatTimeString } from '@/lib/timezone';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  initialTime?: string;
  title?: string;
  titleFr?: string;
}

export function TimePickerModal({
  visible,
  onClose,
  onSelect,
  initialTime = '08:00',
  title = 'Select Time',
  titleFr = 'Sélectionner l\'heure',
}: TimePickerModalProps) {
  const parsed = parseTimeString(initialTime);
  const [selectedHour, setSelectedHour] = useState(parsed.hours);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minutes);

  useEffect(() => {
    if (visible) {
      const p = parseTimeString(initialTime);
      setSelectedHour(p.hours);
      setSelectedMinute(p.minutes);
    }
  }, [visible, initialTime]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const handleConfirm = () => {
    onSelect(formatTimeString(selectedHour, selectedMinute));
    onClose();
  };

  const formatHour = (h: number) => {
    if (h === 0) return '12:00 AM';
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
  };

  const formatDisplay = () => {
    const h = selectedHour;
    const m = selectedMinute.toString().padStart(2, '0');
    if (h === 0) return `12:${m} AM`;
    if (h < 12) return `${h}:${m} AM`;
    if (h === 12) return `12:${m} PM`;
    return `${h - 12}:${m} PM`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: C.mintBackground }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: C.borderLight }}
        >
          <Pressable onPress={onClose} className="p-2 -ml-2">
            <X size={24} color={C.textMuted} />
          </Pressable>
          <View className="items-center">
            <Text className="text-lg font-bold" style={{ color: C.textPrimary }}>{title}</Text>
            <Text className="text-xs" style={{ color: C.textMuted }}>{titleFr}</Text>
          </View>
          <Pressable
            onPress={handleConfirm}
            className="p-2 -mr-2 rounded-lg"
            style={{ backgroundColor: C.actionGreen }}
          >
            <Check size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Selected Time Display */}
        <Animated.View
          entering={FadeIn.duration(300)}
          className="items-center py-6"
          style={{ backgroundColor: C.emeraldLight }}
        >
          <View className="flex-row items-center">
            <Clock size={24} color={C.emeraldDark} />
            <Text className="text-3xl font-bold ml-3" style={{ color: C.emeraldDark }}>
              {formatDisplay()}
            </Text>
          </View>
          <Text className="text-xs mt-1" style={{ color: C.textMuted }}>Atlantic Time (Moncton)</Text>
        </Animated.View>

        {/* Time Picker */}
        <View className="flex-1 flex-row px-4 py-4">
          {/* Hours */}
          <View className="flex-1 mr-2">
            <Text className="text-xs font-semibold mb-2 text-center" style={{ color: C.textMuted }}>
              Hour
            </Text>
            <ScrollView
              className="flex-1 rounded-xl"
              style={{ backgroundColor: C.white, ...D.shadow.sm }}
              showsVerticalScrollIndicator={false}
            >
              {hours.map(hour => (
                <Pressable
                  key={hour}
                  onPress={() => setSelectedHour(hour)}
                  className="py-3 px-4 items-center"
                  style={{
                    backgroundColor: selectedHour === hour ? C.emeraldLight : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: C.borderLight,
                  }}
                >
                  <Text
                    className="text-base font-medium"
                    style={{ color: selectedHour === hour ? C.emeraldDark : C.textPrimary }}
                  >
                    {formatHour(hour)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Minutes */}
          <View className="flex-1 ml-2">
            <Text className="text-xs font-semibold mb-2 text-center" style={{ color: C.textMuted }}>
              Minute
            </Text>
            <View
              className="flex-1 rounded-xl"
              style={{ backgroundColor: C.white, ...D.shadow.sm }}
            >
              {minutes.map(minute => (
                <Pressable
                  key={minute}
                  onPress={() => setSelectedMinute(minute)}
                  className="flex-1 items-center justify-center"
                  style={{
                    backgroundColor: selectedMinute === minute ? C.emeraldLight : 'transparent',
                    borderBottomWidth: minute < 45 ? 1 : 0,
                    borderBottomColor: C.borderLight,
                  }}
                >
                  <Text
                    className="text-xl font-bold"
                    style={{ color: selectedMinute === minute ? C.emeraldDark : C.textPrimary }}
                  >
                    :{minute.toString().padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Select */}
        <View className="px-4 pb-4">
          <Text className="text-xs font-semibold mb-2" style={{ color: C.textMuted }}>
            Quick Select / Sélection rapide
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { label: '6:00 AM', h: 6, m: 0 },
              { label: '8:00 AM', h: 8, m: 0 },
              { label: '9:00 AM', h: 9, m: 0 },
              { label: '12:00 PM', h: 12, m: 0 },
              { label: '5:00 PM', h: 17, m: 0 },
              { label: '6:00 PM', h: 18, m: 0 },
              { label: '9:00 PM', h: 21, m: 0 },
              { label: '10:00 PM', h: 22, m: 0 },
            ].map(opt => (
              <Pressable
                key={opt.label}
                onPress={() => {
                  setSelectedHour(opt.h);
                  setSelectedMinute(opt.m);
                }}
                className="px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: selectedHour === opt.h && selectedMinute === opt.m
                    ? C.emeraldLight
                    : '#f1f5f9',
                  borderWidth: selectedHour === opt.h && selectedMinute === opt.m ? 1 : 0,
                  borderColor: C.emeraldDark,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{
                    color: selectedHour === opt.h && selectedMinute === opt.m
                      ? C.emeraldDark
                      : C.textPrimary,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
