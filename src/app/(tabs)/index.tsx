import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Mail, Shield, Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness, BusinessRow } from '@/lib/supabase';
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
  error: '#dc2626',
  errorBg: '#fef2f2',
  glass: 'rgba(255, 255, 255, 0.95)',
  glassBorder: 'rgba(5, 150, 105, 0.15)',
  inputBg: '#f1f5f9',
  inputBorder: '#e2e8f0',
};

export default function BusinessPortalScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const storedBusiness = await AsyncStorage.getItem('currentBusiness');
      const storedAdmin = await AsyncStorage.getItem('adminSession');

      if (storedAdmin) {
        // Admin is logged in, redirect to admin view
        router.replace('/admin');
        return;
      }

      if (storedBusiness) {
        // Business owner is logged in, redirect to manager
        router.replace('/manager');
        return;
      }
    } catch (err) {
      console.log('[Login] Session check error:', err);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginBusiness(email.trim(), password);

      if (result.success && result.data) {
        // Store business session
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));

        // Navigate to manager dashboard
        router.replace('/manager');
      } else {
        setError(result.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminAccess = () => {
    router.push('/admin-login');
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundGradient, COLORS.background]}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.backgroundGradient, COLORS.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 justify-center px-6">
            {/* Logo / Branding */}
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              className="items-center mb-8"
            >
              <AcadiaLogo size={120} />
              <View className="flex-row items-center mt-2">
                <Sparkles size={14} color={COLORS.primary} />
                <Text
                  className="text-sm font-semibold ml-1.5 tracking-wide"
                  style={{ color: COLORS.primary }}
                >
                  PARTNER PORTAL
                </Text>
              </View>
            </Animated.View>

            {/* Login Card */}
            <Animated.View
              entering={FadeInDown.delay(150).duration(600).springify()}
              className="rounded-3xl p-6"
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
              <Text
                className="text-xl font-bold mb-0.5 text-center"
                style={{ color: COLORS.textDark }}
              >
                Business Login
              </Text>
              <Text
                className="text-sm mb-1 text-center"
                style={{ color: COLORS.textMuted }}
              >
                Connexion Entreprise
              </Text>
              <Text
                className="text-xs mb-5 text-center"
                style={{ color: COLORS.textLight }}
              >
                Sign in to manage your locations / Connectez-vous pour gérer vos emplacements
              </Text>

              {/* Email Input */}
              <View className="mb-4">
                <Text
                  className="text-sm font-semibold mb-1"
                  style={{ color: COLORS.textDark }}
                >
                  Email Address
                </Text>
                <Text
                  className="text-xs mb-2"
                  style={{ color: COLORS.textMuted }}
                >
                  Adresse courriel
                </Text>
                <View
                  className="flex-row items-center rounded-xl px-4"
                  style={{
                    backgroundColor: COLORS.inputBg,
                    borderWidth: 1.5,
                    borderColor: error ? COLORS.error : COLORS.inputBorder,
                  }}
                >
                  <Mail size={20} color={COLORS.textLight} />
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (error) setError(null);
                    }}
                    placeholder="your@business.com"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 py-4 px-3"
                    style={{ fontSize: 16, color: COLORS.textDark }}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-5">
                <Text
                  className="text-sm font-semibold mb-1"
                  style={{ color: COLORS.textDark }}
                >
                  Password
                </Text>
                <Text
                  className="text-xs mb-2"
                  style={{ color: COLORS.textMuted }}
                >
                  Mot de passe
                </Text>
                <View
                  className="flex-row items-center rounded-xl px-4"
                  style={{
                    backgroundColor: COLORS.inputBg,
                    borderWidth: 1.5,
                    borderColor: error ? COLORS.error : COLORS.inputBorder,
                  }}
                >
                  <Lock size={20} color={COLORS.textLight} />
                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.textLight}
                    secureTextEntry
                    className="flex-1 py-4 px-3"
                    style={{ fontSize: 16, color: COLORS.textDark }}
                  />
                </View>
              </View>

              {/* Error Message */}
              {error && (
                <View
                  className="mb-4 p-3 rounded-xl"
                  style={{ backgroundColor: COLORS.errorBg }}
                >
                  <Text
                    className="text-sm text-center font-medium"
                    style={{ color: COLORS.error }}
                  >
                    {error}
                  </Text>
                </View>
              )}

              {/* Login Button */}
              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                className="rounded-xl py-4 items-center active:opacity-80"
                style={{
                  backgroundColor: isLoading ? COLORS.textMuted : COLORS.primary,
                  shadowColor: COLORS.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isLoading ? 0 : 0.25,
                  shadowRadius: 8,
                  elevation: isLoading ? 0 : 4,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View className="items-center">
                    <Text className="text-lg font-bold" style={{ color: COLORS.white }}>
                      Sign In
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Se connecter
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>

            {/* Admin Access */}
            <Animated.View
              entering={FadeIn.delay(400).duration(600)}
              className="mt-8 items-center"
            >
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px" style={{ backgroundColor: COLORS.inputBorder }} />
                <View className="mx-4 items-center">
                  <Text className="text-xs font-medium" style={{ color: COLORS.textLight }}>
                    ADMINISTRATOR
                  </Text>
                  <Text className="text-[10px]" style={{ color: COLORS.textLight }}>
                    ADMINISTRATEUR
                  </Text>
                </View>
                <View className="flex-1 h-px" style={{ backgroundColor: COLORS.inputBorder }} />
              </View>

              <Pressable
                onPress={handleAdminAccess}
                className="flex-row items-center py-3 px-5 rounded-full active:opacity-70"
                style={{
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(5, 150, 105, 0.15)',
                }}
              >
                <Shield size={16} color={COLORS.primary} />
                <View className="ml-2">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: COLORS.primaryDark }}
                  >
                    Admin Access
                  </Text>
                  <Text
                    className="text-[10px]"
                    style={{ color: COLORS.textMuted }}
                  >
                    Accès administrateur
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Footer Branding */}
            <Animated.View
              entering={FadeIn.delay(500).duration(600)}
              className="mt-10 items-center"
            >
              <Text className="text-xs" style={{ color: COLORS.textLight }}>
                Powered by Acadia Clean Solutions
              </Text>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
