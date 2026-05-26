import React, { ReactNode, useRef } from 'react';
import {
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isPrimary = variant === 'primary';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      overshootClamping: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? C.primary : C.white} size="small" />
      ) : (
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text style={[styles.text, sizeTextStyles[size], variantTextStyles[variant]]}>
            {children}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </View>
  );

  const webStyle = Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as any) : {};
  const glowStyle = isPrimary && !disabled ? styles.primaryGlow : undefined;

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && styles.fullWidth,
        glowStyle,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed, hovered }: any) => [
          styles.base,
          variantStyles[variant],
          !isPrimary && sizeStyles[size],
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          !disabled && !isPrimary && hovered && variantHoveredStyles[variant],
          pressed && styles.pressed,
          webStyle,
        ]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={GRADIENTS.primaryShine}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradient, sizeStyles[size]]}
          >
            {content}
          </LinearGradient>
        ) : (
          content
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.88 },
  primaryGlow: {
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 8,
  },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: 9, paddingHorizontal: 15 },
  md: { paddingVertical: 14, paddingHorizontal: 20 },
  lg: { paddingVertical: 17, paddingHorizontal: 28 },
};

const sizeTextStyles: Record<Size, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16, letterSpacing: 0.2 },
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: C.primary },
  secondary: {
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: {
    backgroundColor: C.dangerBgSubtle,
    borderWidth: 1.5,
    borderColor: C.dangerBorder,
  },
};

const variantHoveredStyles: Record<Variant, ViewStyle> = {
  primary: {},
  secondary: { backgroundColor: C.floating, borderColor: C.borderGlassLight },
  outline: { backgroundColor: C.primaryBgSubtle },
  ghost: { backgroundColor: C.elevated },
  danger: { backgroundColor: C.dangerBg },
};

const variantTextStyles: Record<Variant, TextStyle> = {
  primary: { color: C.white },
  secondary: { color: C.text },
  outline: { color: C.primary },
  ghost: { color: C.textSub },
  danger: { color: C.danger },
};
