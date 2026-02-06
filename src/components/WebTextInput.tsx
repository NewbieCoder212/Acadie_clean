import { Platform, TextInput, TextInputProps } from 'react-native';
import React, { useRef, useEffect } from 'react';

interface WebTextInputProps extends TextInputProps {
  webStyle?: React.CSSProperties;
}

/**
 * A TextInput that uses native HTML input on web to avoid refresh issues
 */
export function WebTextInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  webStyle,
  secureTextEntry,
  ...props
}: WebTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // On web, use native HTML input
  if (Platform.OS === 'web') {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onChangeText?.(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent form submission on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    };

    // Flatten style if it's an array
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;

    return (
      <input
        ref={inputRef}
        type={secureTextEntry ? 'password' : 'text'}
        value={value || ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          outline: 'none',
          border: 'none',
          fontFamily: 'inherit',
          ...(flatStyle as React.CSSProperties),
          ...webStyle,
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
      secureTextEntry={secureTextEntry}
      style={style}
      {...props}
    />
  );
}
