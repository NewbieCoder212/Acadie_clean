import { useState, useEffect, useCallback, useMemo } from 'react';
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
  
  // 1. INPUT STATE (Kept separate to prevent lag)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 2. UI STATE
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 3. LOCKOUT STATE
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  // Load status once on mount
  useEffect(() => {
    const initStatus = async () => {
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
    };
    initStatus();
  }, []);

  // Dedicated Timer (Optimized to not interfere with typing)
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
  }, [isLocked, lockoutRemaining]);

  const handleLogin = async () => {
    if (isLocked || isLoading) return;
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginBusiness(email.trim(), password);
      if (result.success && result.data) {
        if (result.data.is_admin) {
          setError('This portal is for managers only.');
          setIsLoading(false);
          return;
        }
        await AsyncStorage.removeItem(RATE_LIMIT_KEY);
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));
        router.replace('/manager');
      } else {
        // Record Failure
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
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
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
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="always">
              
              <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', marginBottom: 32 }}>
                <AcadiaLogo size={100} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.emeraldDark, marginTop: 16 }}>SECURE MANAGER ACCESS</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(200)} style={{ backgroundColor: C.cardBackground, borderRadius: D.borderRadius.xl, padding: 24, ...D.shadow.md }}>
                
                {isLocked && (
                  <View style={{ marginBottom: 20, padding: 12, backgroundColor: C.errorBg, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: C.error }}>
                    <Text style={{ color: C.error, fontWeight: 'bold' }}>Account Locked</Text>
                    <Text style={{ color: C.error, fontSize: 12 }}>Try again in {formatTime(lockoutRemaining)}</Text>
                  </View>
                )}

                <Text style={{ fontSize: 22, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>Manager Login</Text>
                
                <View style={{ marginTop: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 }}>Email</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: C.borderMedium, paddingHorizontal: 12 }}>
                    <Mail size={20} color={C.textMuted} />
                    <TextInput
                      style={{ flex: 1, padding: 14, fontSize: 16 }}
                      value={email}
                      onChangeText={(t) => { setEmail(t); setError(null); }}
                      placeholder="your@business.com"
                      autoCapitalize="none"
                      editable={!isLocked}
                    />
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 }}>Password</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: C.borderMedium, paddingHorizontal: 12 }}>
                    <Lock size={20} color={C.textMuted} />
                    <TextInput
                      style={{ flex: 1, padding: 14, fontSize: 16 }}
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(null); }}
                      secureTextEntry
                      placeholder="••••••••"
                      editable={!isLocked}
                    />
                  </View>
                </View>

                {error && <Text style={{ color: C.error, marginTop: 10, textAlign: 'center' }}>{error}</Text>}

                <Pressable 
                  onPress={handleLogin} 
                  disabled={isLoading || isLocked}
                  style={({ pressed }) => ({
                    backgroundColor: isLocked ? C.textMuted : (pressed ? C.emeraldDark : C.actionGreen),
                    padding: 16,
                    borderRadius: 8,
                    marginTop: 24,
                    alignItems: 'center',
                    opacity: isLocked ? 0.6 : 1
                  })}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign In</Text>}
                </Pressable>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}