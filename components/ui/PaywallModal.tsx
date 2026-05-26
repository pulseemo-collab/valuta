import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/colors';
import type { AppMode } from '@/types';

const PRO_COLOR = '#A78BFA';
const PRO_BG = 'rgba(167,139,250,0.10)';
const PRO_BORDER = 'rgba(167,139,250,0.24)';
const PRO_DARK = '#7C3AED';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  blockedMode: AppMode;
}

export function PaywallModal({ visible, onClose, blockedMode }: PaywallModalProps) {
  const isBusiness = blockedMode === 'business';

  const title = isBusiness ? 'Mënyra e Biznesit' : 'Mënyra Personale';
  const icon: keyof typeof Ionicons.glyphMap = isBusiness ? 'briefcase-outline' : 'person-outline';
  const iconColor = isBusiness ? C.accentLight : C.primary;
  const iconBg = isBusiness ? C.accentBg : C.primaryBg;
  const iconBorder = isBusiness ? C.accentBorder : C.primaryBorder;

  const description = isBusiness
    ? 'Mënyra e Biznesit kërkon planin Biznes ose Valuta Pro.'
    : 'Mënyra Personale kërkon planin Personal ose Valuta Pro.';

  const plans = isBusiness
    ? [
        { name: 'Biznes', price: '2,990 Lekë / muaj', color: C.accentLight, bg: C.accentBg, border: C.accentBorder },
        { name: 'Valuta Pro', price: '3,990 Lekë / muaj', color: PRO_COLOR, bg: PRO_BG, border: PRO_BORDER },
      ]
    : [
        { name: 'Personal', price: '299 Lekë / muaj', color: C.primary, bg: C.primaryBg, border: C.primaryBorder },
        { name: 'Valuta Pro', price: '3,990 Lekë / muaj', color: PRO_COLOR, bg: PRO_BG, border: PRO_BORDER },
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Top shimmer line */}
          <View style={styles.shimmer} />

          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
            <Ionicons name={icon} size={28} color={iconColor} />
          </View>

          {/* Lock badge */}
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={11} color={C.textMuted} />
            <Text style={styles.lockBadgeText}>Akses i kufizuar</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {/* Plan options */}
          <View style={styles.plans}>
            {plans.map((plan) => (
              <View key={plan.name} style={[styles.planRow, { borderColor: plan.border }]}>
                <LinearGradient
                  colors={[plan.bg, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                </View>
                <View style={[styles.planArrow, { backgroundColor: plan.bg, borderColor: plan.border }]}>
                  <Ionicons name="arrow-forward" size={12} color={plan.color} />
                </View>
              </View>
            ))}
          </View>

          {/* Coming soon CTA */}
          <View style={styles.comingSoon}>
            <LinearGradient
              colors={['rgba(167,139,250,0.08)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="time-outline" size={15} color={PRO_COLOR} />
            <Text style={styles.comingSoonText}>Pagesat do aktivizohen së shpejti</Text>
          </View>

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.78}>
            <Text style={styles.closeBtnText}>Mbyll</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    paddingBottom: 40,
    gap: 16,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 4,
  },

  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: C.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 21,
  },

  plans: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  planInfo: { gap: 3 },
  planName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  planPrice: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
  },
  planArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  comingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PRO_BORDER,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  comingSoonText: {
    fontSize: 13,
    color: PRO_COLOR,
    fontWeight: '600',
  },

  closeBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: C.elevated,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textSub,
  },
});
