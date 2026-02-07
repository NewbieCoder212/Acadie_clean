import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Mail, Shield, ChevronLeft } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness, BusinessRow } from '@/lib/supabase';

const COLORS = {
  primary: '#7c3aed',
  primaryDark: '#5b21b6',
  background: '#f5f3ff',
  backgroundLight: '#ede9fe',
  white: '#ffffff',
  textDark: '#1e1b4b',
  textMuted: '#6b7280',
  error: '#dc2626',
  glass: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(124, 58, 237, 0.2)',
};

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Check if user is admin
        if (!result.data.is_admin) {
          setError('This account does not have admin access');
          setIsLoading(false);
          return;
        }

        // Store admin session
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));

        // Navigate to admin dashboard
        router.replace('/admin');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.backgroundLight, COLORS.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Back Button */}
        <Pressable
          onPress={() => {
            // Safe navigation - go to main login if no history
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          className="flex-row items-center px-4 py-2 active:opacity-70"
        >
          <ChevronLeft size={24} color={COLORS.primaryDark} />
          <Text className="text-base font-medium" style={{ color: COLORS.primaryDark }}>
            Back / Retour
          </Text>
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 justify-center px-6">
            {/* Logo / Header */}
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              className="items-center mb-10"
            >
              <Image
                source={require('../../assets/image-1767959752.png')}
                style={{ width: 120, height: 120 }}
                resizeMode="contain"
              />
              <Text
                className="text-3xl font-bold"
                style={{ color: COLORS.textDark }}
              >
                Admin Portal
              </Text>
              <Text
                className="text-lg mt-0.5"
                style={{ color: COLORS.textMuted }}
              >
                Portail administrateur
              </Text>
              <Text
                className="text-sm mt-2"
                style={{ color: COLORS.textMuted }}
              >
                Manage all businesses / Gérer toutes les entreprises
              </Text>
            </Animated.View>

            {/* Login Form */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(600).springify()}
              className="rounded-3xl p-6"
              style={{
                backgroundColor: COLORS.glass,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <Text
                className="text-xl font-bold mb-1 text-center"
                style={{ color: COLORS.textDark }}
              >
                Admin Sign In
              </Text>
              <Text
                className="text-sm mb-5 text-center"
                style={{ color: COLORS.textMuted }}
              >
                Connexion administrateur
              </Text>

              {/* Email Input */}
              <View className="mb-4">
                <Text
                  className="text-sm font-semibold mb-1"
                  style={{ color: COLORS.textDark }}
                >
                  Admin Email
                </Text>
                <Text
                  className="text-xs mb-2"
                  style={{ color: COLORS.textMuted }}
                >
                  Courriel administrateur
                </Text>
                <View
                  className="flex-row items-center rounded-xl px-4"
                  style={{
                    backgroundColor: COLORS.white,
                    borderWidth: 2,
                    borderColor: COLORS.glassBorder,
                  }}
                >
                  <Mail size={20} color={COLORS.textMuted} />
                  <TextInput
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (error) setError(null);
                    }}
                    placeholder="admin@email.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 py-4 px-3"
                    style={{ fontSize: 16, color: COLORS.textDark }}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-6">
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
                    backgroundColor: COLORS.white,
                    borderWidth: 2,
                    borderColor: COLORS.glassBorder,
                  }}
                >
                  <Lock size={20} color={COLORS.textMuted} />
                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (error) setError(null);
                    }}
                    placeholder="Enter password"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    className="flex-1 py-4 px-3"
                    style={{ fontSize: 16, color: COLORS.textDark }}
                  />
                </View>
              </View>

              {/* Error Message */}
              {error && (
                <View className="mb-4 p-3 rounded-xl bg-red-50">
                  <Text className="text-sm text-center" style={{ color: COLORS.error }}>
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
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <View className="items-center">
                    <Text className="text-lg font-bold" style={{ color: COLORS.white }}>
                      Sign In as Admin
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Se connecter en tant qu'admin
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
