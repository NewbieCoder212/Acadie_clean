import { useState, useEffect } from 'react';
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
import { Lock, Mail, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness, SafeBusinessRow } from '@/lib/supabase';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_KEY = 'manager_login_attempts';

interface RateLimitData {
  attempts: number;
  lockoutUntil: number | null;
  lastAttemptTime: number;
}

export default function SecureManagerLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  // Check rate limit status on mount
  useEffect(() => {
    checkRateLimitStatus();
  }, []);

  // Update lockout countdown
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const timer = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1000) {
            setIsLocked(false);
            clearRateLimitData();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutRemaining]);

  const checkRateLimitStatus = async () => {
    try {
      const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      if (stored) {
        const data: RateLimitData = JSON.parse(stored);

        // Check if still locked out
        if (data.lockoutUntil && Date.now() < data.lockoutUntil) {
          setIsLocked(true);
          setLockoutRemaining(data.lockoutUntil - Date.now());
          setAttemptsRemaining(0);
        } else if (data.lockoutUntil && Date.now() >= data.lockoutUntil) {
          // Lockout expired, clear data
          await clearRateLimitData();
        } else {
          setAttemptsRemaining(MAX_ATTEMPTS - data.attempts);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  };

  const recordFailedAttempt = async () => {
    try {
      const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      let data: RateLimitData = stored
        ? JSON.parse(stored)
        : { attempts: 0, lockoutUntil: null, lastAttemptTime: 0 };

      data.attempts += 1;
      data.lastAttemptTime = Date.now();

      if (data.attempts >= MAX_ATTEMPTS) {
        data.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        setIsLocked(true);
        setLockoutRemaining(LOCKOUT_DURATION_MS);
        setAttemptsRemaining(0);
      } else {
        setAttemptsRemaining(MAX_ATTEMPTS - data.attempts);
      }

      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    } catch (e) {
      // Ignore errors
    }
  };

  const clearRateLimitData = async () => {
    try {
      await AsyncStorage.removeItem(RATE_LIMIT_KEY);
      setAttemptsRemaining(MAX_ATTEMPTS);
      setIsLocked(false);
      setLockoutRemaining(0);
    } catch (e) {
      // Ignore errors
    }
  };

  const formatLockoutTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLogin = async () => {
    if (isLocked) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password / Veuillez entrer votre courriel et mot de passe');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginBusiness(email.trim(), password);

      if (result.success && result.data) {
        // Check if this is a non-admin business account (managers only)
        if (result.data.is_admin) {
          setError('This portal is for business managers only. / Ce portail est réservé aux gestionnaires d\'entreprise.');
          await recordFailedAttempt();
          setIsLoading(false);
          return;
        }

        // Success - clear rate limit and navigate
        await clearRateLimitData();
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));

        // Navigate to manager - use setTimeout to ensure navigation happens after state updates
        // This fixes "router is not defined" errors on web/iOS
        setTimeout(() => {
          try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = '/manager';
            } else {
              router.replace('/manager');
            }
          } catch (navError) {
            console.error('[Manager Login] Navigation error:', navError);
            if (typeof window !== 'undefined') {
              window.location.href = '/manager';
            }
          }
        }, 100);
      } else {
        await recordFailedAttempt();
        setError(result.error || 'Login failed / Échec de connexion');
      }
    } catch (err) {
      await recordFailedAttempt();
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
                <AcadiaLogo size={100} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                  <ShieldCheck size={18} color={C.emeraldDark} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: C.emeraldDark,
                      letterSpacing: 1,
                      marginLeft: 6,
                    }}
                  >
                    SECURE MANAGER ACCESS
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Accès sécurisé gestionnaire
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
                {/* Lockout Warning */}
                {isLocked && (
                  <View
                    style={{
                      marginBottom: 20,
                      padding: 16,
                      borderRadius: D.borderRadius.md,
                      backgroundColor: C.errorBg,
                      borderWidth: 1,
                      borderColor: C.error,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <AlertTriangle size={20} color={C.error} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.error, marginLeft: 8 }}>
                        Account Locked
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: C.error }}>
                      Too many failed attempts. Please wait {formatLockoutTime(lockoutRemaining)} before trying again.
                    </Text>
                    <Text style={{ fontSize: 11, color: C.error, marginTop: 4 }}>
                      Trop de tentatives échouées. Veuillez patienter.
                    </Text>
                  </View>
                )}

                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    textAlign: 'center',
                    color: C.textPrimary,
                  }}
                >
                  Manager Login
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    textAlign: 'center',
                    color: C.textMuted,
                    marginTop: 2,
                  }}
                >
                  Connexion gestionnaire
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
                  Enter your business credentials / Entrez vos identifiants d'entreprise
                </Text>

                {/* Email Input */}
                <View style={{ marginBottom: 16, opacity: isLocked ? 0.5 : 1 }}>
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
                      editable={!isLocked}
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
                <View style={{ marginBottom: 16, opacity: isLocked ? 0.5 : 1 }}>
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
                      editable={!isLocked}
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

                {/* Attempts Warning */}
                {!isLocked && attemptsRemaining < MAX_ATTEMPTS && (
                  <View
                    style={{
                      marginBottom: 16,
                      padding: 10,
                      borderRadius: D.borderRadius.md,
                      backgroundColor: C.warningBg,
                      borderWidth: 1,
                      borderColor: C.warning,
                    }}
                  >
                    <Text style={{ fontSize: 12, textAlign: 'center', color: '#92400e' }}>
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
                    </Text>
                  </View>
                )}

                {/* Error Message */}
                {error && !isLocked && (
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

                {/* Sign In Button */}
                <Pressable
                  onPress={handleLogin}
                  disabled={isLoading || isLocked}
                  style={{
                    backgroundColor: isLoading || isLocked ? C.textMuted : C.actionGreen,
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
                        {isLocked ? 'Locked' : 'Sign In'}
                      </Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                        {isLocked ? 'Verrouillé' : 'Connexion'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>

              {/* Security Notice */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(600).springify()}
                style={{ marginTop: 24, alignItems: 'center' }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: D.borderRadius.full,
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                  }}
                >
                  <ShieldCheck size={14} color={C.actionGreen} />
                  <Text style={{ fontSize: 11, color: C.actionGreen, marginLeft: 6, fontWeight: '500' }}>
                    Secured with rate limiting protection
                  </Text>
                </View>
              </Animated.View>

              {/* Admin Access Button */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={{ marginTop: 24, alignItems: 'center' }}
              >
                <Pressable
                  onPress={() => router.push('/admin-login')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: D.borderRadius.full,
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <ShieldCheck size={16} color="#7c3aed" />
                  <Text style={{ fontSize: 13, color: '#7c3aed', marginLeft: 8, fontWeight: '600' }}>
                    Admin Access
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                  Accès administrateur
                </Text>
              </Animated.View>

              {/* Footer */}
              <View style={{ marginTop: 20, alignItems: 'center' }}>
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
