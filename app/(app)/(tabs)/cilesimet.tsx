import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PaywallModal } from '@/components/ui/PaywallModal';
import { CURRENCIES } from '@/constants/currencies';
import { C, GRADIENTS } from '@/constants/colors';
import { signOut } from '@/lib/auth';
import { useNotifContext } from '@/lib/NotificationContext';
import type { AppMode, Currency } from '@/types';

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
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  rightElement,
  disabled = false,
  badge,
}: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.settingRow,
        disabled && styles.disabled,
        !disabled && hovered && styles.settingRowHovered,
        !disabled && pressed && { opacity: 0.72 },
      ]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={disabled ? C.textMuted : iconColor} />
      </View>
      <View style={styles.settingText}>
        <View style={styles.settingTitleRow}>
          <Text style={[styles.settingTitle, disabled && styles.disabledText]}>{title}</Text>
          {badge && (
            <Badge size="sm" color={C.accentLight} bgColor={C.accentBg}>{badge}</Badge>
          )}
        </View>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
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

const PRO_COLOR = '#A78BFA';
const PRO_BG = 'rgba(167,139,250,0.10)';
const PRO_BORDER = 'rgba(167,139,250,0.24)';

function getPlanLabel(plan: string) {
  if (plan === 'pro') return 'Valuta Pro';
  if (plan === 'business') return 'Biznes';
  return 'Personal';
}

function getPlanColors(plan: string) {
  if (plan === 'pro') return { color: PRO_COLOR, bg: PRO_BG, border: PRO_BORDER, dot: PRO_COLOR };
  if (plan === 'business') return { color: C.accentLight, bg: C.accentBgSubtle, border: C.accentBorder, dot: C.accentLight };
  return { color: C.primary, bg: C.primaryBgSubtle, border: C.primaryBorder, dot: C.primary };
}

