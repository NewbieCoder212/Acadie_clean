import { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Download, X, Share, Plus } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { BRAND_COLORS as C } from '@/lib/colors';

export function InstallAppBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Only show on web
    if (Platform.OS !== 'web') return;

    const checkPWAState = async () => {
      // Check if already running as PWA (user added to home screen)
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;

      if (standalone) {
        setIsStandalone(true);
        return; // Don't show banner - they already added it!
      }

      // Check if iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);

      // Always show banner until user adds to home screen
      setIsVisible(true);
    };

    checkPWAState();
  }, []);

  // X button just hides for this session - banner will come back next visit
  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || isStandalone || Platform.OS !== 'web') {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={{
        backgroundColor: C.white,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: C.emeraldLight,
      }}
    >
      <Pressable
        onPress={handleDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: 4,
        }}
      >
        <X size={18} color={C.textSecondary} />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: C.emeraldLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Download size={20} color={C.actionGreen} />
        </View>
        <View style={{ flex: 1, paddingRight: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.textPrimary }}>
            Add to Home Screen
          </Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            Quick 1-tap access to your dashboard
          </Text>
        </View>
      </View>

      {isIOS ? (
        <View
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: '#e0e7ff',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4f46e5' }}>1</Text>
            </View>
            <Text style={{ fontSize: 14, color: C.textPrimary, flex: 1 }}>
              Tap the <Share size={14} color="#007AFF" style={{ marginHorizontal: 2 }} /> Share button below
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: '#e0e7ff',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4f46e5' }}>2</Text>
            </View>
            <Text style={{ fontSize: 14, color: C.textPrimary, flex: 1 }}>
              Select "Add to Home Screen" <Plus size={14} color="#007AFF" />
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 14, color: C.textPrimary }}>
            Tap your browser's menu (⋮) and select "Add to Home screen" or "Install app"
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
