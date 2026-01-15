import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { QrCode, Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { AcadiaLogo } from '@/components/AcadiaLogo';

// Professional color palette
const COLORS = {
  primary: '#059669', // Emerald green
  primaryLight: '#d1fae5',
  primaryDark: '#047857',
  background: '#f8fafc',
  backgroundGradient: '#f0fdf4',
  white: '#ffffff',
  textDark: '#0f172a',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  glass: 'rgba(255, 255, 255, 0.95)',
  glassBorder: 'rgba(5, 150, 105, 0.15)',
};

export default function PublicLandingScreen() {
  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.backgroundGradient, COLORS.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 justify-center px-8">
          {/* Logo / Branding */}
          <Animated.View
            entering={FadeInDown.duration(600).springify()}
            className="items-center mb-10"
          >
            <AcadiaLogo size={140} />
            <View className="flex-row items-center mt-3">
              <Sparkles size={16} color={COLORS.primary} />
              <Text
                className="text-base font-bold ml-2 tracking-widest"
                style={{ color: COLORS.primary }}
              >
                CLEANIQ
              </Text>
            </View>
          </Animated.View>

          {/* Main Message Card */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(600).springify()}
            className="rounded-3xl p-8 items-center"
            style={{
              backgroundColor: COLORS.glass,
              borderWidth: 1,
              borderColor: COLORS.glassBorder,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {/* QR Icon */}
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: COLORS.primaryLight }}
            >
              <QrCode size={40} color={COLORS.primary} />
            </View>

            {/* Main Text */}
            <Text
              className="text-xl font-bold text-center mb-2"
              style={{ color: COLORS.textDark }}
            >
              Scan a QR Code
            </Text>
            <Text
              className="text-base text-center mb-4"
              style={{ color: COLORS.textMuted }}
            >
              Numérisez un code QR
            </Text>

            {/* Description */}
            <Text
              className="text-sm text-center leading-6"
              style={{ color: COLORS.textMuted }}
            >
              Look for a QR code in any washroom to view cleaning records and verification logs.
            </Text>
            <Text
              className="text-xs text-center mt-2 leading-5"
              style={{ color: COLORS.textLight }}
            >
              Recherchez un code QR dans les toilettes pour consulter les registres de nettoyage.
            </Text>
          </Animated.View>

          {/* Trust Badge */}
          <Animated.View
            entering={FadeIn.delay(400).duration(600)}
            className="mt-10 items-center"
          >
            <View
              className="flex-row items-center py-3 px-5 rounded-full"
              style={{
                backgroundColor: 'rgba(5, 150, 105, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(5, 150, 105, 0.12)',
              }}
            >
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: COLORS.primary }}
              />
              <Text
                className="text-xs font-medium"
                style={{ color: COLORS.primaryDark }}
              >
                Verified Cleaning Records
              </Text>
            </View>
          </Animated.View>

          {/* Footer Branding */}
          <Animated.View
            entering={FadeIn.delay(500).duration(600)}
            className="mt-12 items-center"
          >
            <Text className="text-xs" style={{ color: COLORS.textLight }}>
              Powered by Acadia Clean Solutions
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
