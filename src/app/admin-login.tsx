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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, Mail, ChevronLeft } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginBusiness } from '@/lib/supabase';

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
        if (!result.data.is_admin) {
          setError('This account does not have admin access');
          setIsLoading(false);
          return;
        }
        await AsyncStorage.setItem('currentBusiness', JSON.stringify(result.data));
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
    <LinearGradient colors={[COLORS.background, COLORS.backgroundLight]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            
            {/* Back Button */}
            <Pressable
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
            >
              <ChevronLeft size={24} color={COLORS.primaryDark} />
              <Text style={{ fontSize: 16, fontWeight: '500', color: COLORS.primaryDark, marginLeft: 4 }}>
                Back / Retour
              </Text>
            </Pressable>

            <View style={{ flex: 1, justifyContent: 'center', px: 24, paddingHorizontal: 24 }}>
              
              {/* Animated Header - Stays outside the form for stability */}
              <Animated.View entering={FadeInDown.duration(600).springify()} style={{ alignItems: 'center', marginBottom: 40 }}>
                <Image
                  source={require('../../assets/image-1767959752.png')}
                  style={{ width: 100, height: 100, marginBottom: 16 }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: COLORS.textDark }}>Admin Portal</Text>
                <Text style={{ fontSize: 16, color: COLORS.textMuted }}>Portail administrateur</Text>
              </Animated.View>

              {/* Form Container - Using standard View to prevent re-render jumps */}
              <View style={{
                backgroundColor: COLORS.glass,
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5
              }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textDark, textAlign: 'center', marginBottom: 20 }}>
                  Admin Sign In / Connexion
                </Text>

                {/* Email Input */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 4 }}>Admin Email / Courriel</Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: COLORS.glassBorder,
                    paddingHorizontal: 12
                  }}>
                    <Mail size={18} color={COLORS.textMuted} />
                    <TextInput
                      value={email}
                      onChangeText={(t) => { setEmail(t); if(error) setError(null); }}
                      placeholder="admin@email.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 16, color: COLORS.textDark }}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 4 }}>Password / Mot de passe</Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: COLORS.glassBorder,
                    paddingHorizontal: 12
                  }}>
                    <Lock size={18} color={COLORS.textMuted} />
                    <TextInput
                      value={password}
                      onChangeText={(t) => { setPassword(t); if(error) setError(null); }}
                      secureTextEntry
                      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 16, color: COLORS.textDark }}
                    />
                  </View>
                </View>

                {error && (
                  <Text style={{ color: COLORS.error, textAlign: 'center', marginBottom: 16, fontSize: 14 }}>{error}</Text>
                )}

                <Pressable
                  onPress={handleLogin}
                  disabled={isLoading}
                  style={({ pressed }) => ({
                    backgroundColor: isLoading ? COLORS.textMuted : (pressed ? COLORS.primaryDark : COLORS.primary),
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                  })}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: '700' }}>Sign In as Admin</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Se connecter en tant qu'admin</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}