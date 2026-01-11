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
import { Lock, Mail, Building2, Shield, Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness } from '@/lib/supabase';

const COLORS = {
  primary: '#10b981',
  primaryDark: '#059669',
  background: '#A8E6CF',
  backgroundLight: '#A8E6CF',
  white: '#ffffff',
  textDark: '#064e3b',
  textMuted: '#6b7280',
  error: '#dc2626',
  glass: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(16, 185, 129, 0.2)',
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password / Veuillez entrer votre courriel et mot de passe');
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
        setError(result.error || 'Login failed / Échec de connexion');
      }
    } catch (err) {
      setError('Network error. Please try again. / Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#A8E6CF' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#A8E6CF' }}>
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
                source={require('../../assets/Gemini_Generated_Image_1uvu461uvu461uvu.png')}
                style={{ width: 160, height: 160 }}
                resizeMode="contain"
              />
              <View className="flex-row items-center mt-2">
                <Sparkles size={14} color={COLORS.primary} />
                <Text
                  className="text-sm font-semibold ml-1"
                  style={{ color: COLORS.primary }}
                >
                  PARTNER PORTAL
                </Text>
              </View>
              <Text
                className="text-xs"
                style={{ color: COLORS.textMuted }}
              >
                Portail partenaire
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
                className="text-xl font-bold text-center"
                style={{ color: COLORS.textDark }}
              >
                Business Login
              </Text>
              <Text
                className="text-xs text-center"
                style={{ color: COLORS.textMuted }}
              >
                Connexion d'entreprise
              </Text>
              <Text
                className="text-sm mt-1 mb-6 text-center"
                style={{ color: COLORS.textMuted }}
              >
                Sign in to manage your locations / Connectez-vous pour gérer vos emplacements
              </Text>

              {/* Email Input */}
              <View className="mb-4">
                <Text
                  className="text-sm font-semibold"
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
                    placeholder="your@business.com"
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
                  className="text-sm font-semibold"
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
                    placeholder="Enter your password"
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
                      Sign In
                    </Text>
                    <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Connexion
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>

            {/* Admin Access Link */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(600).springify()}
              className="mt-6 items-center"
            >
              <View className="flex-row items-center mb-2">
                <View className="h-px flex-1 bg-gray-300" />
                <Text className="mx-3 text-xs" style={{ color: COLORS.textMuted }}>
                  ADMINISTRATOR / ADMINISTRATEUR
                </Text>
                <View className="h-px flex-1 bg-gray-300" />
              </View>
              <Pressable
                onPress={() => router.push('/admin-login')}
                className="flex-row items-center py-3 px-4 rounded-full active:opacity-70"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <Shield size={16} color={COLORS.primary} />
                <View className="ml-2">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: COLORS.primaryDark }}
                  >
                    Admin Access
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: COLORS.textMuted }}
                  >
                    Accès administrateur
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Footer */}
            <View className="mt-8 items-center">
              <Text className="text-xs" style={{ color: COLORS.textMuted }}>
                Powered by Acadia Clean Solutions
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
