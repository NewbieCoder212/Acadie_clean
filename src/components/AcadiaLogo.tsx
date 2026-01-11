import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Path, Circle, G } from 'react-native-svg';
import { BRAND_COLORS as C } from '@/lib/colors';

interface AcadiaLogoProps {
  size?: number;
  showText?: boolean;
}

export function AcadiaLogo({ size = 100, showText = true }: AcadiaLogoProps) {
  const qrSize = size * 0.8;
  const dropSize = size * 0.35;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={qrSize} height={qrSize} viewBox="0 0 100 100">
        {/* QR Code Pattern Background */}
        <G>
          {/* Corner squares */}
          <Rect x="5" y="5" width="25" height="25" rx="4" fill={C.emeraldDark} />
          <Rect x="9" y="9" width="17" height="17" rx="2" fill={C.white} />
          <Rect x="13" y="13" width="9" height="9" rx="1" fill={C.emeraldDark} />

          <Rect x="70" y="5" width="25" height="25" rx="4" fill={C.emeraldDark} />
          <Rect x="74" y="9" width="17" height="17" rx="2" fill={C.white} />
          <Rect x="78" y="13" width="9" height="9" rx="1" fill={C.emeraldDark} />

          <Rect x="5" y="70" width="25" height="25" rx="4" fill={C.emeraldDark} />
          <Rect x="9" y="74" width="17" height="17" rx="2" fill={C.white} />
          <Rect x="13" y="78" width="9" height="9" rx="1" fill={C.emeraldDark} />

          {/* Data pattern dots */}
          <Rect x="35" y="5" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="45" y="5" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="55" y="5" width="6" height="6" rx="1" fill={C.emeraldDark} />

          <Rect x="35" y="15" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="55" y="15" width="6" height="6" rx="1" fill={C.emeraldDark} />

          <Rect x="5" y="35" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="15" y="35" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="5" y="45" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="5" y="55" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="15" y="55" width="6" height="6" rx="1" fill={C.emeraldDark} />

          <Rect x="89" y="35" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="79" y="45" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="89" y="55" width="6" height="6" rx="1" fill={C.emeraldDark} />

          <Rect x="35" y="89" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="45" y="89" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="55" y="89" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="65" y="89" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="75" y="79" width="6" height="6" rx="1" fill={C.emeraldDark} />

          <Rect x="35" y="79" width="6" height="6" rx="1" fill={C.emeraldDark} />
          <Rect x="55" y="79" width="6" height="6" rx="1" fill={C.emeraldDark} />
        </G>

        {/* Center Water Drop with Checkmark */}
        <G>
          {/* Water drop shape */}
          <Path
            d="M50 28 C50 28 35 45 35 58 C35 68 41 75 50 75 C59 75 65 68 65 58 C65 45 50 28 50 28 Z"
            fill={C.actionGreen}
          />
          {/* Checkmark */}
          <Path
            d="M42 55 L47 62 L58 48"
            stroke={C.white}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      </Svg>

      {showText && (
        <View style={{ marginTop: size * 0.1, alignItems: 'center' }}>
          <Text
            style={{
              fontSize: size * 0.18,
              fontWeight: '800',
              color: C.emeraldDark,
              letterSpacing: 1,
            }}
          >
            Acadia
          </Text>
          <Text
            style={{
              fontSize: size * 0.16,
              fontWeight: '700',
              color: C.actionGreen,
              letterSpacing: 0.5,
              marginTop: -2,
            }}
          >
            Clean IQ
          </Text>
        </View>
      )}
    </View>
  );
}

export default AcadiaLogo;
