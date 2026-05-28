import React, { ReactNode, useState, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { useThemeColors, type ColorPalette } from '@/lib/ThemeContext';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onRightIconPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: TextStyle;
  containerStyle?: ViewStyle;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  autoFocus,
  maxLength,
  editable = true,
  style,
  containerStyle,
}: InputProps) {
  const C = useThemeColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.row,
          focused && styles.rowFocused,
          !editable && styles.rowDisabled,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon && (
          onRightIconPress ? (
            <TouchableOpacity onPress={onRightIconPress} style={styles.iconRight} activeOpacity={0.7}>
              {rightIcon}
            </TouchableOpacity>
          ) : (
            <View style={styles.iconRight}>{rightIcon}</View>
          )
        )}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSub,
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.elevated,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: C.border,
      paddingHorizontal: 14,
      minHeight: 54,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 3,
    },
    rowFocused: {
      borderColor: C.primary,
      backgroundColor: C.card,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 5,
    },
    rowDisabled: {
      opacity: 0.48,
    },
    iconLeft: {
      marginRight: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconRight: {
      marginLeft: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: C.text,
      paddingVertical: 12,
    },
    hint: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 7,
      paddingHorizontal: 2,
      lineHeight: 18,
    },
  });
}
