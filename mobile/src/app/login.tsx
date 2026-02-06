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
import { Lock, Mail, Shield } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginManager, loginBusiness, ManagerLoginResult, ManagerBusinessAccess } from '@/lib/supabase';
import { AcadiaLogo } from '@/components/AcadiaLogo';
import { BusinessPickerScreen } from '@/components/BusinessPicker';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';

// Storage keys for manager session
const STORAGE_KEYS = {
  currentManager: 'currentManager',
  currentBusiness: 'currentBusiness',
  selectedBusinessAccess: 'selectedBusinessAccess',
  managerBusinesses: 'managerBusinesses',
  sessionTimestamp: 'sessionTimestamp',
};

// Session expires after 30 days (in milliseconds)
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Multi-business selection state
  const [loginResult, setLoginResult] = useState<ManagerLoginResult | null>(null);
  const [showBusinessPicker, setShowBusinessPicker] = useState(false);

  // Check for existing valid session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const [managerData, businessData, timestampStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.currentManager),
          AsyncStorage.getItem(STORAGE_KEYS.currentBusiness),
          AsyncStorage.getItem(STORAGE_KEYS.sessionTimestamp),
        ]);

        // Check if we have session data
        if (managerData && businessData && timestampStr) {
          const sessionTimestamp = parseInt(timestampStr, 10);
          const now = Date.now();

          // Check if session is still valid (within 30 days)
          if (now - sessionTimestamp < SESSION_EXPIRY_MS) {
            console.log('[Login] Valid session found, redirecting to manager dashboard');
            router.replace('/manager');
            return;
          } else {
            // Session expired - clear storage
            console.log('[Login] Session expired, clearing storage');
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.currentManager,
              STORAGE_KEYS.currentBusiness,
              STORAGE_KEYS.selectedBusinessAccess,
              STORAGE_KEYS.managerBusinesses,
              STORAGE_KEYS.sessionTimestamp,
            ]);
          }
        }
      } catch (err) {
        console.error('[Login] Error checking session:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [router]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password / Veuillez entrer votre courriel et mot de passe');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try the new manager login system first
      const managerResult = await loginManager(email.trim(), password);

      if (managerResult.success && managerResult.data) {
        const { manager, businesses } = managerResult.data;

        // Store manager info and session timestamp
        await AsyncStorage.setItem(STORAGE_KEYS.currentManager, JSON.stringify(manager));
        await AsyncStorage.setItem(STORAGE_KEYS.managerBusinesses, JSON.stringify(businesses));
        await AsyncStorage.setItem(STORAGE_KEYS.sessionTimestamp, Date.now().toString());

        if (businesses.length === 0) {
          // No businesses - show error
          setError('No businesses associated with this account / Aucune entreprise associée à ce compte');
          setIsLoading(false);
          return;
        }

        if (businesses.length === 1) {
          // Only one business - go directly to dashboard
          await selectBusiness(businesses[0]);
          return;
        }

        // Multiple businesses - show picker
        setLoginResult(managerResult.data);
        setShowBusinessPicker(true);
        setIsLoading(false);
        return;
      }

      // Fall back to legacy business login if manager login fails
      console.log('[Login] Manager login failed, trying legacy business login');
      const businessResult = await loginBusiness(email.trim(), password);

      if (businessResult.success && businessResult.data) {
        // Store as legacy business session with timestamp
        await AsyncStorage.setItem(STORAGE_KEYS.currentBusiness, JSON.stringify(businessResult.data));
        await AsyncStorage.setItem(STORAGE_KEYS.sessionTimestamp, Date.now().toString());
        router.replace('/manager');
      } else {
        setError(businessResult.error || managerResult.error || 'Login failed / Échec de connexion');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError('Network error. Please try again. / Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectBusiness = async (businessAccess: ManagerBusinessAccess) => {
    try {
      // Store selected business, permissions, and session timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.currentBusiness, JSON.stringify(businessAccess.business));
      await AsyncStorage.setItem(STORAGE_KEYS.selectedBusinessAccess, JSON.stringify(businessAccess));
      await AsyncStorage.setItem(STORAGE_KEYS.sessionTimestamp, Date.now().toString());

      // Navigate to manager dashboard
      router.replace('/manager');
    } catch (err) {
      console.error('[Login] Error selecting business:', err);
      setError('Failed to select business. Please try again.');
    }
  };

  // Show business picker screen if user has multiple businesses
  if (showBusinessPicker && loginResult) {
    return (
      <BusinessPickerScreen
        businesses={loginResult.businesses}
        managerName={loginResult.manager.name}
        onSelectBusiness={selectBusiness}
      />
    );
  }

  // Show loading state while checking for existing session
  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: C.mintBackground }}>
        <LinearGradient
          colors={[C.mintGradientStart, C.mintGradientEnd]}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <AcadiaLogo size={100} />
          <ActivityIndicator size="large" color={C.emeraldDark} style={{ marginTop: 24 }} />
        </LinearGradient>
      </View>
    );
  }

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

                {/* Forgot Password Link */}
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
                    Forgot password? Contact administrator:
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 2 }}>
                    Mot de passe oublié? Contactez l'administrateur:
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: C.emeraldDark,
                      marginTop: 6,
                    }}
                    selectable
                  >
                    jay@acadiacleaniq.ca
                  </Text>
                </View>
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
