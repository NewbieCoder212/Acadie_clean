import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, Component, ReactNode } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { startOfflineSync, stopOfflineSync } from '@/lib/offline-queue';

// KeyboardProvider requires native linking (dev build). In Expo Go / web it's unavailable — use a passthrough.
function getKeyboardProviderWrapper(): React.ComponentType<{ children: ReactNode }> {
  try {
    const mod = require('react-native-keyboard-controller');
    if (mod?.KeyboardProvider) return mod.KeyboardProvider;
  } catch {
    // Module not linked (Expo Go, web, or pod install not run)
  }
  return ({ children }: { children: ReactNode }) => <>{children}</>;
}
const KeyboardProviderWrapper = getKeyboardProviderWrapper();
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// ============================================
// GLOBAL ERROR BOUNDARY
// Catches unhandled errors and shows recovery UI
// ============================================
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Error info:', errorInfo);
    }
    // In production, you could send this to an error tracking service
    // e.g., Sentry.captureException(error);
  }

  handleReload = () => {
    // Reset error state and try to re-render
    this.setState({ hasError: false, error: null });
    // Force reload the app
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f0fdf4' }}>
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}>
            {/* Error Icon */}
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#fef3c7',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}>
              <AlertTriangle size={40} color="#d97706" />
            </View>

            {/* Error Message */}
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#064e3b',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Something went wrong
            </Text>
            <Text style={{
              fontSize: 16,
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Une erreur s'est produite
            </Text>

            <Text style={{
              fontSize: 14,
              color: '#9ca3af',
              textAlign: 'center',
              marginBottom: 32,
              paddingHorizontal: 16,
            }}>
              The app encountered an unexpected error. Please try refreshing.
            </Text>

            {/* Show error details in development */}
            {__DEV__ && this.state.error && (
              <View style={{
                backgroundColor: '#fef2f2',
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                maxWidth: '100%',
              }}>
                <Text style={{
                  fontSize: 12,
                  color: '#991b1b',
                  fontFamily: 'monospace',
                }}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            {/* Reload Button */}
            <Pressable
              onPress={this.handleReload}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#10b981',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
              }}
            >
              <RefreshCw size={20} color="#ffffff" />
              <Text style={{
                color: '#ffffff',
                fontSize: 16,
                fontWeight: '600',
                marginLeft: 8,
              }}>
                Refresh App
              </Text>
            </Pressable>

            {/* Footer */}
            <Text style={{
              fontSize: 12,
              color: '#9ca3af',
              marginTop: 32,
            }}>
              Acadia CleanIQ
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="washroom/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="manager"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="public-log/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin-login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/business/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="manage-acadia9511"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Start offline sync listener on app mount - ONLY on native (causes refresh issues on web)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      startOfflineSync();
      return () => {
        stopOfflineSync();
      };
    }
  }, []);

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProviderWrapper>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <RootLayoutNav colorScheme={colorScheme} />
          </KeyboardProviderWrapper>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
