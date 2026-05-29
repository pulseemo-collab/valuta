import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  ActivityIndicator,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import {
  getBiometricStatus,
  loadBiometricEnabled,
  saveBiometricEnabled,
  type BiometricStatus,
} from '@/lib/biometricAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { CURRENCIES } from '@/constants/currencies';
import { C as DARK_C, GRADIENTS } from '@/constants/colors';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useNotifContext } from '@/lib/NotificationContext';
import { useThemeColors, useIsLight } from '@/lib/ThemeContext';
import { useTranslation } from '@/lib/i18n';
import {
  loadEmailReportPrefs,
  saveEmailReportPrefs,
  type EmailReportPrefs,
  type ReportFormat,
  type ReportFrequency,
  DEFAULT_EMAIL_PREFS,
} from '@/lib/emailReportPrefs';
import type { AppMode, AppTheme, Currency } from '@/types';

// ── SettingRow ────────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  badge?: string;
  C: ReturnType<typeof useThemeColors>;
}

function SettingRow({
  icon, iconColor, iconBg, title, subtitle, onPress, rightElement, disabled = false, badge, C,
}: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        sr.settingRow,
        disabled && sr.disabled,
        !disabled && hovered && { backgroundColor: C.elevated },
        !disabled && pressed && { opacity: 0.72 },
      ]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={[sr.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={disabled ? C.textMuted : iconColor} />
      </View>
      <View style={sr.settingText}>
        <View style={sr.settingTitleRow}>
          <Text style={[sr.settingTitle, { color: disabled ? C.textSub : C.text }]}>{title}</Text>
          {badge && (
            <Badge size="sm" color={C.accentLight} bgColor={C.accentBg}>{badge}</Badge>
          )}
        </View>
        {subtitle && <Text style={[sr.settingSubtitle, { color: C.textMuted }]}>{subtitle}</Text>}
      </View>
      {rightElement ?? (
        <Ionicons
          name="chevron-forward"
          size={14}
          color={disabled ? C.textFaint : C.textMuted}
        />
      )}
    </Pressable>
  );
}

const sr = StyleSheet.create({
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderRadius: 10,
    marginHorizontal: -6, paddingHorizontal: 6,
  },
  settingIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  settingText: { flex: 1 },
  settingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingTitle: { fontSize: 14, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  disabled: { opacity: 0.48 },
});

// ── Info Modal ─────────────────────────────────────────────────────────────────

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  children: React.ReactNode;
  C: ReturnType<typeof useThemeColors>;
}

