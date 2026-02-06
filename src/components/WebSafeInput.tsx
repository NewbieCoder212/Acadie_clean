import { Platform, TextInput, TextInputProps, View } from 'react-native';
import { useRef, useEffect } from 'react';

interface WebSafeInputProps extends Omit<TextInputProps, 'onChange'> {
  value: string;
  onChangeText: (text: string) => void;
  inputType?: 'text' | 'password' | 'number';
}

/**
 * A TextInput wrapper that uses native HTML input on web to prevent
 * page refresh issues with React Native Web's TextInput
 */
export function WebSafeInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  className,
  inputType = 'text',
  ...rest
}: WebSafeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // On web, use native HTML input
  if (Platform.OS === 'web') {
    // Flatten style if it's an array
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : (style || {}) as Record<string, unknown>;

    return (
      <input
        ref={inputRef}
        type={inputType === 'number' ? 'text' : inputType}
        inputMode={inputType === 'number' ? 'numeric' : undefined}
        value={value}
        onChange={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onChangeText(e.target.value);
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: 14,
          outline: 'none',
          border: 'none',
          backgroundColor: flatStyle.backgroundColor as string || '#e0f2fe',
          color: flatStyle.color as string || '#1e293b',
          letterSpacing: flatStyle.letterSpacing as number || 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      />
    );
  }

  // On native, use regular TextInput
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      style={style}
      className={className}
      {...rest}
    />
  );
}