export default function Cilesimet() {
  const router = useRouter();
  const { state, setCurrency, setMode, updateRecurringSettings } = useStore();
  const { prefs, updatePrefs } = useNotifContext();
  const rs = state.recurringSettings;
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [paywallMode, setPaywallMode] = useState<AppMode | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleCurrencySelect = (code: Currency) => {
    setCurrency(code);
  };

  const handleModePress = (requested: AppMode) => {
    const plan = state.plan;
    if (plan === 'pro') {
      setMode(requested);
      return;
    }
    if (plan === 'personal' && requested === 'personal') { setMode('personal'); return; }
    if (plan === 'business' && requested === 'business') { setMode('business'); return; }
    // Blocked — show paywall
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
      // Supabase auth listener fires SIGNED_OUT → CLEAR_USER_DATA + SET_LOGGED_IN(false)
      // AuthGuard then redirects to /(auth)/login automatically
    } catch {
      setIsLoggingOut(false);
      setLogoutError('Ndodhi një gabim gjatë daljes. Provo përsëri.');
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;
    setShowLogoutModal(true);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Cilësimet</Text>

        {/* Profile Card */}
        <LinearGradient
          colors={['#0E2540', '#091830', '#060B18']}
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
            const pc = getPlanColors(state.plan);
            return (
              <View style={[styles.profileBadge, { backgroundColor: pc.bg, borderColor: pc.border }]}>
                <View style={[styles.profileBadgeDot, { backgroundColor: pc.dot }]} />
                <Text style={[styles.profileBadgeText, { color: pc.color }]}>
                  {getPlanLabel(state.plan)}
                </Text>
              </View>
            );
          })()}
        </LinearGradient>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONEDHA</Text>
          <Card>
            <Text style={styles.currencyDesc}>Monedha e preferuar për shfaqjen e shumave</Text>
            <View style={styles.currencyOptions}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyOption,
                    state.preferredCurrency === curr.code && styles.currencyOptionActive,
                  ]}
                  onPress={() => handleCurrencySelect(curr.code)}
                  activeOpacity={0.75}
                >
                  {state.preferredCurrency === curr.code && (
                    <LinearGradient
                      colors={['rgba(16,185,129,0.14)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[
                    styles.currencySymbol,
                    state.preferredCurrency === curr.code && styles.currencySymbolActive,
                  ]}>
                    {curr.symbol}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.currencyCode,
                      state.preferredCurrency === curr.code && styles.currencyCodeActive,
                    ]}>
                      {curr.code}
                    </Text>
                    <Text style={styles.currencyName} numberOfLines={1}>{curr.name}</Text>
                  </View>
                  {state.preferredCurrency === curr.code && (
                    <View style={styles.currencyCheck}>
                      <Ionicons name="checkmark" size={11} color={C.white} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCAT</Text>
          <Card style={{ gap: 0 }}>
            {/* Master notifications toggle */}
            <SettingRow
              icon="notifications-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title="Njoftimet"
              subtitle="Paralajmërime buxheti dhe kujtuese"
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

            {/* Granular controls — only visible when notifications are on */}
            {prefs.enabled && (
              <View style={styles.notifSubSection}>
                {/* Budget warnings */}
                <View style={styles.notifSubRow}>
                  <View style={styles.notifSubLeft}>
                    <View style={[styles.notifSubIcon, { backgroundColor: C.warningBgSubtle, borderColor: C.warningBorder }]}>
                      <Ionicons name="warning-outline" size={12} color={C.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifSubTitle}>Paralajmërime Buxheti</Text>
                      <Text style={styles.notifSubDesc}>Kur shpenzimet tejkalojnë limitin</Text>
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

                {/* Inactivity reminders */}
                <View style={styles.notifSubRow}>
                  <View style={styles.notifSubLeft}>
                    <View style={[styles.notifSubIcon, { backgroundColor: C.accentBgSubtle, borderColor: C.accentBorder }]}>
                      <Ionicons name="time-outline" size={12} color={C.accentLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifSubTitle}>Kujtesë Pasiviteti</Text>
                      <Text style={styles.notifSubDesc}>Nëse nuk regjistron shpenzime</Text>
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

                {/* Day picker — only when inactivity reminders are on */}
                {prefs.inactivityReminders && (
                  <View style={styles.dayPickerRow}>
                    <Text style={styles.dayPickerLabel}>Pas ditëve pa aktivitet:</Text>
                    <View style={styles.dayPills}>
                      {[2, 3, 5, 7].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.dayPill,
                            prefs.inactivityDays === d && styles.dayPillActive,
                          ]}
                          onPress={() => updatePrefs({ inactivityDays: d })}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.dayPillText,
                              prefs.inactivityDays === d && styles.dayPillTextActive,
                            ]}
                          >
                            {d}d
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.rowSeparator} />
            <SettingRow
              icon="moon-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title="Tema"
              subtitle="E errët (aktive)"
              disabled
              badge="Se shpejti"
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="language-outline"
              iconColor={C.primary}
              iconBg={C.primaryBg}
              title="Gjuha"
              subtitle="Shqip"
              disabled
            />
          </Card>
        </View>

        {/* Recurring / Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABONIMET & PERIODIKE</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              icon="repeat-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title="Krijo automatikisht"
              subtitle="Shto abonim kur zbulohet model periodik"
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
              icon="notifications-outline"
              iconColor={C.warning}
              iconBg={C.warningBgSubtle}
              title="Kujtesë pagese"
              subtitle={`Njoftim ${rs.reminderDaysBefore} ditë para pagesës`}
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
                  <Text style={styles.dayPickerLabel}>Ditë para pagesës:</Text>
                  <View style={styles.dayPills}>
                    {[1, 2, 3, 5].map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.dayPill,
                          rs.reminderDaysBefore === d && styles.dayPillActive,
                        ]}
                        onPress={() => updateRecurringSettings({ reminderDaysBefore: d })}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.dayPillText,
                            rs.reminderDaysBefore === d && styles.dayPillTextActive,
                          ]}
                        >
                          {d}d
                        </Text>
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
          <Text style={styles.sectionTitle}>LLOGARIA</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              icon="person-outline"
              iconColor={C.accentLight}
              iconBg={C.accentBg}
              title="Profili"
              subtitle="Ndrysho të dhënat personale"
              disabled
              badge="Se shpejti"
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="shield-checkmark-outline"
              iconColor={C.primary}
              iconBg={C.primaryBg}
              title="Siguria"
              subtitle="PIN, biometrikë, autentifikim"
              disabled
              badge="Se shpejti"
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="cloud-upload-outline"
              iconColor={C.warning}
              iconBg={C.warningBgSubtle}
              title="Ruajtja & Sinkronizimi"
              subtitle="Supabase cloud backup"
              disabled
              badge="Se shpejti"
            />
          </Card>
        </View>

        {/* Mode Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MËNYRA</Text>
          <Card style={{ gap: 12 }}>
            <Text style={styles.modeDesc}>
              Kalo midis mënyrës personale dhe biznesit. Aksesi varet nga plani juaj.
            </Text>

            {/* Plan indicator */}
            {(() => {
              const pc = getPlanColors(state.plan);
              return (
                <View style={[styles.planIndicator, { borderColor: pc.border, backgroundColor: pc.bg }]}>
                  <LinearGradient
                    colors={[pc.bg, 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="shield-checkmark-outline" size={13} color={pc.color} />
                  <Text style={[styles.planIndicatorText, { color: pc.color }]}>
                    Plani: {getPlanLabel(state.plan)}
                  </Text>
                </View>
              );
            })()}

            <View style={styles.modeRow}>
              {/* Personal Mode */}
              {(() => {
                const isActive = state.mode === 'personal';
                const isLocked = state.plan === 'business';
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeOption,
                      isActive && styles.modeOptionActivePersonal,
                      isLocked && styles.modeOptionLocked,
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={() => handleModePress('personal')}
                  >
                    {isActive && (
                      <LinearGradient
                        colors={['rgba(16,185,129,0.14)', 'rgba(16,185,129,0.04)']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={[
                      styles.modeIcon,
                      isActive
                        ? { backgroundColor: C.primaryBgStrong, borderColor: C.primaryBorder }
                        : { backgroundColor: C.elevated, borderColor: C.border },
                    ]}>
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={isActive ? C.primary : C.textMuted}
                      />
                    </View>
                    <Text style={[styles.modeLabel, isActive && { color: C.primary }]}>
                      Personal
                    </Text>
                    <Text style={styles.modeSub}>Shpenzime vetjake</Text>
                    {isActive && (
                      <View style={[styles.modeCheck, { backgroundColor: C.primary }]}>
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
              })()}

              {/* Business Mode */}
              {(() => {
                const isActive = state.mode === 'business';
                const isLocked = state.plan === 'personal';
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeOption,
                      isActive && styles.modeOptionActiveBusiness,
                      isLocked && styles.modeOptionLocked,
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={() => handleModePress('business')}
                  >
                    {isActive && (
                      <LinearGradient
                        colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.04)']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={[
                      styles.modeIcon,
                      isActive
                        ? { backgroundColor: C.accentBg, borderColor: C.accentBorder }
                        : { backgroundColor: C.elevated, borderColor: C.border },
                    ]}>
                      <Ionicons
                        name="briefcase-outline"
                        size={18}
                        color={isActive ? C.accentLight : C.textMuted}
                      />
                    </View>
                    <Text style={[styles.modeLabel, isActive && { color: C.accentLight }]}>
                      Biznes
                    </Text>
                    <Text style={styles.modeSub}>Shpenzime biznesi</Text>
                    {isActive && (
                      <View style={[styles.modeCheck, { backgroundColor: C.accent }]}>
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
              })()}
            </View>

            {/* Business features preview */}
            {state.mode === 'business' && (
              <View style={styles.bizFeaturesBox}>
                <LinearGradient
                  colors={['rgba(59,130,246,0.08)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                />
                {[
                  { icon: 'cube-outline' as const, text: 'Kategori biznesi (Furnitorë, Inventar, Taksa...)' },
                  { icon: 'bar-chart-outline' as const, text: 'Analitikë biznesi të ndara' },
                  { icon: 'document-text-outline' as const, text: 'Raporte profesionale (se shpejti)' },
                  { icon: 'receipt-outline' as const, text: 'Fatura & VAT (se shpejti)' },
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
          <Text style={styles.sectionTitle}>EKSPORTIMI</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              icon="share-outline"
              iconColor={C.primary}
              iconBg={C.primaryBg}
              title="Eksporto të dhënat"
              subtitle="PDF, CSV — shpenzime, buxhet, qëllime"
              onPress={() => router.push('/export' as any)}
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="mail-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title="Raporte me email"
              subtitle="Planifiko raporte automatike"
              disabled
              badge="Se shpejti"
            />
          </Card>
        </View>

        {/* Other */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TJETËR</Text>
          <Card style={{ gap: 0 }}>
            <SettingRow
              icon="information-circle-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title="Rreth Valuta"
              subtitle="Versioni 1.0.0"
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="document-text-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title="Kushtet e Shërbimit"
            />
            <View style={styles.rowSeparator} />
            <SettingRow
              icon="shield-outline"
              iconColor={C.textSub}
              iconBg={C.elevated}
              title="Politika e Privatësisë"
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
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={C.danger} />
          ) : (
            <Ionicons name="log-out-outline" size={17} color={C.danger} />
          )}
          <Text style={styles.logoutText}>
            {isLoggingOut ? 'Duke dalë...' : 'Dil nga llogaria'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <PaywallModal
        visible={paywallMode !== null}
        blockedMode={paywallMode ?? 'business'}
        onClose={() => setPaywallMode(null)}
      />

      {/* Logout confirmation modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
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
            <Text style={styles.logoutModalTitle}>Dëshiron të dalësh{'\n'}nga llogaria?</Text>
            <View style={styles.logoutModalBtns}>
              <TouchableOpacity
                style={styles.logoutModalCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.logoutModalCancelText}>Anulo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutModalConfirmBtn}
                onPress={() => { setShowLogoutModal(false); performLogout(); }}
                activeOpacity={0.78}
              >
                <Text style={styles.logoutModalConfirmText}>Dil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.7 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  profileCardShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  profileAvatarWrap: { position: 'relative' },
  profileAvatarGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 20,
    backgroundColor: C.primaryGlow,
    opacity: 0.22,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: C.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: C.primary },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  profileEmail: { fontSize: 12, color: C.textMuted },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: C.primaryBgSubtle,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  profileBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.primary,
  },
  profileBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.2,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  currencyDesc: { fontSize: 13, color: C.textMuted, marginBottom: 14 },
  currencyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyOption: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.elevated,
    position: 'relative',
    overflow: 'hidden',
  },
  currencyOptionActive: {
    borderColor: C.primaryBorder,
  },
  currencySymbol: { fontSize: 18, fontWeight: '800', color: C.textMuted },
  currencySymbolActive: { color: C.primary },
  currencyCode: { fontSize: 13, fontWeight: '700', color: C.textSub },
  currencyCodeActive: { color: C.primary },
  currencyName: { fontSize: 10, color: C.textMuted, maxWidth: 70 },
  currencyCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderRadius: 10,
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  settingRowHovered: {
    backgroundColor: 'rgba(20,34,54,0.7)',
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: { flex: 1 },
  settingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  settingSubtitle: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  disabled: { opacity: 0.48 },
  disabledText: { color: C.textSub },
  rowSeparator: { height: 1, backgroundColor: C.border, marginHorizontal: -16, opacity: 0.65 },

  // Mode switcher
  modeDesc: { fontSize: 13, color: C.textMuted, lineHeight: 18 },
  planIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  planIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  modeOptionActivePersonal: { borderColor: C.primaryBorder },
  modeOptionActiveBusiness: { borderColor: C.accentBorder },
  modeOptionLocked: { opacity: 0.52 },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modeLabel: { fontSize: 14, fontWeight: '800', color: C.textSub, letterSpacing: -0.2 },
  modeSub: { fontSize: 11, color: C.textMuted, fontWeight: '500', textAlign: 'center' },
  modeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeLockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizFeaturesBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  bizFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bizFeatureText: { fontSize: 12, color: C.textSub, fontWeight: '500', flex: 1 },

  notifSubSection: {
    backgroundColor: C.surface,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
  },
  notifSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 8,
  },
  notifSubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  notifSubIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  notifSubTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  notifSubDesc: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  subSwitch: {
    flexShrink: 0,
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
  },
  dayPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 34,
  },
  dayPickerLabel: {
    fontSize: 11,
    color: C.textMuted,
    flex: 1,
  },
  dayPills: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayPillActive: {
    backgroundColor: C.accentBgSubtle,
    borderColor: C.accentBorder,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  dayPillTextActive: {
    color: C.accentLight,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.dangerBorder,
    backgroundColor: C.dangerBgSubtle,
  },
  logoutBtnLoading: {
    opacity: 0.6,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: C.danger },
  logoutError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.dangerBgSubtle,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },
  logoutErrorText: { fontSize: 13, color: C.danger, flex: 1 },

  // ── Logout modal ─────────────────────────────────────────────
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoutModalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
    elevation: 20,
  },
  logoutModalTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(239,68,68,0.30)',
  },
  logoutModalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.dangerBgSubtle,
    borderWidth: 1.5,
    borderColor: C.dangerBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  logoutModalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.elevated,
    alignItems: 'center',
  },
  logoutModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textSub,
  },
  logoutModalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.dangerBgSubtle,
    borderWidth: 1.5,
    borderColor: C.dangerBorder,
    alignItems: 'center',
  },
  logoutModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.danger,
  },
});
