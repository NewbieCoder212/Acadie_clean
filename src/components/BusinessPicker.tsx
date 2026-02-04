import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  Crown,
  Eye,
  Shield,
  X,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { BRAND_COLORS as C, DESIGN as D } from '@/lib/colors';
import { ManagerBusinessAccess, ManagerRole } from '@/lib/supabase';

interface BusinessPickerProps {
  businesses: ManagerBusinessAccess[];
  selectedBusinessId: string | null;
  onSelectBusiness: (business: ManagerBusinessAccess) => void;
  managerName?: string | null;
}

// Role badge component
function RoleBadge({ role }: { role: ManagerRole }) {
  const config = {
    owner: {
      icon: Crown,
      label: 'Owner',
      labelFr: 'Propriétaire',
      bg: '#FEF3C7',
      color: '#D97706',
    },
    supervisor: {
      icon: Shield,
      label: 'Supervisor',
      labelFr: 'Superviseur',
      bg: '#DBEAFE',
      color: '#2563EB',
    },
    viewer: {
      icon: Eye,
      label: 'Viewer',
      labelFr: 'Observateur',
      bg: '#F3F4F6',
      color: '#6B7280',
    },
  };

  const { icon: Icon, label, labelFr, bg, color } = config[role];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: D.borderRadius.full,
        gap: 4,
      }}
    >
      <Icon size={12} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>
        {label}
      </Text>
    </View>
  );
}

// Full screen business picker (for initial selection after login)
export function BusinessPickerScreen({
  businesses,
  onSelectBusiness,
  managerName,
}: Omit<BusinessPickerProps, 'selectedBusinessId'>) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSelect = async (business: ManagerBusinessAccess) => {
    setIsLoading(business.business.id);
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    onSelectBusiness(business);
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
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              padding: 24,
              paddingTop: 40,
            }}
          >
            {/* Header */}
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              style={{ alignItems: 'center', marginBottom: 32 }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: C.emeraldLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Building2 size={40} color={C.emeraldDark} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: C.textPrimary,
                  textAlign: 'center',
                }}
              >
                Select Business
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: C.textMuted,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Sélectionnez une entreprise
              </Text>
              {managerName && (
                <Text
                  style={{
                    fontSize: 14,
                    color: C.textSecondary,
                    marginTop: 12,
                  }}
                >
                  Welcome, {managerName}
                </Text>
              )}
            </Animated.View>

            {/* Business List */}
            <View style={{ gap: 12 }}>
              {businesses.map((item, index) => (
                <Animated.View
                  key={item.business.id}
                  entering={FadeInDown.delay(100 + index * 100).duration(500).springify()}
                >
                  <Pressable
                    onPress={() => handleSelect(item)}
                    disabled={isLoading !== null}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? C.emeraldLight : C.cardBackground,
                      borderRadius: D.borderRadius.lg,
                      padding: 16,
                      borderWidth: 2,
                      borderColor: pressed ? C.emeraldDark : C.borderLight,
                      opacity: isLoading && isLoading !== item.business.id ? 0.5 : 1,
                      ...D.shadow.md,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: C.emeraldLight,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Building2 size={24} color={C.emeraldDark} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: C.textPrimary,
                          }}
                        >
                          {item.business.name}
                        </Text>
                        <View style={{ marginTop: 4 }}>
                          <RoleBadge role={item.role} />
                        </View>
                      </View>

                      {isLoading === item.business.id ? (
                        <ActivityIndicator color={C.emeraldDark} />
                      ) : (
                        <ChevronRight size={20} color={C.textMuted} />
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>

            {/* Info Text */}
            <Animated.View
              entering={FadeIn.delay(600).duration(500)}
              style={{ marginTop: 24, alignItems: 'center' }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                  textAlign: 'center',
                }}
              >
                You have access to {businesses.length} business{businesses.length !== 1 ? 'es' : ''}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  textAlign: 'center',
                  marginTop: 2,
                }}
              >
                Vous avez accès à {businesses.length} entreprise{businesses.length !== 1 ? 's' : ''}
              </Text>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

// Dropdown business switcher (for use in header)
export function BusinessSwitcher({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
}: BusinessPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedBusiness = businesses.find(
    b => b.business.id === selectedBusinessId
  );

  if (businesses.length <= 1) {
    // If only one business, just show the name without dropdown
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Building2 size={16} color={C.emeraldDark} />
        <Text
          style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '600',
            color: C.textPrimary,
          }}
          numberOfLines={1}
        >
          {selectedBusiness?.business.name || 'Select Business'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? C.emeraldLight : 'transparent',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: D.borderRadius.md,
          borderWidth: 1,
          borderColor: C.borderMedium,
        })}
      >
        <Building2 size={16} color={C.emeraldDark} />
        <Text
          style={{
            marginLeft: 6,
            marginRight: 4,
            fontSize: 14,
            fontWeight: '600',
            color: C.textPrimary,
            maxWidth: 150,
          }}
          numberOfLines={1}
        >
          {selectedBusiness?.business.name || 'Select'}
        </Text>
        <ChevronDown size={16} color={C.textMuted} />
      </Pressable>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={{
              backgroundColor: C.white,
              borderRadius: D.borderRadius.xl,
              maxHeight: '70%',
              ...D.shadow.lg,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: C.borderLight,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: C.textPrimary,
                }}
              >
                Switch Business
              </Text>
              <Pressable
                onPress={() => setIsOpen(false)}
                style={{
                  padding: 4,
                }}
              >
                <X size={20} color={C.textMuted} />
              </Pressable>
            </View>

            {/* Business List */}
            <ScrollView style={{ maxHeight: 400 }}>
              {businesses.map(item => (
                <Pressable
                  key={item.business.id}
                  onPress={() => {
                    onSelectBusiness(item);
                    setIsOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor:
                      item.business.id === selectedBusinessId
                        ? C.emeraldLight
                        : pressed
                        ? C.mintBackground
                        : C.white,
                    borderBottomWidth: 1,
                    borderBottomColor: C.borderLight,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor:
                        item.business.id === selectedBusinessId
                          ? C.emeraldDark
                          : C.emeraldLight,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Building2
                      size={20}
                      color={
                        item.business.id === selectedBusinessId
                          ? C.white
                          : C.emeraldDark
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight:
                          item.business.id === selectedBusinessId ? '700' : '500',
                        color: C.textPrimary,
                      }}
                    >
                      {item.business.name}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <RoleBadge role={item.role} />
                    </View>
                  </View>

                  {item.business.id === selectedBusinessId && (
                    <Check size={20} color={C.emeraldDark} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default BusinessPickerScreen;
