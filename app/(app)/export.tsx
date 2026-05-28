import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { GRADIENTS } from '@/constants/colors';
import { useThemeColors, type ColorPalette } from '@/lib/ThemeContext';
import {
  exportData,
  buildFilename,
  type ExportOptions,
  type ExportPeriod,
  type ExportFormat,
  type ExportData,
} from '@/lib/exportUtils';
import { useTranslation } from '@/lib/i18n';

export default function Export() {
  const router = useRouter();
  const C = useThemeColors();
  const { t, lang } = useTranslation();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { state } = useStore();

  const PERIOD_LABELS: Record<ExportPeriod, string> = {
    this_month: t('exportPeriodThisMonth'),
    last_month: t('exportPeriodLastMonth'),
    last_3_months: t('exportPeriodLast3Months'),
    all_time: t('exportPeriodAllTime'),
    custom: t('exportPeriodCustom'),
  };

  const [period, setPeriod] = useState<ExportPeriod>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(true);
  const [includeSubscriptions, setIncludeSubscriptions] = useState(true);
  const [includeGoals, setIncludeGoals] = useState(true);
  const [expenseMode, setExpenseMode] = useState<'personal' | 'business' | 'both'>('both');
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleExport = async () => {
    if (isExporting) return;
    setResult(null);

    // Validate custom date range before exporting
    if (period === 'custom') {
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(customStart) || !dateRe.test(customEnd)) {
        setResult({ success: false, msg: t('exportInvalidDate') });
        return;
      }
      if (new Date(customStart) > new Date(customEnd)) {
        setResult({ success: false, msg: t('exportStartBeforeEnd') });
        return;
      }
    }

    setIsExporting(true);

    const opts: ExportOptions = {
      period,
      customStart: period === 'custom' ? customStart : undefined,
      customEnd: period === 'custom' ? customEnd : undefined,
      includeExpenses,
      includeBudget,
      includeSubscriptions,
      includeGoals,
      expenseMode,
      format,
    };

    const data: ExportData = {
      expenses: state.expenses,
      budget: state.budget,
      subscriptions: state.subscriptions,
      goals: state.goals,
      userEmail: state.userEmail,
      userName: state.userName,
      mode: state.mode,
    };

    const filename = buildFilename(opts);
    const res = await exportData(data, opts, filename);
    setIsExporting(false);
    setResult({
      success: res.success,
      msg: res.success
        ? format === 'pdf'
          ? Platform.OS === 'web'
            ? (lang === 'en' ? 'Report opened. Print or download HTML from the new tab.' : 'Raporti u hap. Printo ose shkarko HTML nga faqja e re.')
            : (lang === 'en' ? 'Report built. Open the web for full PDF.' : 'Raporti u ndërtua. Hap web-in për PDF të plotë.')
          : (lang === 'en' ? 'CSV downloaded successfully.' : 'CSV u shkarkua me sukses.')
        : (res.error ?? (lang === 'en' ? 'An error occurred. Try again.' : 'Ndodhi një gabim. Provo përsëri.')),
    });
  };

  const canExport = includeExpenses || includeBudget || includeSubscriptions || includeGoals;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={20} color={C.textSub} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('exportTitle')}</Text>
        </View>

        {/* Period */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{lang === 'en' ? 'PERIOD' : 'PERIUDHA'}</Text>
          <View style={styles.chipRow}>
            {(Object.keys(PERIOD_LABELS) as ExportPeriod[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, period === p && styles.chipActive]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.75}
              >
                {period === p && (
                  <LinearGradient
                    colors={GRADIENTS.primary}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
                <Text style={[styles.chipText, period === p && styles.chipTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {period === 'custom' && (
            <View style={styles.customDateRow}>
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>{lang === 'en' ? 'From' : 'Nga'}</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textFaint}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <Ionicons name="arrow-forward" size={14} color={C.textMuted} style={{ marginTop: 22 }} />
              <View style={styles.customDateField}>
                <Text style={styles.customDateLabel}>{lang === 'en' ? 'To' : 'Deri'}</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textFaint}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          )}
        </View>

        {/* Format */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{lang === 'en' ? 'FORMAT' : 'FORMATI'}</Text>
          <View style={styles.formatRow}>
            {(['pdf', 'csv'] as ExportFormat[]).map((f) => {
              const isActive = format === f;
              const isPdf = f === 'pdf';
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.formatCard, isActive && styles.formatCardActive]}
                  onPress={() => setFormat(f)}
                  activeOpacity={0.78}
                >
                  {isActive && (
                    <LinearGradient
                      colors={isPdf
                        ? ['rgba(16,185,129,0.14)', 'rgba(16,185,129,0.04)']
                        : ['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.04)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  )}
                  <View style={[
                    styles.formatIconWrap,
                    {
                      backgroundColor: isActive
                        ? (isPdf ? C.primaryBgSubtle : C.accentBgSubtle)
                        : C.elevated,
                      borderColor: isActive
                        ? (isPdf ? C.primaryBorder : C.accentBorder)
                        : C.border,
                    },
                  ]}>
                    <Ionicons
                      name={isPdf ? 'document-text-outline' : 'grid-outline'}
                      size={22}
                      color={isActive ? (isPdf ? C.primary : C.accentLight) : C.textMuted}
                    />
                  </View>
                  <Text style={[styles.formatLabel, isActive && { color: isPdf ? C.primary : C.accentLight }]}>
                    {f === 'pdf' ? 'PDF' : 'CSV'}
                  </Text>
                  <Text style={styles.formatSub}>
                    {isPdf ? (lang === 'en' ? 'Formatted report' : 'Raport i formatuar') : (lang === 'en' ? 'Excel/Sheets table' : 'Tabelë Excel/Sheets')}
                  </Text>
                  {isActive && (
                    <View style={[styles.formatCheck, { backgroundColor: isPdf ? C.primary : C.accent }]}>
                      <Ionicons name="checkmark" size={10} color={C.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Include toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{lang === 'en' ? 'INCLUDE' : 'PËRFSHI'}</Text>
          <View style={styles.includeCard}>
            {([
              {
                key: 'expenses',
                label: lang === 'en' ? 'Expenses' : 'Shpenzimet',
                sub: lang === 'en' ? 'Transaction list' : 'Lista e transaksioneve',
                icon: 'receipt-outline',
                color: C.warning,
                val: includeExpenses,
                set: setIncludeExpenses,
              },
              {
                key: 'budget',
                label: lang === 'en' ? 'Budget' : 'Buxheti',
                sub: lang === 'en' ? 'Limit and progress' : 'Limiti dhe progresi',
                icon: 'wallet-outline',
                color: C.primary,
                val: includeBudget,
                set: setIncludeBudget,
              },
              {
                key: 'subscriptions',
                label: lang === 'en' ? 'Subscriptions' : 'Abonimet',
                sub: lang === 'en' ? 'Recurring services' : 'Shërbimet periodik',
                icon: 'repeat-outline',
                color: C.accentLight,
                val: includeSubscriptions,
                set: setIncludeSubscriptions,
              },
              {
                key: 'goals',
                label: lang === 'en' ? 'Goals' : 'Qëllimet',
                sub: lang === 'en' ? 'Savings progress' : 'Progresi i kursimeve',
                icon: 'trophy-outline',
                color: '#A78BFA',
                val: includeGoals,
                set: setIncludeGoals,
              },
            ] as const).map((item, i, arr) => (
              <React.Fragment key={item.key}>
                <View style={styles.includeRow}>
                  <View style={[styles.includeIcon, { backgroundColor: item.color + '18', borderColor: item.color + '28' }]}>
                    <Ionicons name={item.icon as any} size={15} color={item.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.includeLabel}>{item.label}</Text>
                    <Text style={styles.includeSub}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={item.val}
                    onValueChange={item.set as (v: boolean) => void}
                    trackColor={{ false: C.elevated, true: item.color + '55' }}
                    thumbColor={item.val ? item.color : C.textMuted}
                    ios_backgroundColor={C.elevated}
                  />
                </View>
                {i < arr.length - 1 && <View style={styles.includeDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Expense mode — only when expenses included */}
        {includeExpenses && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{lang === 'en' ? 'EXPENSES' : 'SHPENZIMET'}</Text>
            <View style={styles.modeChipRow}>
              {(['personal', 'business', 'both'] as const).map((m) => {
                const labels = lang === 'en'
                  ? { personal: 'Personal', business: 'Business', both: 'Both' }
                  : { personal: 'Personal', business: 'Biznes', both: 'Të dyja' };
                const isActive = expenseMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeChip, isActive && styles.modeChipActive]}
                    onPress={() => setExpenseMode(m)}
                    activeOpacity={0.75}
                  >
                    {isActive && (
                      <LinearGradient
                        colors={GRADIENTS.primary}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    )}
                    <Text style={[styles.modeChipText, isActive && styles.modeChipTextActive]}>
                      {labels[m]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Result banner */}
        {result && (
          <View style={[
            styles.resultBanner,
            {
              borderColor: result.success ? C.primaryBorder : 'rgba(239,68,68,0.40)',
              backgroundColor: result.success ? C.primaryBgSubtle : 'rgba(239,68,68,0.08)',
            },
          ]}>
            <Ionicons
              name={result.success ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={16}
              color={result.success ? C.primary : '#EF4444'}
            />
            <Text style={[styles.resultText, { color: result.success ? C.primary : '#EF4444' }]}>
              {result.msg}
            </Text>
            <TouchableOpacity onPress={() => setResult(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={15} color={result.success ? C.primary : '#EF4444'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Export button */}
        <TouchableOpacity
          style={[styles.exportBtn, (!canExport || isExporting) && styles.exportBtnDisabled]}
          onPress={handleExport}
          activeOpacity={0.82}
          disabled={!canExport || isExporting}
        >
          <LinearGradient
            colors={canExport ? GRADIENTS.primaryShine : [C.elevated, C.elevated]}
            style={styles.exportBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Ionicons name="share-outline" size={17} color={canExport ? C.white : C.textMuted} />
            )}
            <Text style={[styles.exportBtnText, !canExport && { color: C.textMuted }]}>
              {isExporting ? (lang === 'en' ? 'Exporting...' : 'Duke eksportuar...') : (lang === 'en' ? 'Export report' : 'Shpërnda raportin')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Future: email scheduling placeholder */}
        <View style={styles.futureSection}>
          <View style={styles.futureTitleRow}>
            <Ionicons name="mail-outline" size={14} color={C.textFaint} />
            <Text style={styles.futureTitle}>{t('settingsEmailReports')}</Text>
            <View style={styles.futureBadge}>
              <Text style={styles.futureBadgeText}>{lang === 'en' ? 'SOON' : 'SE SHPEJTI'}</Text>
            </View>
          </View>
          <Text style={styles.futureSub}>
            {lang === 'en' ? 'Schedule automatic weekly or monthly reports directly to your email.' : 'Planifiko raporte automatike javore ose mujore direkt në emailin tënd.'}
          </Text>
          <View style={styles.futurePlaceholderBtn}>
            <Ionicons name="calendar-outline" size={14} color={C.textFaint} />
            <Text style={styles.futurePlaceholderText}>{lang === 'en' ? 'Schedule automatic reports' : 'Planifiko raporte automatike'}</Text>
            <Ionicons name="lock-closed" size={12} color={C.textFaint} />
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.6 },

  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    position: 'relative',
  },
  chipActive: { borderColor: C.primaryBorder },
  chipText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  chipTextActive: { color: C.white, fontWeight: '700' },

  customDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 4 },
  customDateField: { flex: 1, gap: 6 },
  customDateLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  customDateInput: {
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },

  formatRow: { flexDirection: 'row', gap: 12 },
  formatCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  formatCardActive: { borderColor: C.primaryBorder },
  formatIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  formatLabel: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  formatSub: { fontSize: 10, color: C.textMuted, textAlign: 'center' as any, lineHeight: 14 },
  formatCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  includeCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  includeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  includeLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  includeSub: { fontSize: 11, color: C.textMuted },
  includeDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },

  modeChipRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1,
    paddingVertical: 9,
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  modeChipActive: { borderColor: C.primaryBorder },
  modeChipText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  modeChipTextActive: { color: C.white, fontWeight: '700' },

  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  exportBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.36,
    shadowRadius: 12,
    elevation: 6,
  },
  exportBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  exportBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  exportBtnText: { fontSize: 15, fontWeight: '700', color: C.white, letterSpacing: -0.2 },

  futureSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
    opacity: 0.55,
  },
  futureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  futureTitle: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  futureBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.elevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  futureBadgeText: { fontSize: 8, fontWeight: '800', color: C.textFaint, letterSpacing: 0.6 },
  futureSub: { fontSize: 12, color: C.textFaint, lineHeight: 17 },
  futurePlaceholderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  futurePlaceholderText: { flex: 1, fontSize: 12, color: C.textFaint, fontWeight: '600' },
  });
}
