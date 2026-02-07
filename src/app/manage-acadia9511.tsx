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
import { loginBusiness } from '@/lib/supabase';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RATE_LIMIT_KEY = 'manager_login_attempts';

export default function SecureManagerLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  // Initial status check
  useEffect(() => {
    const initStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.lockoutUntil && Date.now() < data.lockoutUntil) {
            setIsLocked(true);
            setLockoutRemaining(data.lockoutUntil - Date.now());
          } else {
            setAttemptsRemaining(MAX_ATTEMPTS - (data.attempts || 0));
          }
        }
      } catch (e) { /* silent fail */ }
    };
    initStatus();
  }, []);

  // Stable Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockoutRemaining > 0) {
      timer = setInterval(() => {
        setLockoutRemaining((prev) => {
          if (prev <= 1000) {
            setIsLocked(false);
            AsyncStorage.removeItem(RATE_LIMIT_KEY);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutRemaining > 0]);

  const handleLogin = async () => {
    if (isLocked || isLoading) return;
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password / Veuillez entrer votre courriel et mot de passe');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginBusiness(email.trim(), password);
      if (result.success && result.data) {
        if (result.data.is_admin) {
          setError("This portal is for managers only. / Ce portail est réservé aux gestionnaires d'entreprise.");
          setIsLoading(false);
          return;
        }
        await AsyncStorage.removeItem(RATE_LIMIT_KEY);
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));
        router.replace('/manager');
      } else {
        const stored = await AsyncStorage.getItem(RATE_LIMIT_KEY);
        let data = stored ? JSON.parse(stored) : { attempts: 0 };
        data.attempts += 1;
        if (data.attempts >= MAX_ATTEMPTS) {
          data.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          setIsLocked(true);
          setLockoutRemaining(LOCKOUT_DURATION_MS);
        }
        setAttemptsRemaining(MAX_ATTEMPTS - data.attempts);
        await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
        setError(result.error || 'Login failed / Échec de connexion');
      }
    } catch (err) {
      setError('Network error. / Erreur réseau.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.mintBackground }}>
      <LinearGradient colors={[C.mintGradientStart, C.mintGradientEnd]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
              
              {/* Logo / Header */}
              <Animated.View entering={FadeInDown.duration(600).springify()} style={{ alignItems: 'center', marginBottom: 32 }}>
                <AcadiaLogo size={100} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                  <ShieldCheck size={18} color={C.emeraldDark} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.emeraldDark, marginLeft: 6 }}>SECURE MANAGER ACCESS</Text>
                </View>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Accès sécurisé gestionnaire</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={{ backgroundColor: C.cardBackground, borderRadius: D.borderRadius.xl, padding: 24, borderWidth: 1, borderColor: C.borderLight, ...D.shadow.md }}>
                
                {/* Lockout Warning */}
                {isLocked && (
                  <View style={{ marginBottom: 20, padding: 16, borderRadius: D.borderRadius.md, backgroundColor: C.errorBg, borderWidth: 1, borderColor: C.error }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <AlertTriangle size={20} color={C.error} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.error, marginLeft: 8 }}>Account Locked</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: C.error }}>Please wait {formatTime(lockoutRemaining)} before trying again.</Text>
                  </View>
                )}

                <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', color: C.textPrimary }}>Manager Login</Text>
                <Text style={{ fontSize: 12, textAlign: 'center', color: C.textMuted, marginTop: 2 }}>Connexion gestionnaire</Text>

                {/* Email */}
                <View style={{ marginTop: 24, opacity: isLocked ? 0.5 : 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary }}>Email Address / Adresse courriel</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: D.borderRadius.md, borderWidth: 2, borderColor: C.borderMedium, paddingHorizontal: 14, marginTop: 8 }}>
                    <Mail size={20} color={C.textMuted} />
                    <TextInput
                      value={email}
                      onChangeText={(text) => { setEmail(text); if (error) setError(null); }}
                      placeholder="your@business.com"
                      autoCapitalize="none"
                      editable={!isLocked}
                      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16, color: C.textPrimary }}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={{ marginTop: 16, opacity: isLocked ? 0.5 : 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary }}>Password / Mot de passe</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: D.borderRadius.md, borderWidth: 2, borderColor: C.borderMedium, paddingHorizontal: 14, marginTop: 8 }}>
                    <Lock size={20} color={C.textMuted} />
                    <TextInput
                      value={password}
                      onChangeText={(text) => { setPassword(text); if (error) setError(null); }}
                      secureTextEntry
                      editable={!isLocked}
                      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16, color: C.textPrimary }}
                    />
                  </View>
                </View>

                {/* Error */}
                {error && !isLocked && (
                  <Text style={{ color: C.error, textAlign: 'center', marginTop: 16 }}>{error}</Text>
                )}

                {/* Sign In Button */}
                <Pressable onPress={handleLogin} disabled={isLoading || isLocked} style={{ backgroundColor: isLoading || isLocked ? C.textMuted : C.actionGreen, borderRadius: D.borderRadius.md, paddingVertical: 16, alignItems: 'center', marginTop: 24, ...D.shadow.sm }}>
                  {isLoading ? <ActivityIndicator color={C.white} /> : <Text style={{ fontSize: 18, fontWeight: '700', color: C.white }}>{isLocked ? 'Locked' : 'Sign In / Connexion'}</Text>}
                </Pressable>
              </Animated.View>

              {/* RESTORED: Admin Access Button */}
              <Animated.View entering={FadeInDown.delay(500).duration(600).springify()} style={{ marginTop: 24, alignItems: 'center' }}>
                <Pressable
                  onPress={() => router.push('/admin-login')}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: D.borderRadius.full, backgroundColor: 'rgba(124, 58, 237, 0.1)', borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.3)' }}
                >
                  <ShieldCheck size={16} color="#7c3aed" />
                  <Text style={{ fontSize: 13, color: '#7c3aed', marginLeft: 8, fontWeight: '600' }}>Admin Access</Text>
                </Pressable>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Accès administrateur</Text>
              </Animated.View>

              {/* Footer */}
              <View style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: C.textMuted }}>Powered by <Text style={{ fontWeight: '600', color: C.emeraldDark }}>Acadia Clean IQ</Text></Text>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}