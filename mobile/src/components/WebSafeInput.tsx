import { Platform, TextInput, TextInputProps } from 'react-native';
import { useRef, useEffect, useCallback } from 'react';

interface WebSafeInputProps extends Omit<TextInputProps, 'onChange'> {
  value: string;
  onChangeText: (text: string) => void;
  inputType?: 'text' | 'password' | 'number';
}

/** Debounce ms for syncing value prop to DOM — avoids clearing input on every keystroke when parent re-renders with stale value. */
const SYNC_DEBOUNCE_MS = 80;

/**
 * A TextInput wrapper that uses native HTML input on web to prevent
 * page refresh issues with React Native Web's TextInput.
 * Uses uncontrolled input pattern on web to avoid React re-renders.
 * Debounces prop→DOM sync so stale parent re-renders don't clear the input on every keystroke.
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
  const lastValueRef = useRef(value);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle input changes using native event listener (avoids React synthetic events)
  const handleInput = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    lastValueRef.current = newValue;
    onChangeText(newValue);
  }, [onChangeText]);

  // Sync value to input only when it changes externally (e.g. form reset).
  // Debounce so we don't overwrite the DOM with stale value during rapid parent re-renders
  // (which would clear the input on every keystroke).
  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null;
      if (inputRef.current && value !== lastValueRef.current) {
        inputRef.current.value = value || '';
        lastValueRef.current = value;
      }
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [value]);

  // Set up native event listener once ref is available (after mount)
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.addEventListener('input', handleInput);
    return () => input.removeEventListener('input', handleInput);
  }, [handleInput]);

  // On web, use native HTML input with uncontrolled pattern
  if (Platform.OS === 'web') {
    // Flatten style if it's an array
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style)
      : (style || {}) as Record<string, unknown>;
    const maxLength = rest.maxLength;

    return (
      <input
        ref={inputRef}
        type={inputType === 'password' ? 'password' : 'text'}
        inputMode={inputType === 'number' ? 'numeric' : undefined}
        defaultValue={value || ''}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-form-type="other"
        data-lpignore="true"
        onKeyDown={(e) => {
          // Prevent form submission and any default Enter behavior (e.g. in PWA)
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{
          flex: 1,
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: flatStyle.fontSize as number || 14,
          outline: 'none',
          border: 'none',
          backgroundColor: flatStyle.backgroundColor as string || '#e0f2fe',
          color: flatStyle.color as string || '#1e293b',
          letterSpacing: flatStyle.letterSpacing as number || 0,
          textAlign: flatStyle.textAlign as 'left' | 'center' | 'right' || 'left',
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
      secureTextEntry={inputType === 'password'}
      keyboardType={inputType === 'number' ? 'numeric' : 'default'}
      {...rest}
    />
  );
}
