import { Platform, TextInput, TextInputProps } from 'react-native';
import React, { useRef, useEffect, useCallback } from 'react';

interface WebTextInputProps extends TextInputProps {
  webStyle?: React.CSSProperties;
}

/**
 * Web-only input component using native HTML input
 */
function WebOnlyInput({
  value,
  onChangeText,
  placeholder,
  style,
  webStyle,
  secureTextEntry,
}: WebTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);

  const handleInput = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    lastValueRef.current = newValue;
    onChangeText?.(newValue);
  }, [onChangeText]);

  // Sync value to input only when it changes externally
  useEffect(() => {
    if (inputRef.current && value !== lastValueRef.current) {
      inputRef.current.value = value || '';
      lastValueRef.current = value;
    }
  }, [value]);

  // Use native event listener to avoid React synthetic event issues
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.addEventListener('input', handleInput);
      return () => {
        input.removeEventListener('input', handleInput);
      };
    }
  }, [handleInput]);

  // Flatten style if it's an array
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;

  return (
    <input
      ref={inputRef}
      type={secureTextEntry ? 'password' : 'text'}
      defaultValue={value || ''}
      placeholder={placeholder}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-form-type="other"
      data-lpignore="true"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      }}
      style={{
        outline: 'none',
        border: 'none',
        fontFamily: 'inherit',
        background: 'transparent',
        ...(flatStyle as React.CSSProperties),
        ...webStyle,
      }}
    />
  );
}

/**
 * A TextInput that uses native HTML input on web to avoid refresh issues
 * Uses uncontrolled input pattern on web to prevent React re-render issues
 */
export function WebTextInput(props: WebTextInputProps) {
  const {
    value,
    onChangeText,
    placeholder,
    placeholderTextColor,
    style,
    secureTextEntry,
    ...restProps
  } = props;

  // On web, use native HTML input component
  if (Platform.OS === 'web') {
    return <WebOnlyInput {...props} />;
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
      {...restProps}
    />
  );
}
