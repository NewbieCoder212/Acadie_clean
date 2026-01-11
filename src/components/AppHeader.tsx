import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AcadiaLogo } from './AcadiaLogo';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

interface AppHeaderProps {
  /** Show back button */
  showBack?: boolean;
  /** Title displayed below logo */
  title?: string;
  /** French subtitle */
  subtitle?: string;
  /** Size of the logo */
  logoSize?: number;
  /** Compact mode for inner pages */
  compact?: boolean;
  /** Custom back handler */
  onBack?: () => void;
  /** Right side action */
  rightAction?: React.ReactNode;
}

export function AppHeader({
  showBack = false,
  title,
  subtitle,
  logoSize = 80,
  compact = false,
  onBack,
  rightAction,
}: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient
      colors={[C.mintGradientStart, C.mintGradientEnd]}
      style={{
        paddingBottom: compact ? 12 : 20,
      }}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <SafeAreaView edges={['top']}>
        {/* Navigation Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 8,
            minHeight: 44,
          }}
        >
          {showBack ? (
            <Pressable
              onPress={handleBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingRight: 12,
              }}
            >
              <ChevronLeft size={24} color={C.emeraldDark} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: C.emeraldDark }}>
                  Back
                </Text>
                <Text style={{ fontSize: 10, color: C.textMuted }}>
                  Retour
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}

          {/* Center - Logo */}
          <AcadiaLogo size={compact ? 50 : logoSize} showText={!compact} />

          {/* Right Action */}
          {rightAction ? rightAction : <View style={{ width: 60 }} />}
        </View>

        {/* Title Row */}
        {title && (
          <View style={{ alignItems: 'center', marginTop: compact ? 8 : 12 }}>
            <Text
              style={{
                fontSize: compact ? 16 : 20,
                fontWeight: '700',
                color: C.textPrimary,
                letterSpacing: 0.3,
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={{
                  fontSize: compact ? 11 : 13,
                  color: C.textMuted,
                  marginTop: 2,
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// Simplified header for pages that don't need full header
export function SimpleHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}: Omit<AppHeaderProps, 'logoSize' | 'compact'>) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        backgroundColor: C.emeraldDark,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {showBack ? (
            <Pressable
              onPress={handleBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 4,
                marginLeft: -8,
              }}
            >
              <ChevronLeft size={22} color={C.white} />
              <Text style={{ fontSize: 14, fontWeight: '500', color: C.white }}>
                Back / Retour
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: C.white,
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                {subtitle}
              </Text>
            )}
          </View>

          {rightAction ? rightAction : <View style={{ width: 80 }} />}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default AppHeader;
