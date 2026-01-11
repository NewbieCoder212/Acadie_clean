import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Mail, Shield } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness } from '@/lib/supabase';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

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
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));
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
    <View style={{ flex: 1, backgroundColor: C.mintBackground }}>
      <LinearGradient
        colors={[C.mintGradientStart, C.mintGradientEnd]}
        style={{ flex: 1 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Logo / Header */}
              <Animated.View
                entering={FadeInDown.duration(600).springify()}
                style={{ alignItems: 'center', marginBottom: 32 }}
              >
                <AcadiaLogo size={120} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: C.emeraldDark,
                      letterSpacing: 1,
                    }}
                  >
                    PARTNER PORTAL
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Portail partenaire
                </Text>
              </Animated.View>

              {/* Login Form Card */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={{
                  backgroundColor: C.cardBackground,
                  borderRadius: D.borderRadius.xl,
                  padding: 24,
                  borderWidth: 1,
                  borderColor: C.borderLight,
                  ...D.shadow.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    textAlign: 'center',
                    color: C.textPrimary,
                  }}
                >
                  Business Login
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    textAlign: 'center',
                    color: C.textMuted,
                    marginTop: 2,
                  }}
                >
                  Connexion d'entreprise
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    textAlign: 'center',
                    color: C.textMuted,
                    marginTop: 8,
                    marginBottom: 24,
                  }}
                >
                  Sign in to manage your locations / Connectez-vous pour gérer vos emplacements
                </Text>

                {/* Email Input */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary }}>
                    Email Address
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                    Adresse courriel
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: C.white,
                      borderRadius: D.borderRadius.md,
                      borderWidth: 2,
                      borderColor: C.borderMedium,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Mail size={20} color={C.textMuted} />
                    <TextInput
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (error) setError(null);
                      }}
                      placeholder="your@business.com"
                      placeholderTextColor={C.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        paddingHorizontal: 12,
                        fontSize: 16,
                        color: C.textPrimary,
                      }}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary }}>
                    Password
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                    Mot de passe
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: C.white,
                      borderRadius: D.borderRadius.md,
                      borderWidth: 2,
                      borderColor: C.borderMedium,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Lock size={20} color={C.textMuted} />
                    <TextInput
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (error) setError(null);
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor={C.textMuted}
                      secureTextEntry
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        paddingHorizontal: 12,
                        fontSize: 16,
                        color: C.textPrimary,
                      }}
                    />
                  </View>
                </View>

                {/* Error Message */}
                {error && (
                  <View
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      borderRadius: D.borderRadius.md,
                      backgroundColor: C.errorBg,
                      borderWidth: 1,
                      borderColor: C.error,
                    }}
                  >
                    <Text style={{ fontSize: 13, textAlign: 'center', color: C.error }}>
                      {error}
                    </Text>
                  </View>
                )}

                {/* Sign In Button - Action Green */}
                <Pressable
                  onPress={handleLogin}
                  disabled={isLoading}
                  style={{
                    backgroundColor: isLoading ? C.textMuted : C.actionGreen,
                    borderRadius: D.borderRadius.md,
                    paddingVertical: 16,
                    alignItems: 'center',
                    ...D.shadow.sm,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: C.white }}>
                        Sign In
                      </Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                        Connexion
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>

              {/* Admin Access Link */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(600).springify()}
                style={{ marginTop: 28, alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: C.borderMedium }} />
                  <Text style={{ marginHorizontal: 12, fontSize: 11, color: C.textMuted }}>
                    ADMINISTRATOR / ADMINISTRATEUR
                  </Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: C.borderMedium }} />
                </View>
                <Pressable
                  onPress={() => router.push('/admin-login')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: D.borderRadius.full,
                    backgroundColor: C.emeraldLight,
                    borderWidth: 1,
                    borderColor: C.emeraldDark,
                  }}
                >
                  <Shield size={16} color={C.emeraldDark} />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.emeraldDark }}>
                      Admin Access
                    </Text>
                    <Text style={{ fontSize: 10, color: C.textMuted }}>
                      Accès administrateur
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <View style={{ marginTop: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  Powered by{' '}
                  <Text style={{ fontWeight: '600', color: C.emeraldDark }}>
                    Acadia Clean IQ
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