function InfoModal({ visible, onClose, title, icon, iconColor, iconBg, borderColor, children, C }: InfoModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[im.overlay, { backgroundColor: C.overlay }]}>
        <View style={[im.box, { backgroundColor: C.card, borderColor }]}>
          <View style={[im.topEdge, { backgroundColor: borderColor }]} />
          <View style={im.header}>
            <View style={[im.iconWrap, { backgroundColor: iconBg, borderColor }]}>
              <Ionicons name={icon} size={22} color={iconColor} />
            </View>
            <Text style={[im.title, { color: C.text }]}>{title}</Text>
            <Pressable onPress={onClose} style={[im.closeBtn, { backgroundColor: C.elevated }]}>
              <Ionicons name="close" size={16} color={C.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
          >
            {children}
          </ScrollView>
          <TouchableOpacity style={[im.doneBtn, { backgroundColor: C.elevated, borderColor: C.border }]} onPress={onClose} activeOpacity={0.8}>
            <Text style={[im.doneBtnText, { color: C.textSub }]}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const im = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  box: {
    width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20,
    gap: 16, overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55, shadowRadius: 36, elevation: 18,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  doneBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontSize: 15, fontWeight: '700' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRO_COLOR = '#A78BFA';
const PRO_BG = 'rgba(167,139,250,0.10)';
const PRO_BORDER = 'rgba(167,139,250,0.24)';

function getPlanLabel(plan: string, t?: (k: import('@/lib/i18n').TKey) => string) {
  if (plan === 'pro') return t ? t('planPro') : 'Valuta Pro';
  if (plan === 'business') return t ? t('planBusiness') : 'Biznes';
  return t ? t('planPersonal') : 'Personal';
}

function getPlanColors(plan: string, C: ReturnType<typeof useThemeColors>) {
  if (plan === 'pro') return { color: PRO_COLOR, bg: PRO_BG, border: PRO_BORDER, dot: PRO_COLOR };
  if (plan === 'business') return { color: C.accentLight, bg: C.accentBgSubtle, border: C.accentBorder, dot: C.accentLight };
  return { color: C.primary, bg: C.primaryBgSubtle, border: C.primaryBorder, dot: C.primary };
}

const THEME_OPTION_KEYS: { key: AppTheme; tKey: 'themeDark' | 'themeLight' | 'themeSystem'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dark', tKey: 'themeDark', icon: 'moon-outline' },
  { key: 'light', tKey: 'themeLight', icon: 'sunny-outline' },
  { key: 'system', tKey: 'themeSystem', icon: 'phone-portrait-outline' },
];

function formatLastSync(iso: string | null, lang: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const en = lang === 'en';
  if (diffMins < 1) return en ? 'Just now' : 'Tani';
  if (diffMins < 60) return en ? `${diffMins} min ago` : `${diffMins} min më parë`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return en ? `${diffHrs} hr ago` : `${diffHrs} orë më parë`;
  const diffDays = Math.floor(diffHrs / 24);
  return en ? `${diffDays} days ago` : `${diffDays} ditë më parë`;
}

// ── makeStyles ────────────────────────────────────────────────────────────────

function makeStyles(C: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
    pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.7 },

    profileCard: {
      flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
      gap: 12, padding: 18, borderRadius: 22, borderWidth: 1,
      borderColor: 'rgba(59,130,246,0.20)', overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25, shadowRadius: 20, elevation: 10, position: 'relative',
    },
    profileCardShimmer: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    profileAvatarWrap: { position: 'relative' },
    profileAvatarGlow: {
      position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
      borderRadius: 20, backgroundColor: C.primaryGlow, opacity: 0.22,
    },
    profileAvatar: {
      width: 54, height: 54, borderRadius: 16,
      backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center',
      borderWidth: 1.5, borderColor: C.primaryBorder,
    },
    avatarText: { fontSize: 17, fontWeight: '800', color: C.primary },
    profileInfo: { flex: 1, gap: 4 },
    profileName: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
    profileEmail: { fontSize: 12, color: C.textMuted },
    profileBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 5, paddingHorizontal: 10,
      backgroundColor: C.primaryBgSubtle, borderRadius: 9, borderWidth: 1, borderColor: C.primaryBorder,
    },
    profileBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.primary },
    profileBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },

    section: { gap: 8 },
    sectionTitle: {
      fontSize: 10, fontWeight: '700', color: C.textMuted,
      letterSpacing: 1.2, paddingLeft: 4, textTransform: 'uppercase',
    },
    currencyDesc: { fontSize: 13, color: C.textMuted, marginBottom: 14 },
    currencyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    currencyOption: {
      flex: 1, minWidth: 90, flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.elevated, position: 'relative', overflow: 'hidden',
    },
    currencyOptionActive: { borderColor: C.primaryBorder },
    currencySymbol: { fontSize: 18, fontWeight: '800', color: C.textMuted },
    currencySymbolActive: { color: C.primary },
    currencyCode: { fontSize: 13, fontWeight: '700', color: C.textSub },
    currencyCodeActive: { color: C.primary },
    currencyName: { fontSize: 10, color: C.textMuted, maxWidth: 70 },
    currencyCheck: {
      position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9,
      backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    },

    rowSeparator: { height: 1, backgroundColor: C.border, marginHorizontal: -16, opacity: 0.65 },

    notifSubSection: {
      backgroundColor: C.surface, borderRadius: 12, marginTop: 4, marginBottom: 2,
      paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border, gap: 2,
    },
    notifSubRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 8, gap: 8,
    },
    notifSubLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    notifSubIcon: {
      width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, flexShrink: 0,
    },
    notifSubTitle: { fontSize: 13, fontWeight: '600', color: C.text },
    notifSubDesc: { fontSize: 11, color: C.textMuted, marginTop: 1 },
    subSwitch: {
      flexShrink: 0,
      transform: Platform.OS === 'ios' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
    },
    dayPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 34 },
    dayPickerLabel: { fontSize: 11, color: C.textMuted, flex: 1 },
    dayPills: { flexDirection: 'row', gap: 6 },
    dayPill: {
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    },
    dayPillActive: { backgroundColor: C.accentBgSubtle, borderColor: C.accentBorder },
    dayPillText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    dayPillTextActive: { color: C.accentLight },

    prefBlock: { paddingVertical: 10, gap: 10 },
    prefBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    themeChipRow: { flexDirection: 'row', gap: 8, paddingLeft: 50 },
    themeChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, paddingVertical: 9, paddingHorizontal: 6,
      borderRadius: 11, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.elevated, overflow: 'hidden', position: 'relative',
    },
    themeChipActive: { borderColor: C.primaryBorder },
    themeChipText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
    themeChipTextActive: { color: C.primary },

    langChipRow: { flexDirection: 'row', gap: 8, paddingLeft: 50 },
    langChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 10, paddingHorizontal: 10,
      borderRadius: 11, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.elevated, overflow: 'hidden', position: 'relative',
    },
    langChipActive: { borderColor: C.primaryBorder },
    langFlag: { fontSize: 16 },
    langChipText: { flex: 1, fontSize: 12, fontWeight: '600', color: C.textMuted },
    langChipTextActive: { color: C.primary },
    langCheckmark: {
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    },

    modeDesc: { fontSize: 13, color: C.textMuted, lineHeight: 18 },
    planIndicator: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, overflow: 'hidden', position: 'relative',
    },
    planIndicatorText: { fontSize: 12, fontWeight: '700' },
    modeRow: { flexDirection: 'row', gap: 10 },
    modeOption: {
      flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 10,
      borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.surface, overflow: 'hidden', position: 'relative',
    },
    modeOptionActivePersonal: { borderColor: C.primaryBorder },
    modeOptionActiveBusiness: { borderColor: C.accentBorder },
    modeOptionLocked: { opacity: 0.52 },
    modeIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    modeLabel: { fontSize: 14, fontWeight: '800', color: C.textSub, letterSpacing: -0.2 },
    modeSub: { fontSize: 11, color: C.textMuted, fontWeight: '500', textAlign: 'center' },
    modeCheck: {
      position: 'absolute', top: 8, right: 8,
      width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center',
    },
    modeLockBadge: {
      position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9,
      backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
      justifyContent: 'center', alignItems: 'center',
    },
    bizFeaturesBox: {
      borderRadius: 12, borderWidth: 1, borderColor: C.accentBorder,
      paddingVertical: 12, paddingHorizontal: 14,
      gap: 10, overflow: 'hidden', position: 'relative',
    },
    bizFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bizFeatureText: { fontSize: 12, color: C.textSub, fontWeight: '500', flex: 1 },

    logoutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5,
      borderColor: C.dangerBorder, backgroundColor: C.dangerBgSubtle,
    },
    logoutBtnLoading: { opacity: 0.6 },
    logoutText: { fontSize: 15, fontWeight: '700', color: C.danger },
    logoutError: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: 10, backgroundColor: C.dangerBgSubtle,
      borderWidth: 1, borderColor: C.dangerBorder,
    },
    logoutErrorText: { fontSize: 13, color: C.danger, flex: 1 },

    logoutModalOverlay: {
      flex: 1, backgroundColor: C.overlayStrong,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
    },
    logoutModalBox: {
      width: '100%', maxWidth: 340, backgroundColor: C.card,
      borderRadius: 24, borderWidth: 1, borderColor: C.dangerBorder,
      paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24,
      alignItems: 'center', gap: 18, overflow: 'hidden', position: 'relative',
      shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.55, shadowRadius: 40, elevation: 20,
    },
    logoutModalTopEdge: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      backgroundColor: 'rgba(239,68,68,0.30)',
    },
    logoutModalIconWrap: {
      width: 60, height: 60, borderRadius: 18,
      backgroundColor: C.dangerBgSubtle, borderWidth: 1.5, borderColor: C.dangerBorder,
      justifyContent: 'center', alignItems: 'center',
    },
    logoutModalTitle: {
      fontSize: 18, fontWeight: '700', color: C.text,
      textAlign: 'center', lineHeight: 26, letterSpacing: -0.3,
    },
    logoutModalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
    logoutModalCancelBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
      borderColor: C.border, backgroundColor: C.elevated, alignItems: 'center',
    },
    logoutModalCancelText: { fontSize: 15, fontWeight: '700', color: C.textSub },
    logoutModalConfirmBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      backgroundColor: C.dangerBgSubtle, borderWidth: 1.5, borderColor: C.dangerBorder, alignItems: 'center',
    },
    logoutModalConfirmText: { fontSize: 15, fontWeight: '700', color: C.danger },

    // ── Info/Legal shared ─────────────────────────────────────────────────────
    infoSection: { gap: 10 },
    infoLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    infoLogoBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    infoLogoText: { fontSize: 22, fontWeight: '900', color: '#fff' },
    infoAppName: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
    infoVersion: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
    infoBodyText: { fontSize: 13, color: C.textSub, lineHeight: 20 },
    infoFeatureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    infoFeatureItem: { alignItems: 'center', gap: 6, width: '22%' as any },
    infoFeatureIcon: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: C.primaryBgSubtle,
      borderWidth: 1, borderColor: C.primaryBorder, justifyContent: 'center', alignItems: 'center',
    },
    infoFeatureLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', textAlign: 'center' },
    infoCopyright: { fontSize: 11, color: C.textFaint, textAlign: 'center', paddingVertical: 4 },
    legalItem: { gap: 6 },
    legalItemTitle: { fontSize: 13, fontWeight: '700', color: C.text },
    legalItemBody: { fontSize: 12, color: C.textSub, lineHeight: 18 },
    infoNote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 7,
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    infoNoteText: { flex: 1, fontSize: 11, color: C.textFaint, lineHeight: 16 },

    // ── Profile modal ────────────────────────────────────────
    profileModalAvatar: { alignItems: 'center', gap: 6, paddingVertical: 8 },
    profileModalAvatarInner: {
      width: 64, height: 64, borderRadius: 20, backgroundColor: C.primaryBg,
      borderWidth: 2, borderColor: C.primaryBorder, justifyContent: 'center', alignItems: 'center',
    },
    profileModalAvatarText: { fontSize: 22, fontWeight: '800', color: C.primary },
    profileModalName: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    profileModalEmail: { fontSize: 12, color: C.textMuted },
    profileModalPlanBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignSelf: 'center',
    },
    profileModalPlanText: { fontSize: 12, fontWeight: '700' },
    profileModalRows: { gap: 4 },
    profileModalRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    },
    profileModalRowIcon: {
      width: 24, height: 24, borderRadius: 7,
      backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center',
    },
    profileModalRowLabel: { fontSize: 12, color: C.textMuted, width: 70 },
    profileModalRowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right' },

    editNameSection: { gap: 8 },
    editNameLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    editNameInput: {
      paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.border, backgroundColor: C.elevated,
      fontSize: 14, fontWeight: '600', color: C.text,
    },
    editNameInputFocused: { borderColor: C.primaryBorder },
    saveNameBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 12, borderRadius: 12,
      backgroundColor: C.primary,
    },
    saveNameBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    successNote: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
      backgroundColor: C.primaryBgSubtle, borderWidth: 1, borderColor: C.primaryBorder,
    },
    successNoteText: { fontSize: 12, fontWeight: '600', color: C.primary },

    // ── Security modal ───────────────────────────────────────
    securityActionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 12, borderRadius: 12,
      backgroundColor: C.primary,
    },
    securityActionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    securityInput: {
      paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.border, backgroundColor: C.elevated,
      fontSize: 14, color: C.text, marginTop: 8,
    },
    biometricStatusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
      backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    },
    biometricStatusText: { flex: 1, fontSize: 13, color: C.textSub, fontWeight: '500' },

    // ── Sync modal ───────────────────────────────────────────
    syncStatusCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 12, borderWidth: 1,
    },
    syncStatusDot: { width: 8, height: 8, borderRadius: 4 },
    syncStatusTitle: { fontSize: 14, fontWeight: '700' },
    syncStatusSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
    syncNowBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 13, borderRadius: 12,
      borderWidth: 1, borderColor: C.warningBorder, overflow: 'hidden', position: 'relative',
    },
    syncNowText: { fontSize: 14, fontWeight: '700', color: C.warning },

    // ── Email report modal ───────────────────────────────────
    emailReportSection: { gap: 8 },
    emailReportLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    emailReportInput: {
      paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.border, backgroundColor: C.elevated,
      fontSize: 14, color: C.text,
    },
    optionRow: { flexDirection: 'row', gap: 8 },
    optionChip: {
      flex: 1, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 11,
      borderWidth: 1.5, borderColor: C.border, backgroundColor: C.elevated,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
    },
    optionChipActive: { borderColor: C.primaryBorder },
    optionChipText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    optionChipTextActive: { color: C.primary },
    saveReportBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: C.primary,
    },
    saveReportBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Cilesimet() {
  const router = useRouter();
  const C = useThemeColors();
  const isLight = useIsLight();
  const { t, lang } = useTranslation();
  const { state, setCurrency, setMode, updateRecurringSettings, setTheme, setLanguage, syncNow, setUserName } = useStore();
  const { prefs, updatePrefs } = useNotifContext();
  const rs = state.recurringSettings;
  const styles = useMemo(() => makeStyles(C), [C]);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [paywallMode, setPaywallMode] = useState<AppMode | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ── Modal visibility ──────────────────────────────────────
  const [showRrethValuta, setShowRrethValuta] = useState(false);
  const [showKushtet, setShowKushtet] = useState(false);
  const [showPrivatesia, setShowPrivatesia] = useState(false);
  const [showProfili, setShowProfili] = useState(false);
  const [showSiguria, setShowSiguria] = useState(false);
  const [showRuajtja, setShowRuajtja] = useState(false);
  const [showEmailReport, setShowEmailReport] = useState(false);

  // ── Profile edit state ────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editNameFocused, setEditNameFocused] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // ── Security / password reset state ──────────────────────
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // ── Biometric state ───────────────────────────────────────
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);

  // ── Sync state ────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const prevSyncingRef = useRef(false);

  // ── Email report prefs ────────────────────────────────────
  const [emailPrefs, setEmailPrefs] = useState<EmailReportPrefs>({ ...DEFAULT_EMAIL_PREFS });
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);
  const [emailPrefsSaved, setEmailPrefsSaved] = useState(false);

  // Load email prefs on mount
  useEffect(() => {
    loadEmailReportPrefs().then((p) => {
      setEmailPrefs(p);
    });
  }, []);

  // Pre-fill reset email
  useEffect(() => {
    if (state.userEmail) setResetEmail(state.userEmail);
  }, [state.userEmail]);

  // Pre-fill edit name
  useEffect(() => {
    if (showProfili) {
      setEditName(state.userName ?? '');
      setNameSaved(false);
      setNameError(null);
    }
  }, [showProfili, state.userName]);

  // Pre-fill email report with user email if none saved
  useEffect(() => {
    if (showEmailReport && !emailPrefs.email && state.userEmail) {
      setEmailPrefs((p) => ({ ...p, email: state.userEmail! }));
    }
  }, [showEmailReport]);

  // Load biometric status when Security modal opens
  useEffect(() => {
    if (!showSiguria) return;
    Promise.all([getBiometricStatus(), loadBiometricEnabled()]).then(([status, enabled]) => {
      setBioStatus(status);
      setBioEnabled(enabled);
    });
  }, [showSiguria]);

  // Track sync completion via state.syncing transitions
  useEffect(() => {
    if (prevSyncingRef.current && !state.syncing && isSyncing) {
      setIsSyncing(false);
      if (!state.saveError) {
        setSyncSuccess(true);
        setSyncError(null);
        const tid = setTimeout(() => setSyncSuccess(false), 3000);
        return () => clearTimeout(tid);
      } else {
        setSyncError(t('syncError'));
      }
    }
    prevSyncingRef.current = state.syncing;
  }, [state.syncing, isSyncing, state.saveError]);

  const handleCurrencySelect = (code: Currency) => { setCurrency(code); };

  const handleModePress = (requested: AppMode) => {
    const plan = state.plan;
    if (plan === 'pro') { setMode(requested); return; }
    if (plan === 'personal' && requested === 'personal') { setMode('personal'); return; }
    if (plan === 'business' && requested === 'business') { setMode('business'); return; }
    setPaywallMode(requested);
  };

  const userEmail = state.userEmail ?? '';
  const displayName = state.userName?.trim()
    ? state.userName.trim()
    : state.userEmail
    ? state.userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Valuta';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const performLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut();
    } catch {
      setIsLoggingOut(false);
      setLogoutError(t('setLogoutError'));
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;
    setShowLogoutModal(true);
  };

  const handleSyncNow = () => {
    if (isSyncing || state.syncing) return;
    setSyncError(null);
    setSyncSuccess(false);
    setIsSyncing(true);
    syncNow().catch(() => {
      setIsSyncing(false);
      setSyncError(t('syncError'));
    });
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { setNameError(t('profileNameError')); return; }
    setSavingName(true);
    setNameError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
      if (error) throw error;
      setUserName(trimmed);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch {
      setNameError(t('profileSaveError'));
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) { setResetError('Vendos email-in.'); return; }
    setSendingReset(true);
    setResetError(null);
    setResetSent(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message ?? 'Gabim. Provo përsëri.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleSaveEmailPrefs = async () => {
    if (!emailPrefs.email.trim()) return;
    setSavingEmailPrefs(true);
    await saveEmailReportPrefs({ ...emailPrefs, enabled: true, configuredAt: new Date().toISOString() });
    setEmailPrefs((p) => ({ ...p, enabled: true, configuredAt: new Date().toISOString() }));
    setSavingEmailPrefs(false);
    setEmailPrefsSaved(true);
    setTimeout(() => setEmailPrefsSaved(false), 3000);
  };

  const themeLabel = state.theme === 'dark' ? t('themeDark') : state.theme === 'system' ? t('themeSystem') : t('themeLight');

  const profileCardGradient: string[] = isLight
    ? ['#EEF6FF', '#F0F9FF', '#FFFFFF']
    : ['#0E2540', '#091830', '#060B18'];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>{t('settingsTitle')}</Text>

        {/* Profile Card */}
        <LinearGradient
          colors={profileCardGradient}
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.profileCardShimmer} />
          <View style={styles.profileAvatarWrap}>
            <View style={styles.profileAvatarGlow} />
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>{initials || 'V'}</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
          </View>
          {(() => {
            const pc = getPlanColors(state.plan, C);
            return (
              <View style={[styles.profileBadge, { backgroundColor: pc.bg, borderColor: pc.border }]}>
                <View style={[styles.profileBadgeDot, { backgroundColor: pc.dot }]} />
                <Text style={[styles.profileBadgeText, { color: pc.color }]}>
                  {getPlanLabel(state.plan, t)}
                </Text>
              </View>
            );
          })()}
        </LinearGradient>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsCurrency')}</Text>
          <Card>
            <Text style={styles.currencyDesc}>{t('setCurrencyDesc')}</Text>
            <View style={styles.currencyOptions}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={[styles.currencyOption, state.preferredCurrency === curr.code && styles.currencyOptionActive]}
                  onPress={() => handleCurrencySelect(curr.code)}
                  activeOpacity={0.75}
                >
                  {state.preferredCurrency === curr.code && (
                    <LinearGradient colors={['rgba(16,185,129,0.14)', 'transparent']} style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={[styles.currencySymbol, state.preferredCurrency === curr.code && styles.currencySymbolActive]}>
                    {curr.symbol}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.currencyCode, state.preferredCurrency === curr.code && styles.currencyCodeActive]}>{curr.code}</Text>
                    <Text style={styles.currencyName} numberOfLines={1}>{curr.name}</Text>
                  </View>
                  {state.preferredCurrency === curr.code && (
                    <View style={styles.currencyCheck}><Ionicons name="checkmark" size={11} color={C.white} /></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsPrefs')}</Text>
          <Card style={{ gap: 0 }}>
            {/* Notifications toggle */}
            <SettingRow
              C={C}
              icon="notifications-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title={t('settingsNotifications')}
              subtitle={t('settingsNotifDesc')}
              rightElement={
                <Switch
                  value={prefs.enabled}
                  onValueChange={(v) => updatePrefs({ enabled: v })}
                  trackColor={{ false: C.elevated, true: C.primaryBgStrong }}
                  thumbColor={prefs.enabled ? C.primary : C.textMuted}
                  ios_backgroundColor={C.elevated}
                />
              }
            />
            {prefs.enabled && (
              <View style={styles.notifSubSection}>
                <View style={styles.notifSubRow}>
                  <View style={styles.notifSubLeft}>
                    <View style={[styles.notifSubIcon, { backgroundColor: C.warningBgSubtle, borderColor: C.warningBorder }]}>
                      <Ionicons name="warning-outline" size={12} color={C.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifSubTitle}>{t('setBudgetWarnings')}</Text>
                      <Text style={styles.notifSubDesc}>{t('setBudgetWarningsSub')}</Text>
                    </View>
                  </View>
                  <Switch
                    value={prefs.budgetWarnings}
                    onValueChange={(v) => updatePrefs({ budgetWarnings: v })}
                    trackColor={{ false: C.elevated, true: C.warningBg }}
                    thumbColor={prefs.budgetWarnings ? C.warning : C.textMuted}
                    ios_backgroundColor={C.elevated}
                    style={styles.subSwitch}
                  />
                </View>
                <View style={styles.notifSubRow}>
                  <View style={styles.notifSubLeft}>
                    <View style={[styles.notifSubIcon, { backgroundColor: C.accentBgSubtle, borderColor: C.accentBorder }]}>
                      <Ionicons name="time-outline" size={12} color={C.accentLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifSubTitle}>{t('setInactivityReminder')}</Text>
                      <Text style={styles.notifSubDesc}>{t('setInactivityReminderSub')}</Text>
                    </View>
                  </View>
                  <Switch
                    value={prefs.inactivityReminders}
                    onValueChange={(v) => updatePrefs({ inactivityReminders: v })}
                    trackColor={{ false: C.elevated, true: C.accentBg }}
                    thumbColor={prefs.inactivityReminders ? C.accentLight : C.textMuted}
                    ios_backgroundColor={C.elevated}
                    style={styles.subSwitch}
                  />
                </View>
                {prefs.inactivityReminders && (
                  <View style={styles.dayPickerRow}>
                    <Text style={styles.dayPickerLabel}>{t('setInactivityDaysLabel')}</Text>
                    <View style={styles.dayPills}>
                      {[2, 3, 5, 7].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.dayPill, prefs.inactivityDays === d && styles.dayPillActive]}
                          onPress={() => updatePrefs({ inactivityDays: d })}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.dayPillText, prefs.inactivityDays === d && styles.dayPillTextActive]}>{d}d</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.rowSeparator} />

            {/* Theme selector */}
            <View style={styles.prefBlock}>
              <View style={styles.prefBlockHeader}>
                <View style={[sr.settingIcon, { backgroundColor: C.elevated }]}>
                  <Ionicons name="moon-outline" size={16} color={C.textSub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sr.settingTitle, { color: C.text }]}>{t('settingsTheme')}</Text>
                  <Text style={[sr.settingSubtitle, { color: C.textMuted }]}>{themeLabel}</Text>
                </View>
              </View>
              <View style={styles.themeChipRow}>
                {THEME_OPTION_KEYS.map(({ key, tKey, icon }) => {
                  const isActive = state.theme === key;
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.themeChip,
                        isActive && styles.themeChipActive,
                        pressed && { opacity: 0.72 },
                      ]}
                      onPress={() => setTheme(key)}
                    >
                      {isActive && (
                        <LinearGradient
                          colors={['rgba(16,185,129,0.18)', 'transparent']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Ionicons name={icon} size={12} color={isActive ? C.primary : C.textMuted} />
                      <Text style={[styles.themeChipText, isActive && styles.themeChipTextActive]}>{t(tKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.rowSeparator} />

            {/* Language selector */}
            <View style={styles.prefBlock}>
              <View style={styles.prefBlockHeader}>
                <View style={[sr.settingIcon, { backgroundColor: C.primaryBg }]}>
                  <Ionicons name="language-outline" size={16} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sr.settingTitle, { color: C.text }]}>{t('settingsLang')}</Text>
                  <Text style={[sr.settingSubtitle, { color: C.textMuted }]}>
                  {state.language === 'sq' ? (lang === 'en' ? 'Albanian' : 'Shqip') : 'English'}
                </Text>
                </View>
              </View>
              <View style={styles.langChipRow}>
                {[
                  { key: 'sq' as const, label: lang === 'en' ? 'Albanian' : 'Shqip', code: 'AL' },
                  { key: 'en' as const, label: 'English', code: 'EN' },
                ].map(({ key, label, code }) => {
                  const isActive = state.language === key;
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.langChip,
                        isActive && styles.langChipActive,
                        pressed && { opacity: 0.72 },
                      ]}
                      onPress={() => setLanguage(key)}
                    >
                      {isActive && (
                        <LinearGradient colors={['rgba(16,185,129,0.18)', 'transparent']} style={StyleSheet.absoluteFill} />
                      )}
                      <Text style={styles.langFlag}>{code}</Text>
                      <Text style={[styles.langChipText, isActive && styles.langChipTextActive]}>{label}</Text>
                      {isActive && (
                        <View style={styles.langCheckmark}>
                          <Ionicons name="checkmark" size={10} color={C.white} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        {/* Recurring / Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsSubs')}</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              C={C}
              icon="repeat-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title={t('setRecurringAutoCreate')}
              subtitle={t('setRecurringAutoCreateSub')}
              rightElement={
                <Switch
                  value={rs.autoCreateOnDetect}
                  onValueChange={(v) => updateRecurringSettings({ autoCreateOnDetect: v })}
                  trackColor={{ false: C.elevated, true: 'rgba(59,130,246,0.35)' }}
                  thumbColor={rs.autoCreateOnDetect ? C.accentLight : C.textMuted}
                  ios_backgroundColor={C.elevated}
                />
              }
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="notifications-outline"
              iconColor={C.warning}
              iconBg={C.warningBgSubtle}
              title={t('setRecurringReminder')}
              subtitle={`${rs.reminderDaysBefore} ${lang === 'en' ? 'days before payment' : 'ditë para pagesës'}`}
              rightElement={
                <Switch
                  value={rs.reminderEnabled}
                  onValueChange={(v) => updateRecurringSettings({ reminderEnabled: v })}
                  trackColor={{ false: C.elevated, true: C.warningBg }}
                  thumbColor={rs.reminderEnabled ? C.warning : C.textMuted}
                  ios_backgroundColor={C.elevated}
                />
              }
            />
            {rs.reminderEnabled && (
              <View style={styles.notifSubSection}>
                <View style={styles.dayPickerRow}>
                  <Text style={styles.dayPickerLabel}>{t('setDaysBeforePayment')}</Text>
                  <View style={styles.dayPills}>
                    {[1, 2, 3, 5].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.dayPill, rs.reminderDaysBefore === d && styles.dayPillActive]}
                        onPress={() => updateRecurringSettings({ reminderDaysBefore: d })}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.dayPillText, rs.reminderDaysBefore === d && styles.dayPillTextActive]}>{d}d</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsAccount')}</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              C={C}
              icon="person-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title={t('settingsProfile')}
              subtitle={t('settingsProfileDesc')}
              onPress={() => setShowProfili(true)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="shield-checkmark-outline"
              iconColor={C.primary}
              iconBg={C.primaryBg}
              title={t('settingsSecurity')}
              subtitle={t('settingsSecurityDesc')}
              onPress={() => setShowSiguria(true)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="cloud-upload-outline"
              iconColor={C.warning}
              iconBg={C.warningBgSubtle}
              title={t('settingsStorage')}
              subtitle={t('settingsStorageDesc')}
              onPress={() => setShowRuajtja(true)}
            />
          </Card>
        </View>

        {/* Mode Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsMode')}</Text>
          <Card style={{ gap: 12 }}>
            <Text style={styles.modeDesc}>{t('setModeDesc')}</Text>
            {(() => {
              const pc = getPlanColors(state.plan, C);
              return (
                <View style={[styles.planIndicator, { borderColor: pc.border, backgroundColor: pc.bg }]}>
                  <LinearGradient colors={[pc.bg, 'transparent']} style={StyleSheet.absoluteFill} />
                  <Ionicons name="shield-checkmark-outline" size={13} color={pc.color} />
                  <Text style={[styles.planIndicatorText, { color: pc.color }]}>
                    {t('setPlanPrefix')} {getPlanLabel(state.plan, t)}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.modeRow}>
              {(['personal', 'business'] as AppMode[]).map((m) => {
                const isActive = state.mode === m;
                const isLocked = m === 'personal' ? state.plan === 'business' : state.plan === 'personal';
                const activeColor = m === 'personal' ? C.primary : C.accentLight;
                const activeBorder = m === 'personal' ? C.primaryBorder : C.accentBorder;
                const activeGradient = m === 'personal'
                  ? ['rgba(16,185,129,0.14)', 'rgba(16,185,129,0.04)'] as string[]
                  : ['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.04)'] as string[];
                return (
                  <Pressable
                    key={m}
                    style={({ pressed }) => [
                      styles.modeOption,
                      isActive && (m === 'personal' ? styles.modeOptionActivePersonal : styles.modeOptionActiveBusiness),
                      isLocked && styles.modeOptionLocked,
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={() => handleModePress(m)}
                  >
                    {isActive && <LinearGradient colors={activeGradient} style={StyleSheet.absoluteFill} />}
                    <View style={[
                      styles.modeIcon,
                      isActive
                        ? { backgroundColor: m === 'personal' ? C.primaryBgStrong : C.accentBg, borderColor: activeBorder }
                        : { backgroundColor: C.elevated, borderColor: C.border },
                    ]}>
                      <Ionicons
                        name={m === 'personal' ? 'person-outline' : 'briefcase-outline'}
                        size={18}
                        color={isActive ? activeColor : C.textMuted}
                      />
                    </View>
                    <Text style={[styles.modeLabel, isActive && { color: activeColor }]}>
                      {m === 'personal' ? t('setModePersonal') : t('setModeBusiness')}
                    </Text>
                    <Text style={styles.modeSub}>{m === 'personal' ? t('setModePersonalSub') : t('setModeBizSub')}</Text>
                    {isActive && (
                      <View style={[styles.modeCheck, { backgroundColor: m === 'personal' ? C.primary : C.accent }]}>
                        <Ionicons name="checkmark" size={10} color={C.white} />
                      </View>
                    )}
                    {isLocked && !isActive && (
                      <View style={styles.modeLockBadge}>
                        <Ionicons name="lock-closed" size={9} color={C.textFaint} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {state.mode === 'business' && (
              <View style={[styles.bizFeaturesBox, { backgroundColor: 'rgba(59,130,246,0.04)' }]}>
                {[
                  { icon: 'cube-outline' as const, text: t('setBizFeature1') },
                  { icon: 'bar-chart-outline' as const, text: t('setBizFeature2') },
                  { icon: 'document-text-outline' as const, text: t('setBizFeature3') },
                  { icon: 'receipt-outline' as const, text: t('setBizFeature4') },
                ].map(({ icon, text }) => (
                  <View key={text} style={styles.bizFeatureRow}>
                    <Ionicons name={icon} size={13} color={C.accentLight} />
                    <Text style={styles.bizFeatureText}>{text}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>

        {/* Export */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsExport')}</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              C={C}
              icon="share-outline"
              iconColor={C.primary}
              iconBg={C.primaryBg}
              title={t('settingsExportData')}
              subtitle={t('settingsExportDesc')}
              onPress={() => router.push('/export' as any)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="mail-outline"
              iconColor={emailPrefs.enabled ? C.primary : C.textSub}
              iconBg={emailPrefs.enabled ? C.primaryBg : C.elevated}
              title={t('settingsEmailReports')}
              subtitle={emailPrefs.enabled
                ? `${emailPrefs.frequency === 'once' ? t('setFreqOnce') : emailPrefs.frequency === 'weekly' ? t('setFreqWeekly') : t('setFreqMonthly')} · ${emailPrefs.format.toUpperCase()}`
                : t('settingsEmailReportsDesc')}
              onPress={() => setShowEmailReport(true)}
            />
          </Card>
        </View>

        {/* Other */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settingsOther')}</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              C={C}
              icon="information-circle-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title={t('settingsAbout')}
              subtitle={t('settingsAboutVer')}
              onPress={() => setShowRrethValuta(true)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="document-text-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title={t('settingsTerms')}
              onPress={() => setShowKushtet(true)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              C={C}
              icon="shield-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title={t('settingsPrivacy')}
              onPress={() => setShowPrivatesia(true)}
            />
          </Card>
        </View>

        {/* Logout */}
        {logoutError && (
          <View style={styles.logoutError}>
            <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
            <Text style={styles.logoutErrorText}>{logoutError}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.logoutBtn, isLoggingOut && styles.logoutBtnLoading]}
          onPress={handleLogout}
          activeOpacity={0.78}
          disabled={isLoggingOut}
        >
          {isLoggingOut
            ? <ActivityIndicator size="small" color={C.danger} />
            : <Ionicons name="log-out-outline" size={17} color={C.danger} />}
          <Text style={styles.logoutText}>
            {isLoggingOut ? t('setLoggingOut') : t('settingsLogout')}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Paywall ── */}
      <PaywallModal
        visible={paywallMode !== null}
        blockedMode={paywallMode ?? 'business'}
        onClose={() => setPaywallMode(null)}
      />

      {/* ── Logout confirm ── */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalBox}>
            <LinearGradient
              colors={['rgba(239,68,68,0.06)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.logoutModalTopEdge} />
            <View style={styles.logoutModalIconWrap}>
              <Ionicons name="log-out-outline" size={26} color={C.danger} />
            </View>
            <Text style={styles.logoutModalTitle}>{t('setLogoutConfirmTitle')}</Text>
            <View style={styles.logoutModalBtns}>
              <TouchableOpacity style={styles.logoutModalCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.75}>
                <Text style={styles.logoutModalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutModalConfirmBtn}
                onPress={() => { setShowLogoutModal(false); performLogout(); }}
                activeOpacity={0.78}
              >
                <Text style={styles.logoutModalConfirmText}>{t('setLogoutConfirmBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Rreth Valuta ── */}
      <InfoModal
        C={C}
        visible={showRrethValuta}
        onClose={() => setShowRrethValuta(false)}
        title={t('settingsAbout')}
        icon="information-circle-outline"
        iconColor={C.primary}
        iconBg={C.primaryBg}
        borderColor={C.primaryBorder}
      >
        <View style={styles.infoSection}>
          <View style={styles.infoLogoRow}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.infoLogoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.infoLogoText}>V</Text>
            </LinearGradient>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.infoAppName}>Valuta</Text>
              <Text style={styles.infoVersion}>{t('settingsAboutVer')}</Text>
            </View>
          </View>
        </View>
        <View style={styles.infoSection}>
          <Text style={styles.infoBodyText}>{t('setAboutBody1')}</Text>
          <Text style={styles.infoBodyText}>{t('setAboutBody2')}</Text>
        </View>
        <View style={styles.infoFeatureGrid}>
          {[
            { icon: 'wallet-outline', label: t('setAboutFeatureMonthly') },
            { icon: 'bar-chart-outline', label: t('setAboutFeatureReports') },
            { icon: 'repeat-outline', label: t('setAboutFeatureSubs') },
            { icon: 'flag-outline', label: t('setAboutFeatureGoals') },
          ].map(({ icon, label }) => (
            <View key={label} style={styles.infoFeatureItem}>
              <View style={styles.infoFeatureIcon}>
                <Ionicons name={icon as any} size={16} color={C.primary} />
              </View>
              <Text style={styles.infoFeatureLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.infoSection}>
          <View style={[styles.profileModalRow, { gap: 8 }]}>
            <Ionicons name="mail-outline" size={14} color={C.textMuted} />
            <Text style={[styles.legalItemBody, { flex: 1 }]}>support@valuta.app</Text>
          </View>
        </View>
        <Text style={styles.infoCopyright}>{t('setAboutMadeWith')}</Text>
      </InfoModal>

      {/* ── Kushtet e Shërbimit ── */}
      <InfoModal
        C={C}
        visible={showKushtet}
        onClose={() => setShowKushtet(false)}
        title={t('settingsTerms')}
        icon="document-text-outline"
        iconColor={C.accentLight}
        iconBg={C.accentBg}
        borderColor={C.accentBorder}
      >
        {[
          { title: '1. Pranimi i Kushteve', body: 'Duke përdorur aplikacionin Valuta, ju pranoni këto kushte shërbimi. Nëse nuk pajtoheni, ju lutemi mos e përdorni aplikacionin.' },
          { title: '2. Shërbimi', body: 'Valuta është një aplikacion personal i menaxhimit të financave. Shërbimi ofrohet "siç është" dhe mund të ndryshojë ose ndërpritet në çdo kohë pa njoftim paraprak.' },
          { title: '3. Llogaria juaj', body: 'Ju jeni përgjegjës për ruajtjen e konfidencialitetit të kredencialeve tuaja dhe për gjithë aktivitetin që ndodh nën llogarinë tuaj.' },
          { title: '4. Të dhënat financiare', body: 'Të dhënat financiare që ruani në Valuta janë vetëm për referim personal. Ato nuk konsiderohen këshilla financiare profesionale. Valuta nuk mban përgjegjësi për vendimet financiare të marra bazuar në të dhënat e aplikacionit.' },
          { title: '5. Privatësia', body: 'Të dhënat tuaja ruhen me enkriptim në Supabase cloud. Ne nuk ndajmë të dhëna personale me palë të treta pa lejen tuaj të shprehur.' },
          { title: '6. Ndryshimet', body: 'Ne rezervojmë të drejtën të modifikojmë këto kushte në çdo kohë. Njoftimi do të bëhet brenda aplikacionit. Përdorimi i vazhduar i aplikacionit pas ndryshimeve nënkupton pranimin e tyre.' },
          { title: '7. Kontakti', body: 'Për pyetje rreth këtyre kushteve, kontaktoni: support@valuta.app' },
        ].map(({ title, body }) => (
          <View key={title} style={styles.legalItem}>
            <Text style={styles.legalItemTitle}>{title}</Text>
            <Text style={styles.legalItemBody}>{body}</Text>
          </View>
        ))}
      </InfoModal>

      {/* ── Politika e Privatësisë ── */}
      <InfoModal
        C={C}
        visible={showPrivatesia}
        onClose={() => setShowPrivatesia(false)}
        title={t('settingsPrivacy')}
        icon="shield-outline"
        iconColor={C.primary}
        iconBg={C.primaryBg}
        borderColor={C.primaryBorder}
      >
        {[
          { title: 'Çfarë mbledhim', body: 'Mbledhim vetëm të dhënat që ju na jepni: emrin, emailin, shpenzimet, buxhetin, qëllimet financiare dhe abonimet. Nuk mbledhim të dhëna pa lejen tuaj.' },
          { title: 'Si i ruajmë', body: 'Të dhënat tuaja ruhen me enkriptim në Supabase cloud — platforma e të dhënave PostgreSQL më e sigurt dhe moderne. Shpenzimet, buxheti dhe qëllimet enkriptohen gjatë transferimit dhe ruajtjes.' },
          { title: 'Çfarë shikoni ju', body: 'Profili: emri dhe email-i. Shpenzimet: historiku i plotë. Buxheti: limitet mujore. Qëllimet: qëllimet financiare dhe progresi. Abonimet: pagesat periodike.' },
          { title: 'Kontrolli juaj', body: 'Ju keni të drejtë të aksesoni, ndryshoni ose fshini të dhënat tuaja në çdo kohë nga Cilësimet. Fshirja e llogarisë heq të gjitha të dhënat nga serverët tanë brenda 30 ditëve.' },
          { title: 'Ndajmë me të treta?', body: 'Jo. Nuk shesim, nuk ndajmë dhe nuk tregtojmë të dhënat tuaja me asnjë palë të tretë. Supabase vepron si procesor të dhënash nën marrëveshje konfidencialiteti.' },
          { title: 'Kontakti', body: 'Për çdo pyetje rreth privatësisë: support@valuta.app' },
        ].map(({ title, body }) => (
          <View key={title} style={styles.legalItem}>
            <Text style={styles.legalItemTitle}>{title}</Text>
            <Text style={styles.legalItemBody}>{body}</Text>
          </View>
        ))}
      </InfoModal>

      {/* ── Profili ── */}
      <InfoModal
        C={C}
        visible={showProfili}
        onClose={() => setShowProfili(false)}
        title={t('settingsProfile')}
        icon="person-outline"
        iconColor={C.accentLight}
        iconBg={C.accentBg}
        borderColor={C.accentBorder}
      >
        <View style={styles.profileModalAvatar}>
          <View style={styles.profileModalAvatarInner}>
            <Text style={styles.profileModalAvatarText}>{initials || 'V'}</Text>
          </View>
          <Text style={styles.profileModalName}>{displayName}</Text>
          <Text style={styles.profileModalEmail}>{userEmail}</Text>
        </View>
        {(() => {
          const pc = getPlanColors(state.plan, C);
          return (
            <View style={[styles.profileModalPlanBadge, { backgroundColor: pc.bg, borderColor: pc.border }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color={pc.color} />
              <Text style={[styles.profileModalPlanText, { color: pc.color }]}>{t('profilePlanPrefix')} {getPlanLabel(state.plan, t)}</Text>
            </View>
          );
        })()}
        <View style={styles.profileModalRows}>
          {[
            { label: t('profileEmailLabel'), value: userEmail || '—', icon: 'mail-outline' as const },
            { label: t('profilePlanLabel'), value: getPlanLabel(state.plan, t), icon: 'star-outline' as const },
            { label: t('profileModeLabel'), value: state.mode === 'business' ? t('profileModeBiz') : t('profileModePersonal'), icon: 'briefcase-outline' as const },
          ].map(({ label, value, icon }) => (
            <View key={label} style={styles.profileModalRow}>
              <View style={styles.profileModalRowIcon}><Ionicons name={icon} size={13} color={C.textMuted} /></View>
              <Text style={styles.profileModalRowLabel}>{label}</Text>
              <Text style={styles.profileModalRowValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Edit name */}
        <View style={styles.editNameSection}>
          <Text style={styles.editNameLabel}>{t('profileEditNameLabel')}</Text>
          <TextInput
            style={[styles.editNameInput, editNameFocused && styles.editNameInputFocused]}
            value={editName}
            onChangeText={(v) => { setEditName(v); setNameError(null); }}
            onFocus={() => setEditNameFocused(true)}
            onBlur={() => setEditNameFocused(false)}
            placeholder={t('profileNamePlaceholder')}
            placeholderTextColor={C.textFaint}
            autoCorrect={false}
          />
          {nameError && (
            <View style={[styles.infoNote, { borderColor: C.dangerBorder, backgroundColor: C.dangerBgSubtle }]}>
              <Ionicons name="alert-circle-outline" size={13} color={C.danger} />
              <Text style={[styles.infoNoteText, { color: C.danger }]}>{nameError}</Text>
            </View>
          )}
          {nameSaved && (
            <View style={styles.successNote}>
              <Ionicons name="checkmark-circle-outline" size={13} color={C.primary} />
              <Text style={styles.successNoteText}>{t('success')}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.saveNameBtn, savingName && { opacity: 0.6 }]}
            onPress={handleSaveName}
            disabled={savingName}
            activeOpacity={0.8}
          >
            {savingName
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark-outline" size={16} color="#fff" />}
            <Text style={styles.saveNameBtnText}>{savingName ? t('saving') : t('save')}</Text>
          </TouchableOpacity>
        </View>
      </InfoModal>

      {/* ── Siguria ── */}
      <InfoModal
        C={C}
        visible={showSiguria}
        onClose={() => {
          setShowSiguria(false);
          setResetSent(false);
          setResetError(null);
        }}
        title={t('settingsSecurity')}
        icon="shield-checkmark-outline"
        iconColor={C.primary}
        iconBg={C.primaryBg}
        borderColor={C.primaryBorder}
      >
        {/* Password reset */}
        <View style={styles.legalItem}>
          <Text style={styles.legalItemTitle}>{t('securityResetTitle')}</Text>
          <Text style={styles.legalItemBody}>{t('securityResetSub')}</Text>
          <TextInput
            style={[styles.securityInput, { marginTop: 8 }]}
            value={resetEmail}
            onChangeText={(v) => { setResetEmail(v); setResetError(null); }}
            placeholder={t('securityEmailLabel')}
            placeholderTextColor={C.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {resetError && (
            <View style={[styles.infoNote, { marginTop: 8, borderColor: C.dangerBorder, backgroundColor: C.dangerBgSubtle }]}>
              <Ionicons name="alert-circle-outline" size={13} color={C.danger} />
              <Text style={[styles.infoNoteText, { color: C.danger }]}>{resetError}</Text>
            </View>
          )}
          {resetSent && (
            <View style={[styles.successNote, { marginTop: 8 }]}>
              <Ionicons name="checkmark-circle-outline" size={13} color={C.primary} />
              <Text style={styles.successNoteText}>{t('resetSent')}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.securityActionBtn, { marginTop: 10 }, (sendingReset || resetSent) && { opacity: 0.6 }]}
            onPress={handlePasswordReset}
            disabled={sendingReset || resetSent}
            activeOpacity={0.8}
          >
            {sendingReset
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="mail-outline" size={16} color="#fff" />}
            <Text style={styles.securityActionBtnText}>{sendingReset ? t('loading') : t('securityResetBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Biometric */}
        <View style={styles.legalItem}>
          <Text style={styles.legalItemTitle}>{t('securityBiometricTitle')}</Text>
          <Text style={styles.legalItemBody}>{t('securityBiometricSub')}</Text>

          {Platform.OS === 'web' ? (
            <View style={[styles.biometricStatusRow, { marginTop: 8 }]}>
              <Ionicons name="globe-outline" size={18} color={C.textMuted} />
              <Text style={styles.biometricStatusText}>{t('biometricWebOnly')}</Text>
            </View>
          ) : bioStatus === null ? (
            <View style={[styles.biometricStatusRow, { marginTop: 8 }]}>
              <ActivityIndicator size="small" color={C.textMuted} />
            </View>
          ) : !bioStatus.hasHardware ? (
            <View style={[styles.biometricStatusRow, { marginTop: 8 }]}>
              <Ionicons name="finger-print-outline" size={18} color={C.textMuted} />
              <Text style={styles.biometricStatusText}>{t('biometricUnavailable')}</Text>
            </View>
          ) : !bioStatus.isEnrolled ? (
            <View style={[styles.biometricStatusRow, { marginTop: 8 }]}>
              <Ionicons name="warning-outline" size={18} color={C.warning} />
              <Text style={[styles.biometricStatusText, { color: C.warning }]}>{t('biometricNotEnrolled')}</Text>
            </View>
          ) : (
            <View style={{ marginTop: 8, gap: 8 }}>
              {bioStatus.supportedTypes.map((sType) => (
                <View key={sType} style={styles.biometricStatusRow}>
                  <Ionicons
                    name={sType === 'face' ? 'scan-outline' : sType === 'iris' ? 'eye-outline' : 'finger-print-outline'}
                    size={18}
                    color={C.primary}
                  />
                  <Text style={[styles.biometricStatusText, { color: C.primary, fontWeight: '600' }]}>
                    {sType === 'face'
                      ? t('biometricFaceId')
                      : sType === 'iris'
                      ? t('biometricIris')
                      : t('biometricFingerprint')}
                  </Text>
                </View>
              ))}
              <View style={[styles.biometricStatusRow, { justifyContent: 'space-between' }]}>
                <Text style={styles.biometricStatusText}>{t('biometricToggle')}</Text>
                <Switch
                  value={bioEnabled}
                  onValueChange={async (v) => {
                    setBioEnabled(v);
                    await saveBiometricEnabled(v);
                  }}
                  trackColor={{ false: C.elevated, true: C.primaryBgStrong }}
                  thumbColor={bioEnabled ? C.primary : C.textMuted}
                  ios_backgroundColor={C.elevated}
                />
              </View>
            </View>
          )}
        </View>

      </InfoModal>

      {/* ── Ruajtja & Sinkronizimi ── */}
      <InfoModal
        C={C}
        visible={showRuajtja}
        onClose={() => {
          setShowRuajtja(false);
          setSyncError(null);
          setSyncSuccess(false);
        }}
        title={t('settingsStorage')}
        icon="cloud-upload-outline"
        iconColor={C.warning}
        iconBg={C.warningBgSubtle}
        borderColor={C.warningBorder}
      >
        <View style={[styles.syncStatusCard, {
          borderColor: state.isLoggedIn ? C.primaryBorder : C.border,
          backgroundColor: state.isLoggedIn ? C.primaryBgSubtle : C.elevated,
        }]}>
          <View style={[styles.syncStatusDot, { backgroundColor: state.isLoggedIn ? C.primary : C.textFaint }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.syncStatusTitle, { color: state.isLoggedIn ? C.primaryLight : C.textSub }]}>
              {state.isLoggedIn ? t('syncStatusConnected') : (lang === 'en' ? 'Not signed in' : 'Jo i kyçur')}
            </Text>
            <Text style={styles.syncStatusSub}>
              {state.isLoggedIn ? t('syncStatusSub') : (lang === 'en' ? 'Sign in to activate cloud' : 'Kyçuni për të aktivizuar cloud')}
            </Text>
          </View>
          <Ionicons
            name={state.isLoggedIn ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={20}
            color={state.isLoggedIn ? C.primary : C.textFaint}
          />
        </View>

        {[
          { icon: 'time-outline' as const, label: t('lastSync'), value: formatLastSync(state.lastSyncTime, lang) },
          { icon: 'receipt-outline' as const, label: lang === 'en' ? 'Saved expenses' : 'Shpenzime të ruajtura', value: `${state.expenses.length} ${lang === 'en' ? 'records' : 'rekorde'}` },
          { icon: 'wallet-outline' as const, label: lang === 'en' ? 'Budget saved' : 'Buxheti i ruajtur', value: state.budget.monthly > 0 ? (lang === 'en' ? 'Yes' : 'Po') : (lang === 'en' ? 'No' : 'Jo') },
          { icon: 'apps-outline' as const, label: t('repSubsTitle'), value: `${state.subscriptions.length} ${t('repSubsActive')}` },
        ].map(({ icon, label, value }) => (
          <View key={label} style={styles.profileModalRow}>
            <View style={styles.profileModalRowIcon}><Ionicons name={icon} size={13} color={C.textMuted} /></View>
            <Text style={styles.profileModalRowLabel}>{label}</Text>
            <Text style={styles.profileModalRowValue}>{value}</Text>
          </View>
        ))}

        {syncError && (
          <View style={[styles.infoNote, { borderColor: C.dangerBorder, backgroundColor: C.dangerBgSubtle }]}>
            <Ionicons name="alert-circle-outline" size={13} color={C.danger} />
            <Text style={[styles.infoNoteText, { color: C.danger }]}>{syncError}</Text>
          </View>
        )}
        {syncSuccess && (
          <View style={styles.successNote}>
            <Ionicons name="checkmark-circle-outline" size={13} color={C.primary} />
            <Text style={styles.successNoteText}>{t('syncSuccess')}</Text>
          </View>
        )}

        {state.isLoggedIn && (
          <TouchableOpacity
            style={[styles.syncNowBtn, (isSyncing || state.syncing) && { opacity: 0.6 }]}
            onPress={handleSyncNow}
            activeOpacity={0.78}
            disabled={isSyncing || state.syncing}
          >
            <LinearGradient
              colors={(isSyncing || state.syncing) ? [C.elevated, C.elevated] : ['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.08)']}
              style={StyleSheet.absoluteFill}
            />
            {(isSyncing || state.syncing)
              ? <ActivityIndicator size="small" color={C.warning} />
              : <Ionicons name="sync-outline" size={15} color={C.warning} />}
            <Text style={styles.syncNowText}>{(isSyncing || state.syncing) ? t('syncing') : t('syncNow')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={13} color={C.textFaint} />
          <Text style={styles.infoNoteText}>{t('syncInfoNote')}</Text>
        </View>
      </InfoModal>

      {/* ── Raporte me email ── */}
      <InfoModal
        C={C}
        visible={showEmailReport}
        onClose={() => { setShowEmailReport(false); setEmailPrefsSaved(false); }}
        title={t('settingsEmailReports')}
        icon="mail-outline"
        iconColor={C.primary}
        iconBg={C.primaryBg}
        borderColor={C.primaryBorder}
      >
        <Text style={styles.legalItemBody}>
          Konfigurojeni preferencën tuaj të raportit. Do të jetë e gatshme për dërgim sapo sistemi të mbështesë email-et automatike.
        </Text>

        {/* Email input */}
        <View style={styles.emailReportSection}>
          <Text style={styles.emailReportLabel}>{t('emailReportEmailLabel')}</Text>
          <TextInput
            style={styles.emailReportInput}
            value={emailPrefs.email}
            onChangeText={(v) => setEmailPrefs((p) => ({ ...p, email: v }))}
            placeholder={t('emailReportEmailPlaceholder')}
            placeholderTextColor={C.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Format picker */}
        <View style={styles.emailReportSection}>
          <Text style={styles.emailReportLabel}>{t('emailReportFormatLabel')}</Text>
          <View style={styles.optionRow}>
            {(['pdf', 'csv'] as ReportFormat[]).map((fmt) => {
              const isActive = emailPrefs.format === fmt;
              return (
                <Pressable
                  key={fmt}
                  style={({ pressed }) => [styles.optionChip, isActive && styles.optionChipActive, pressed && { opacity: 0.72 }]}
                  onPress={() => setEmailPrefs((p) => ({ ...p, format: fmt }))}
                >
                  {isActive && <LinearGradient colors={['rgba(16,185,129,0.14)', 'transparent']} style={StyleSheet.absoluteFill} />}
                  <Ionicons name={fmt === 'pdf' ? 'document-text-outline' : 'grid-outline'} size={14} color={isActive ? C.primary : C.textMuted} />
                  <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{fmt.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Frequency picker */}
        <View style={styles.emailReportSection}>
          <Text style={styles.emailReportLabel}>{t('emailReportFreqLabel')}</Text>
          <View style={styles.optionRow}>
            {([
              { key: 'once' as ReportFrequency, label: t('setFreqOnce') },
              { key: 'weekly' as ReportFrequency, label: t('setFreqWeekly') },
              { key: 'monthly' as ReportFrequency, label: t('setFreqMonthly') },
            ]).map(({ key, label }) => {
              const isActive = emailPrefs.frequency === key;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [styles.optionChip, isActive && styles.optionChipActive, pressed && { opacity: 0.72 }]}
                  onPress={() => setEmailPrefs((p) => ({ ...p, frequency: key }))}
                >
                  {isActive && <LinearGradient colors={['rgba(16,185,129,0.14)', 'transparent']} style={StyleSheet.absoluteFill} />}
                  <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {emailPrefsSaved && (
          <View style={styles.successNote}>
            <Ionicons name="checkmark-circle-outline" size={13} color={C.primary} />
            <Text style={styles.successNoteText}>{t('emailReportSaved')}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveReportBtn, (savingEmailPrefs || !emailPrefs.email.trim()) && { opacity: 0.55 }]}
          onPress={handleSaveEmailPrefs}
          disabled={savingEmailPrefs || !emailPrefs.email.trim()}
          activeOpacity={0.8}
        >
          {savingEmailPrefs
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="checkmark-outline" size={16} color="#fff" />}
          <Text style={styles.saveReportBtnText}>{savingEmailPrefs ? t('saving') : t('emailReportSaveBtn')}</Text>
        </TouchableOpacity>

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={13} color={C.textFaint} />
          <Text style={styles.infoNoteText}>Dërgimi automatik i email-eve do të aktivizohet në një version të ardhshëm. Preferencat tuaja ruhen tani.</Text>
        </View>
      </InfoModal>
    </SafeAreaView>
  );
}
