// Acadia Clean IQ - Consistent Color Palette
// Used across all screens for brand consistency

export const BRAND_COLORS = {
  // Primary Brand Colors
  mintBackground: '#F0FFF7',        // Main background for all screens
  mintGradientStart: '#CFFFE5',     // Radial gradient start
  mintGradientEnd: '#F0FFF7',       // Radial gradient end

  // Emerald Family - Headers & Admin Actions
  emeraldDark: '#065F46',           // Headers, primary admin buttons, "Acadia" text
  emerald: '#059669',               // Secondary admin elements
  emeraldLight: '#D1FAE5',          // Light emerald for backgrounds

  // Action Green - User Action Buttons
  actionGreen: '#10B981',           // Sign In, Complete Cleaning, Submit buttons
  actionGreenHover: '#059669',      // Hover state for action buttons

  // Text Colors
  textPrimary: '#064E3B',           // High contrast text (HIG compliant)
  textSecondary: '#065F46',         // Secondary text
  textMuted: '#6B7280',             // Muted/placeholder text

  // Status Colors
  success: '#10B981',               // Clean/Complete status
  warning: '#F59E0B',               // Attention required
  error: '#EF4444',                 // Error/Issue states

  // Neutral Colors
  white: '#FFFFFF',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  borderLight: 'rgba(6, 95, 70, 0.15)',
  borderMedium: 'rgba(6, 95, 70, 0.25)',

  // Status Backgrounds
  successBg: '#D1FAE5',             // Compliant rows
  warningBg: '#FEF3C7',             // Attention rows
  errorBg: '#FEE2E2',               // Error states
  emptyBg: '#F3F4F6',               // Empty state rows

  // Glass Effect
  glass: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(6, 95, 70, 0.2)',
} as const;

// Design System Constants
export const DESIGN = {
  // Border Radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  // Shadows
  shadow: {
    sm: {
      shadowColor: '#065F46',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#065F46',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#065F46',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
} as const;

// Export for quick access in components
export const C = BRAND_COLORS;
export const D = DESIGN;
