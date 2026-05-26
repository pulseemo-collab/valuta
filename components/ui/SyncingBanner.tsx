import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/lib/store';
import { C } from '@/constants/colors';

interface Props {
  style?: ViewStyle;
}

export function SyncingBanner({ style }: Props) {
  const { state, clearSaveError, retrySync } = useStore();

  if (state.syncing) {
    return (
      <View style={[styles.banner, styles.syncBanner, style]}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.syncText}>Duke sinkronizuar të dhënat...</Text>
      </View>
    );
  }

  if (state.saveError) {
    return (
      <View style={[styles.banner, styles.errorBanner, style]}>
        <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
        <Text style={styles.errorText} numberOfLines={2}>{state.saveError}</Text>
        <TouchableOpacity
          onPress={retrySync}
          style={styles.retryBtn}
          hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}
        >
          <Ionicons name="refresh-outline" size={12} color={C.danger} />
          <Text style={styles.retryText}>Riprovo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={clearSaveError}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 4 }}
        >
          <Ionicons name="close" size={14} color={C.danger} />
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBanner: {
    backgroundColor: C.primaryBg,
    borderColor: C.primaryBorder,
  },
  errorBanner: {
    backgroundColor: C.dangerBgSubtle,
    borderColor: C.dangerBorder,
  },
  syncText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: C.primaryLight,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: C.danger,
    lineHeight: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: C.dangerBorder,
    flexShrink: 0,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.danger,
  },
});
