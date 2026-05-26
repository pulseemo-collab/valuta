import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { StatCard } from '@/components/dashboard/StatCard';
import { TransactionItem } from '@/components/dashboard/TransactionItem';
import { Card } from '@/components/ui/Card';
import { SyncingBanner } from '@/components/ui/SyncingBanner';
import { DashboardSkeleton } from '@/components/ui/SkeletonLoader';
import {
  formatCurrency,
  getTotalALL,
  getTodayTotal,
  getWeekTotal,
  getMonthTotal,
  getGreeting,
  getCategoryTotals,
  getWeeklyData,
  getMonthlyData,
  isThisMonth,
  getInsights,
  getSubscriptionMonthlyTotal,
  getGoalInsights,
  type InsightMessage,
} from '@/lib/utils';
import { detectRecurring, getRecurringInsights, getExpenseKey } from '@/lib/detectRecurring';
import { getBudgetAdvisory, getBudgetInsights } from '@/lib/budgetAdvisor';
import { C, GRADIENTS } from '@/constants/colors';
import { getCategoryById } from '@/constants/categories';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';
import type { CategoryId } from '@/types';

// ── Staggered entrance wrapper ─────────────────────────────────────────────
function AnimatedSection({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        delay,
        tension: 90,
        friction: 13,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity: fade, transform: [{ translateY: slide }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ── Animated count-up hook ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 1300, delay = 180) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    let startTime: number | null = null;

    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        const prog = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - prog, 3);
        setValue(Math.round(target * ease));
        if (prog < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return value;
}

function siColor(type: InsightMessage['type']): string {
  if (type === 'warning') return C.warning;
  if (type === 'positive') return C.primary;
  if (type === 'info') return C.accent;
  return C.textMuted;
}

function siBg(type: InsightMessage['type']): string {
  if (type === 'warning') return C.warningBgSubtle;
  if (type === 'positive') return C.primaryBgSubtle;
  if (type === 'info') return C.accentBgSubtle;
  return C.elevated;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state } = useStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 768;
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  const { expenses, budget } = state;

  const displayName = state.userName?.trim()
    ? state.userName.trim()
    : state.userEmail
    ? state.userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Valuta';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'V';

  // Spend computations
  const todayALL = getTodayTotal(expenses);
  const weekALL = getWeekTotal(expenses);
  const monthALL = getMonthTotal(expenses);
  const budgetPct = budget.monthly > 0 ? (monthALL / budget.monthly) * 100 : 0;
  const overWarning = budgetPct >= 80;
  const overBudget = monthALL > budget.monthly;

  // Insights computations
  const topCategories = getCategoryTotals(expenses).slice(0, 4);
  const weeklyData = getWeeklyData(expenses);
  const txCount = expenses.filter((e) => isThisMonth(e.date)).length;
  const daysElapsed = new Date().getDate();
  const avgDaily = daysElapsed > 0 ? monthALL / daysElapsed : 0;
  const biggestCat = topCategories[0]
    ? getCategoryById(topCategories[0].category as CategoryId)
    : null;

  // Business mode computations
  const isBizMode = state.mode === 'business';
  const bizExpenses = React.useMemo(
    () => expenses.filter((e) => e.mode === 'business'),
    [expenses]
  );
  const bizMonthTotal = React.useMemo(
    () => getTotalALL(bizExpenses.filter((e) => isThisMonth(e.date))),
    [bizExpenses]
  );
  const bizTopCategories = React.useMemo(
    () => getCategoryTotals(bizExpenses).filter((c) =>
      BUSINESS_CATEGORIES.some((bc) => bc.id === c.category)
    ).slice(0, 4),
    [bizExpenses]
  );
  const bizTxCount = bizExpenses.filter((e) => isThisMonth(e.date)).length;
  const bizMonthExpenses = React.useMemo(
    () => bizExpenses.filter((e) => isThisMonth(e.date)),
    [bizExpenses]
  );
  const bizFurnitorInvTotal = React.useMemo(
    () => getTotalALL(bizMonthExpenses.filter((e) => ['furnitor', 'inventar'].includes(e.category as string))),
    [bizMonthExpenses]
  );
  const bizOpCostTotal = React.useMemo(
    () => getTotalALL(bizMonthExpenses.filter((e) => ['zyre', 'punonjes', 'transport_biz', 'marketing_biz'].includes(e.category as string))),
    [bizMonthExpenses]
  );
  const bizTaxServiceTotal = React.useMemo(
    () => getTotalALL(bizMonthExpenses.filter((e) => ['taksa', 'sherbime'].includes(e.category as string))),
    [bizMonthExpenses]
  );

  const recent = (isBizMode ? bizExpenses : expenses).slice(0, 5);
  const animatedMonthALL = useCountUp(monthALL);
  const animatedBizMonthALL = useCountUp(bizMonthTotal);
  const isNewUser = !state.syncing && expenses.length === 0;

  const recurringPatterns = React.useMemo(() => detectRecurring(expenses), [expenses]);
  const recurringKeySet = React.useMemo(
    () => new Set(recurringPatterns.map((p) => p.key)),
    [recurringPatterns]
  );
  const recurringInsights = React.useMemo(
    () => getRecurringInsights(recurringPatterns),
    [recurringPatterns]
  );

  const budgetAdvisory = React.useMemo(
    () => getBudgetAdvisory(expenses, budget),
    [expenses, budget]
  );
  const budgetInsights = React.useMemo(
    () => getBudgetInsights(budgetAdvisory),
    [budgetAdvisory]
  );

  const dashInsights = React.useMemo(() => {
    // Priority: budget warnings first, then base insights, then recurring, then subscriptions
    const base = getInsights(expenses, { monthly: budget.monthly });
    const baseFiltered = base.filter(
      (i) => !i.icon.includes('warning') && !i.icon.includes('alert') && !i.icon.includes('calculator')
    ).slice(0, 1);

    // Subscription insights
    const activeSubCount = state.subscriptions.filter((s) => s.isActive).length;
    const subMonthlyTotal = getSubscriptionMonthlyTotal(state.subscriptions);
    const subInsights: InsightMessage[] = [];
    if (activeSubCount > 0) {
      subInsights.push({
        icon: 'apps-outline',
        text: `Ke ${activeSubCount} abonim${activeSubCount !== 1 ? 'e' : ''} aktiv${activeSubCount !== 1 ? 'e' : ''}`,
        type: 'info',
      });
    }
    if (subMonthlyTotal > 0) {
      subInsights.push({
        icon: 'repeat-outline',
        text: `Abonimet mujore: ${formatCurrency(Math.round(subMonthlyTotal), 'ALL')}`,
        type: 'info',
      });
    }

    // Goal insights
    const daysElapsedLocal = new Date().getDate();
    const avgSpend = daysElapsedLocal > 0 ? (budget.monthly > 0 ? getMonthTotal(expenses) / daysElapsedLocal * 30 : 0) : 0;
    const monthlySavingsEst = Math.max(budget.monthly - avgSpend, 0);
    const goalInsights = getGoalInsights(state.goals, monthlySavingsEst);

    const combined = [
      ...budgetInsights.slice(0, 1),
      ...baseFiltered,
      ...subInsights.slice(0, 1),
      ...goalInsights.slice(0, 1),
      ...recurringInsights.slice(0, 1),
    ];
    return combined.slice(0, 3);
  }, [expenses, budget, recurringInsights, budgetInsights, state.subscriptions, state.goals]);

  const bizSmartInsights = React.useMemo((): InsightMessage[] => {
    if (!isBizMode || bizMonthExpenses.length === 0) return [];
    const msgs: InsightMessage[] = [];
    if (bizTopCategories.length > 0) {
      const info = getCategoryById(bizTopCategories[0].category as CategoryId);
      msgs.push({ type: 'positive', icon: info.icon as any, text: `Kategoria kryesore e biznesit: ${info.name} — ${formatCurrency(Math.round(bizTopCategories[0].total), 'ALL')} (${bizTopCategories[0].percent.toFixed(0)}%)` });
    }
    if (bizOpCostTotal > 0 && bizMonthTotal > 0) {
      msgs.push({ type: 'info', icon: 'business-outline' as any, text: `Kosto operative: ${formatCurrency(Math.round(bizOpCostTotal), 'ALL')} — ${Math.round((bizOpCostTotal / bizMonthTotal) * 100)}% e shpenzimeve` });
    }
    if (bizTaxServiceTotal > 0) {
      msgs.push({ type: 'warning', icon: 'calculator-outline' as any, text: `Taksa dhe shërbime: ${formatCurrency(Math.round(bizTaxServiceTotal), 'ALL')} këtë muaj` });
    }
    if (msgs.length === 0 && bizFurnitorInvTotal > 0) {
      msgs.push({ type: 'info', icon: 'cube-outline' as any, text: `Furnitorë dhe inventar: ${formatCurrency(Math.round(bizFurnitorInvTotal), 'ALL')} këtë muaj` });
    }
    return msgs.slice(0, 3);
  }, [isBizMode, bizTopCategories, bizMonthTotal, bizOpCostTotal, bizTaxServiceTotal, bizFurnitorInvTotal, bizMonthExpenses]);

  const maxWeekVal = Math.max(...weeklyData.map((d) => d.value), 1);
  const todayDayIdx = new Date().getDay();

  // Monthly trend + projection
  const monthlyTrendData = getMonthlyData(expenses);
  const maxMonthlyVal = Math.max(...monthlyTrendData.map((d) => d.value), 1);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const projectedMonthly = daysElapsed > 0 ? (monthALL / daysElapsed) * daysInMonth : 0;
  const dailyLimitRemaining = daysRemaining > 0 ? Math.max((budget.monthly - monthALL) / daysRemaining, 0) : 0;
  const isOnTrack = projectedMonthly <= budget.monthly;

  // ── Hero section ──────────────────────────────────────────────────────────
  const heroSection = (
    <AnimatedSection delay={60}>
      <LinearGradient
        colors={GRADIENTS.heroRich}
        style={[styles.heroBanner, isDesktop && styles.heroBannerDesktop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />
        <View style={styles.heroGlow3} />
        <View style={styles.heroShimmerLine} />

        <Text style={[styles.heroLabel, isDesktop && styles.heroLabelDesktop]}>
          {isBizMode ? 'Shpenzime biznesi këtë muaj' : 'Shpenzuar këtë muaj'}
        </Text>
        <Text style={[styles.heroAmount, isDesktop && styles.heroAmountDesktop]}>
          {isBizMode ? formatCurrency(animatedBizMonthALL, 'ALL') : formatCurrency(animatedMonthALL, 'ALL')}
        </Text>

        <View style={styles.heroMeta}>
          <View
            style={[
              styles.heroBadge,
              !isNewUser && overBudget && { borderColor: C.dangerBorder, backgroundColor: C.dangerBgSubtle },
              !isNewUser && !overBudget && overWarning && {
                borderColor: C.warningBorder,
                backgroundColor: C.warningBgSubtle,
              },
              isBizMode && { borderColor: C.accentBorder, backgroundColor: C.accentBgSubtle },
            ]}
          >
            <View
              style={[
                styles.heroDot,
                { backgroundColor: isBizMode ? C.accentLight : isNewUser ? C.primary : overBudget ? C.danger : overWarning ? C.warning : C.primary },
              ]}
            />
            <Text
              style={[
                styles.heroBadgeText,
                { color: isBizMode ? C.accentLight : isNewUser ? C.primaryLight : overBudget ? C.danger : overWarning ? C.warning : C.primaryLight },
              ]}
            >
              {isBizMode
                ? (bizTxCount > 0 ? `${bizTxCount} transaksione biznesi` : 'Filloni me biznesi')
                : isNewUser ? 'Filloni sot' : `${budgetPct.toFixed(0)}% e buxhetit`}
            </Text>
          </View>
          {!isNewUser && (
            <TouchableOpacity onPress={() => router.push('/raporte' as any)}>
              <Text style={[styles.heroLink, isBizMode && { color: C.accentLight }]}>
                {isBizMode ? 'Shiko raportet →' : 'Shiko raportet →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Weekly mini sparkline */}
        <View style={styles.heroSparklineWrap}>
          <Text style={styles.heroSparklineHeading}>{isBizMode ? 'Kjo javë — biznesi' : 'Kjo javë'}</Text>
          <View style={[styles.heroSparkline, isDesktop && styles.heroSparklineDesktop]}>
            {weeklyData.map((d, i) => {
              const barH = Math.max((d.value / maxWeekVal) * (isDesktop ? 38 : 26), d.value > 0 ? 4 : 2);
              const isToday = i === todayDayIdx;
              return (
                <View key={i} style={styles.heroSparkBarOuter}>
                  <View
                    style={[
                      styles.heroSparkBar,
                      {
                        height: barH,
                        backgroundColor: isToday
                          ? '#34D399'
                          : d.value > 0
                          ? 'rgba(52,211,153,0.36)'
                          : 'rgba(255,255,255,0.07)',
                        shadowColor: isToday ? '#34D399' : undefined,
                        shadowOpacity: isToday ? 0.7 : 0,
                        shadowRadius: isToday ? 5 : 0,
                        elevation: isToday ? 3 : 0,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.heroSparkBarLabel,
                      { color: isToday ? 'rgba(52,211,153,0.9)' : 'rgba(148,163,184,0.4)' },
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </AnimatedSection>
  );

  // ── Insights strip ────────────────────────────────────────────────────────
  const insightsSection = (!isBizMode && (txCount > 0 || monthALL > 0)) ? (
    <AnimatedSection delay={130}>
      <View style={[styles.insightsStrip, isDesktop && styles.insightsStripDesktop]}>
        <View style={styles.insightItem}>
          <View style={[styles.insightIcon, { backgroundColor: C.accentBg }, isDesktop && styles.insightIconDesktop]}>
            <Ionicons name="receipt-outline" size={isDesktop ? 16 : 13} color={C.accentLight} />
          </View>
          <View style={styles.insightText}>
            <Text style={[styles.insightValue, isDesktop && styles.insightValueDesktop]}>{txCount}</Text>
            <Text style={[styles.insightLabel, isDesktop && styles.insightLabelDesktop]}>Transaksione</Text>
          </View>
        </View>

        <View style={[styles.insightDivider, isDesktop && styles.insightDividerDesktop]} />

        <View style={styles.insightItem}>
          <View style={[styles.insightIcon, { backgroundColor: C.primaryBg }, isDesktop && styles.insightIconDesktop]}>
            <Ionicons name="analytics-outline" size={isDesktop ? 16 : 13} color={C.primaryLight} />
          </View>
          <View style={styles.insightText}>
            <Text style={[styles.insightValue, isDesktop && styles.insightValueDesktop]} numberOfLines={1}>
              {formatCurrency(Math.round(avgDaily), 'ALL')}
            </Text>
            <Text style={[styles.insightLabel, isDesktop && styles.insightLabelDesktop]}>Mesatare/ditë</Text>
          </View>
        </View>

        {biggestCat && (
          <>
            <View style={[styles.insightDivider, isDesktop && styles.insightDividerDesktop]} />
            <View style={styles.insightItem}>
              <View style={[styles.insightIcon, { backgroundColor: biggestCat.bgColor }, isDesktop && styles.insightIconDesktop]}>
                <Ionicons name={biggestCat.icon as any} size={isDesktop ? 16 : 13} color={biggestCat.color} />
              </View>
              <View style={styles.insightText}>
                <Text style={[styles.insightValue, isDesktop && styles.insightValueDesktop]} numberOfLines={1}>
                  {biggestCat.name}
                </Text>
                <Text style={[styles.insightLabel, isDesktop && styles.insightLabelDesktop]}>Kategoria kryesore</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </AnimatedSection>
  ) : null;

  // ── Smart insights ────────────────────────────────────────────────────────
  const activeInsights = isBizMode ? bizSmartInsights : dashInsights;
  const smartInsightsSection = !isNewUser && activeInsights.length > 0 ? (
    <AnimatedSection delay={210}>
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop, isBizMode && { backgroundColor: C.accentLight }]} />
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              {isBizMode ? 'Sinjale biznesi' : 'Sinjale financiare'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/raporte' as any)}>
            <Text style={styles.seeAll}>Shiko analizat →</Text>
          </TouchableOpacity>
        </View>
        <Card>
          {activeInsights.map((insight, i) => (
            <View
              key={i}
              style={[
                styles.siRow,
                { borderLeftColor: siColor(insight.type) },
                i < activeInsights.length - 1 && styles.siRowBorder,
              ]}
            >
              <View style={[styles.siIcon, { backgroundColor: siBg(insight.type) }]}>
                <Ionicons name={insight.icon as any} size={14} color={siColor(insight.type)} />
              </View>
              <Text style={styles.siText}>{insight.text}</Text>
            </View>
          ))}
        </Card>
      </View>
    </AnimatedSection>
  ) : null;

  // ── Stats row ─────────────────────────────────────────────────────────────
  const statsSection = !isBizMode ? (
    <AnimatedSection delay={180}>
      <View style={[styles.statsRow, isDesktop && styles.statsRowDesktop]}>
        <StatCard
          label="Sot"
          value={formatCurrency(todayALL, 'ALL')}
          icon="today-outline"
          iconColor={C.accentLight}
          iconBg={C.accentBg}
          delay={180}
          large={isDesktop}
        />
        <StatCard
          label="Kjo javë"
          value={formatCurrency(weekALL, 'ALL')}
          icon="calendar-outline"
          iconColor={C.primaryLight}
          iconBg={C.primaryBg}
          highlight
          delay={240}
          large={isDesktop}
        />
        <StatCard
          label="Ky muaj"
          value={formatCurrency(monthALL, 'ALL')}
          icon="trending-down-outline"
          iconColor={overWarning ? C.warning : C.textSub}
          iconBg={overWarning ? C.warningBgSubtle : C.elevated}
          delay={300}
          large={isDesktop}
        />
      </View>
    </AnimatedSection>
  ) : null;

  // ── Business KPI cards ─────────────────────────────────────────────────────
  const bizKpiSection = isBizMode ? (
    <AnimatedSection delay={130}>
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop, { backgroundColor: C.accentLight }]} />
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Dashboard Biznesi</Text>
          </View>
          <View style={styles.bizBadge}>
            <Ionicons name="briefcase-outline" size={10} color={C.accentLight} />
            <Text style={styles.bizBadgeText}>BIZ</Text>
          </View>
        </View>
        <View style={[styles.bizKpiGrid, isDesktop && styles.bizKpiGridDesktop]}>
          {([
            { label: 'Shpenzime biznesi\nkëtë muaj', value: formatCurrency(Math.round(bizMonthTotal), 'ALL'), icon: 'trending-down-outline', color: C.accentLight, bg: C.accentBg, border: C.accentBorder },
            { label: 'Furnitorë /\nInventar', value: formatCurrency(Math.round(bizFurnitorInvTotal), 'ALL'), icon: 'cube-outline', color: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.28)' },
            { label: 'Kosto\noperative', value: formatCurrency(Math.round(bizOpCostTotal), 'ALL'), icon: 'business-outline', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.28)' },
            { label: 'Taksa /\nshërbime', value: formatCurrency(Math.round(bizTaxServiceTotal), 'ALL'), icon: 'calculator-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
          ] as const).map((kpi, idx) => (
            <View key={idx} style={[styles.bizKpiCard, isDesktop && styles.bizKpiCardDesktop]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.03)', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[styles.bizKpiIconWrap, { backgroundColor: kpi.bg, borderColor: kpi.border }]}>
                <Ionicons name={kpi.icon as any} size={isDesktop ? 17 : 14} color={kpi.color} />
              </View>
              <Text style={[styles.bizKpiValue, isDesktop && styles.bizKpiValueDesktop]} numberOfLines={1}>
                {kpi.value}
              </Text>
              <Text style={[styles.bizKpiLabel, isDesktop && styles.bizKpiLabelDesktop]}>{kpi.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </AnimatedSection>
  ) : null;

  // ── Budget card ───────────────────────────────────────────────────────────
  const budgetSection = (
    <AnimatedSection delay={220}>
      <Card style={[styles.budgetCard, isDesktop && styles.budgetCardDesktop]}>
        <View style={styles.budgetHeader}>
          <View style={{ gap: 3 }}>
            <Text style={[styles.budgetTitle, isDesktop && styles.budgetTitleDesktop]}>
              {isBizMode ? 'Buxheti i Biznesit' : 'Buxheti Mujor'}
            </Text>
            <Text style={[styles.budgetSub, isDesktop && styles.budgetSubDesktop]}>
              {formatCurrency(monthALL, 'ALL')} nga {formatCurrency(budget.monthly, 'ALL')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/buxheti' as any)}
            style={({ pressed, hovered }: any) => [
              styles.budgetEditBtn,
              hovered && styles.budgetEditBtnHovered,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="pencil" size={12} color={C.textSub} />
            <Text style={styles.budgetEditText}>Ndrysho</Text>
          </Pressable>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, isDesktop && styles.progressTrackDesktop]}>
          <LinearGradient
            colors={
              overBudget
                ? [C.danger, '#DC2626']
                : overWarning
                ? [C.warning, '#D97706']
                : GRADIENTS.primary
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, isDesktop && styles.progressFillDesktop, { width: `${Math.min(budgetPct, 100)}%` as any }]}
          />
          {/* Milestone ticks at 25 / 50 / 75 % */}
          {[25, 50, 75].map((pct) => (
            <View
              key={pct}
              style={[styles.milestoneTick, { left: `${pct}%` as any }]}
            />
          ))}
          {budgetPct > 5 && (
            <View
              style={[
                styles.progressDot,
                isDesktop && styles.progressDotDesktop,
                {
                  left: `${Math.min(budgetPct, 100)}%` as any,
                  backgroundColor: overBudget ? C.danger : overWarning ? C.warning : C.primary,
                  shadowColor: overBudget ? C.dangerGlow : overWarning ? C.warningGlow : C.primaryGlow,
                },
              ]}
            />
          )}
        </View>

        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelEdge}>0%</Text>
          {[25, 50, 75].map((p) => (
            <Text key={p} style={styles.progressLabelMid}>{p}%</Text>
          ))}
          <Text
            style={[
              styles.progressLabelPct,
              { color: overBudget ? C.danger : overWarning ? C.warning : C.textMuted },
            ]}
          >
            {budgetPct.toFixed(0)}%
          </Text>
        </View>

        {overWarning && (
          <View
            style={[
              styles.warningRow,
              {
                backgroundColor: overBudget ? C.dangerBgSubtle : C.warningBgSubtle,
                borderColor: overBudget ? C.dangerBorder : C.warningBorder,
              },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={14}
              color={overBudget ? C.danger : C.warning}
            />
            <Text style={[styles.warningText, { color: overBudget ? C.danger : C.warning }]}>
              {overBudget
                ? 'Ke tejkaluar buxhetin!'
                : `${(100 - budgetPct).toFixed(0)}% e buxhetit mbetet`}
            </Text>
          </View>
        )}
      </Card>
    </AnimatedSection>
  );

  // ── Spending Trend ────────────────────────────────────────────────────────
  const spendingTrendSection = (
    <AnimatedSection delay={248}>
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop]} />
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Trendi Mujor</Text>
          </View>
          <Text style={styles.trendSubLabel}>6 muajt e fundit</Text>
        </View>
        <Card style={isDesktop ? styles.trendCardDesktop : undefined}>
          <View style={[styles.trendChart, { height: isDesktop ? 96 : 72 }]}>
            {monthlyTrendData.map((d, i) => {
              const isCurrentMonth = i === monthlyTrendData.length - 1;
              const chartH = isDesktop ? 76 : 56;
              const barH = d.value > 0 ? Math.max((d.value / maxMonthlyVal) * chartH, 8) : 3;
              return (
                <View key={i} style={styles.trendBarCol}>
                  <View style={[styles.trendBarTrack, { height: chartH }]}>
                    <LinearGradient
                      colors={
                        isCurrentMonth
                          ? ['#34D399', '#10B981']
                          : ['rgba(148,163,184,0.24)', 'rgba(148,163,184,0.08)']
                      }
                      style={[styles.trendBarFill, { height: barH }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                  </View>
                  <Text style={[styles.trendBarLbl, isCurrentMonth && styles.trendBarLblActive]}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.trendFooter}>
            <Text style={styles.trendFooterText}>
              {'Mesatare: '}
              {formatCurrency(
                Math.round(
                  monthlyTrendData.reduce((s, d) => s + d.value, 0) /
                    (monthlyTrendData.filter((d) => d.value > 0).length || 1)
                ),
                'ALL'
              )}
              {'/muaj'}
            </Text>
            <Text style={[styles.trendFooterAccent, { color: isOnTrack ? C.primaryLight : C.warning }]}>
              {isOnTrack ? '↑ Brenda buxhetit' : '↓ Mbi buxhetin'}
            </Text>
          </View>
        </Card>
      </View>
    </AnimatedSection>
  );

  // ── Monthly Projection ────────────────────────────────────────────────────
  const monthlyGoalSection = (
    <AnimatedSection delay={190}>
      <Card style={isDesktop ? styles.goalCardDesktop : undefined}>
        <View style={styles.goalHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.goalTitle, isDesktop && styles.goalTitleDesktop]}>Parashikimi Mujor</Text>
            <Text style={styles.goalSub}>
              {daysElapsed} ditë të kaluara · {daysRemaining} mbeten
            </Text>
          </View>
          <View
            style={[
              styles.goalStatusBadge,
              {
                backgroundColor: isOnTrack ? C.primaryBg : C.warningBgSubtle,
                borderColor: isOnTrack ? C.primaryBorder : C.warningBorder,
              },
            ]}
          >
            <View style={[styles.goalStatusDot, { backgroundColor: isOnTrack ? C.primary : C.warning }]} />
            <Text style={[styles.goalStatusText, { color: isOnTrack ? C.primaryLight : C.warning }]}>
              {isOnTrack ? 'Në rrugë' : 'Risk tejkalimi'}
            </Text>
          </View>
        </View>

        <View style={styles.goalMetrics}>
          <View style={styles.goalMetric}>
            <Text
              style={[styles.goalMetricValue, isDesktop && styles.goalMetricValueDesktop]}
              numberOfLines={1}
            >
              {formatCurrency(Math.round(projectedMonthly), 'ALL')}
            </Text>
            <Text style={styles.goalMetricLabel}>Parashikim</Text>
          </View>
          <View style={styles.goalMetricDivider} />
          <View style={styles.goalMetric}>
            <Text
              style={[
                styles.goalMetricValue,
                isDesktop && styles.goalMetricValueDesktop,
                { color: dailyLimitRemaining > 0 ? C.primaryLight : C.danger },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(Math.round(dailyLimitRemaining), 'ALL')}
            </Text>
            <Text style={styles.goalMetricLabel}>Limit/ditë</Text>
          </View>
        </View>

        <View style={styles.goalProgTrack}>
          <LinearGradient
            colors={
              projectedMonthly > budget.monthly
                ? [C.danger, '#DC2626']
                : isOnTrack
                ? GRADIENTS.primary
                : [C.warning, '#D97706']
            }
            style={[
              styles.goalProgFill,
              { width: `${Math.min((projectedMonthly / budget.monthly) * 100, 100)}%` as any },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
        <View style={styles.goalProgLabels}>
          <Text style={styles.goalProgLabel}>0 L</Text>
          <Text style={[styles.goalProgLabel, { color: isOnTrack ? C.primaryLight : C.warning }]}>
            {((projectedMonthly / (budget.monthly || 1)) * 100).toFixed(0)}% i parashikuar
          </Text>
          <Text style={styles.goalProgLabel}>{formatCurrency(budget.monthly, 'ALL')}</Text>
        </View>
      </Card>
    </AnimatedSection>
  );

  // ── Category highlights ───────────────────────────────────────────────────
  const activeCatData = isBizMode ? bizTopCategories : topCategories;
  const categoriesSection =
    activeCatData.length > 0 ? (
      <AnimatedSection delay={270}>
        <View>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop, isBizMode && { backgroundColor: C.accentLight }]} />
              <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                {isBizMode ? 'Kategoritë e biznesit' : 'Kategoritë kryesore'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/raporte' as any)}>
              <Text style={styles.seeAll}>Shiko →</Text>
            </TouchableOpacity>
          </View>

          <Card style={isDesktop ? { padding: 22 } : undefined}>
            <View style={{ gap: isDesktop ? 20 : 16 }}>
              {activeCatData.map((cat) => {
                const info = getCategoryById(cat.category as CategoryId);
                return (
                  <View key={cat.category} style={styles.catRow}>
                    <View
                      style={[
                        styles.catIcon,
                        { backgroundColor: info.bgColor, borderColor: info.color + '28' },
                        isDesktop && styles.catIconDesktop,
                      ]}
                    >
                      <Ionicons name={info.icon as any} size={isDesktop ? 18 : 15} color={info.color} />
                    </View>
                    <View style={styles.catDetails}>
                      <View style={styles.catTopRow}>
                        <Text style={[styles.catName, isDesktop && styles.catNameDesktop]}>{info.name}</Text>
                        <View style={styles.catRight}>
                          <Text style={[styles.catPct, { color: info.color }]}>
                            {cat.percent.toFixed(0)}%
                          </Text>
                          <Text style={[styles.catAmount, isDesktop && styles.catAmountDesktop]}>
                            {formatCurrency(cat.total, 'ALL')}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.catBarTrack, isDesktop && styles.catBarTrackDesktop]}>
                        <View
                          style={[
                            styles.catBarFill,
                            {
                              width: `${cat.percent}%` as any,
                              backgroundColor: info.color,
                              shadowColor: info.color,
                              shadowOpacity: 0.45,
                              shadowRadius: 4,
                              elevation: 2,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      </AnimatedSection>
    ) : null;

  // ── Recent transactions ───────────────────────────────────────────────────
  const transactionsSection = (
    <AnimatedSection delay={310}>
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop, isBizMode && { backgroundColor: C.accentLight }]} />
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              {isBizMode ? 'Transaksionet e biznesit' : 'Transaksionet e fundit'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/historia' as any)}>
            <Text style={styles.seeAll}>Shiko të gjitha →</Text>
          </TouchableOpacity>
        </View>

        <Card style={isDesktop ? { padding: 22 } : undefined}>
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <LinearGradient
                colors={isBizMode ? ['rgba(59,130,246,0.16)', 'rgba(59,130,246,0.05)'] : ['rgba(16,185,129,0.16)', 'rgba(16,185,129,0.05)']}
                style={[styles.emptyIconWrap, isBizMode && { borderColor: C.accentBorder }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={isBizMode ? 'briefcase-outline' : 'receipt-outline'} size={30} color={isBizMode ? C.accentLight : C.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>
                {isBizMode ? 'Asnjë shpenzim biznesi' : 'Nuk ka transaksione akoma'}
              </Text>
              <Text style={styles.emptySub}>
                {isBizMode ? 'Shto shpenzimin e parë të biznesit' : 'Shto shpenzimin tënd të parë'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyAction, isBizMode && { shadowColor: C.accent }]}
                onPress={() => router.push('/shto' as any)}
                activeOpacity={0.78}
              >
                <LinearGradient
                  colors={isBizMode ? ['#3B82F6', '#2563EB'] : GRADIENTS.primaryShine}
                  style={styles.emptyActionGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="add" size={16} color={C.white} />
                  <Text style={styles.emptyActionText}>
                    {isBizMode ? 'Shto shpenzim biznesi' : 'Shto shpenzim'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {recent.map((expense, i) => {
                const expKey = getExpenseKey(expense);
                return (
                  <React.Fragment key={expense.id}>
                    <TransactionItem
                      expense={expense}
                      isRecurring={expKey !== '' && recurringKeySet.has(expKey)}
                    />
                    {i < recent.length - 1 && <View style={[styles.separator, isDesktop && styles.separatorDesktop]} />}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </Card>
      </View>
    </AnimatedSection>
  );

  // ── Business Reports Card ─────────────────────────────────────────────────
  const bizReportsCard = isBizMode ? (
    <AnimatedSection delay={340}>
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccent, isDesktop && styles.sectionAccentDesktop, { backgroundColor: C.accentLight }]} />
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Raporte biznesi</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/raporte' as any)}>
            <Text style={[styles.seeAll, { color: C.accentLight }]}>Hap →</Text>
          </TouchableOpacity>
        </View>
        <Card style={isDesktop ? { padding: 22 } : undefined}>
          <View style={{ gap: 14 }}>
            {([
              { icon: 'bar-chart-outline', label: 'Analiza e shpenzimeve', sub: 'Shpenzimet sipas kategorive', color: C.accentLight, bg: C.accentBg, border: C.accentBorder },
              { icon: 'trending-down-outline', label: 'Trendi mujor', sub: '6 muajt e fundit të biznesit', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.28)' },
              { icon: 'calculator-outline', label: 'Taksa & shërbime', sub: 'Kostot operative këtë muaj', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
            ] as const).map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.bizReportRow}
                onPress={() => router.push('/raporte' as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.bizReportIcon, { backgroundColor: item.bg, borderColor: item.border }]}>
                  <Ionicons name={item.icon as any} size={isDesktop ? 17 : 14} color={item.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.bizReportLabel, isDesktop && { fontSize: 14 }]}>{item.label}</Text>
                  <Text style={styles.bizReportSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </View>
    </AnimatedSection>
  ) : null;

  // ── Welcome empty state ───────────────────────────────────────────────────
  const welcomeSection = (
    <AnimatedSection delay={120}>
      <View style={[styles.wcCard, isDesktop && styles.wcCardDesktop]}>
        <LinearGradient
          colors={['rgba(16,185,129,0.09)', 'rgba(59,130,246,0.05)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <Text style={styles.wcHeading}>Si funksionon Valuta</Text>

        <View style={styles.wcSteps}>
          {([
            { icon: 'add-circle-outline', title: 'Regjistro shpenzimet', sub: 'Shto çdo shpenzim me kategorinë dhe datën', iconBg: C.primaryBg, iconBorder: C.primaryBorder, iconColor: C.primary },
            { icon: 'wallet-outline', title: 'Vendos buxhetin', sub: 'Cakto limit mujor dhe gjurmo progresin', iconBg: C.accentBg, iconBorder: C.accentBorder, iconColor: C.accentLight },
            { icon: 'bar-chart-outline', title: 'Eksploro analizat', sub: 'Kuptoji zakonet tuaja financiare', iconBg: C.warningBgSubtle, iconBorder: C.warningBorder, iconColor: C.warning },
          ] as const).map((step, i) => (
            <View key={step.icon}>
              <View style={styles.wcStep}>
                <View style={[styles.wcStepIcon, { backgroundColor: step.iconBg, borderColor: step.iconBorder }]}>
                  <Ionicons name={step.icon as any} size={18} color={step.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wcStepTitle}>{step.title}</Text>
                  <Text style={styles.wcStepSub}>{step.sub}</Text>
                </View>
              </View>
              {i < 2 && <View style={styles.wcConnector} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.wcBtn}
          onPress={() => router.push('/shto' as any)}
          activeOpacity={0.84}
        >
          <LinearGradient
            colors={GRADIENTS.primaryShine}
            style={styles.wcBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={styles.wcBtnText}>Shto shpenzimin e parë</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.wcSecondary}
          onPress={() => router.push('/buxheti' as any)}
          activeOpacity={0.78}
        >
          <Ionicons name="wallet-outline" size={14} color={C.primary} />
          <Text style={styles.wcSecondaryText}>Vendos buxhetin tënd →</Text>
        </TouchableOpacity>
      </View>
    </AnimatedSection>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      >
        {/* Header — always full width */}
        <AnimatedSection delay={0}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greeting, isDesktop && styles.greetingDesktop]}>{getGreeting()}</Text>
              <View style={styles.nameRow}>
                <Text style={[styles.name, isDesktop && styles.nameDesktop]}>{displayName}</Text>
                {isBizMode && (
                  <View style={styles.headerBizBadge}>
                    <Ionicons name="briefcase-outline" size={9} color={C.accentLight} />
                    <Text style={styles.headerBizBadgeText}>BIZNES</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed, hovered }: any) => [
                  styles.iconBtn,
                  isDesktop && styles.iconBtnDesktop,
                  hovered && styles.iconBtnHovered,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="notifications-outline" size={isDesktop ? 22 : 20} color={C.textSub} />
              </Pressable>
              <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
                <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>{initials}</Text>
              </View>
            </View>
          </View>
        </AnimatedSection>

        <SyncingBanner />

        {state.syncing && state.expenses.length === 0 ? (
          <DashboardSkeleton />
        ) : isNewUser ? (
          /* New user — hero + welcome steps */
          <>
            {heroSection}
            {welcomeSection}
          </>
        ) : isDesktop ? (
          /* Desktop — two-column grid */
          <View style={styles.desktopGrid}>
            <View style={styles.desktopLeft}>
              {heroSection}
              {insightsSection}
              {statsSection}
              {bizKpiSection}
              {smartInsightsSection}
              {!isBizMode && spendingTrendSection}
              {budgetSection}
            </View>
            <View style={styles.desktopRight}>
              {!isBizMode && monthlyGoalSection}
              {categoriesSection}
              {transactionsSection}
              {bizReportsCard}
            </View>
          </View>
        ) : (
          /* Mobile/tablet — single column */
          <>
            {heroSection}
            {insightsSection}
            {statsSection}
            {bizKpiSection}
            {smartInsightsSection}
            {budgetSection}
            {categoriesSection}
            {transactionsSection}
            {bizReportsCard}
          </>
        )}

        <View style={{ height: isMobile ? 100 : 24 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 18 },
  contentDesktop: { paddingHorizontal: 32, maxWidth: 1680 as any, alignSelf: 'center' as any, width: '100%' as any, gap: 26, paddingTop: 18 },

  // ── Desktop grid ─────────────────────────────────────────
  desktopGrid: { flexDirection: 'row', gap: 36, alignItems: 'flex-start' },
  desktopLeft: { flex: 5, minWidth: 0, gap: 26 },
  desktopRight: { flex: 3, minWidth: 0, gap: 26 },

  // ── Header ───────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as any,
  },
  headerBizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accentBorder,
    marginBottom: 2,
  },
  headerBizBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 0.7,
  },
  greeting: { fontSize: 13, color: C.textMuted, fontWeight: '500', marginBottom: 2 },
  name: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  greetingDesktop: { fontSize: 15 },
  nameDesktop: { fontSize: 28, letterSpacing: -0.8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBtnHovered: { backgroundColor: C.floating, borderColor: C.borderLight },
  iconBtnDesktop: { width: 46, height: 46, borderRadius: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  avatarDesktop: { width: 46, height: 46, borderRadius: 14 },
  avatarText: { fontSize: 12, fontWeight: '800', color: C.primary },
  avatarTextDesktop: { fontSize: 14 },

  // ── Hero banner ───────────────────────────────────────────
  heroBanner: {
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 14,
  },
  heroGlow1: {
    position: 'absolute', top: -50, right: -30,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  heroGlow2: {
    position: 'absolute', bottom: -60, left: 10,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(59,130,246,0.11)',
  },
  heroGlow3: {
    position: 'absolute', top: 20, left: -25,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(16,185,129,0.07)',
  },
  heroShimmerLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  heroLabel: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.75)',
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -1.6,
    marginBottom: 16,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 13, fontWeight: '600' },
  heroLink: { fontSize: 13, color: C.accentLight, fontWeight: '600' },

  // Hero sparkline
  heroSparklineWrap: {
    marginTop: 2,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  heroSparklineHeading: {
    fontSize: 9,
    color: 'rgba(148,163,184,0.5)',
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroSparkline: {
    flexDirection: 'row',
    height: 44,
    gap: 4,
  },
  heroSparkBarOuter: {
    flex: 1,
    height: '100%' as any,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 3,
  },
  heroSparkBar: {
    width: '100%' as any,
    maxWidth: 14,
    borderRadius: 2.5,
  },
  heroSparkBarLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // ── Insights strip ────────────────────────────────────────
  insightsStrip: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  insightItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  insightIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  insightText: { flex: 1, minWidth: 0 },
  insightValue: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  insightLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  insightDivider: {
    width: 1,
    height: 34,
    backgroundColor: C.border,
    marginHorizontal: 6,
  },

  // ── Stats row ─────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10 },

  // ── Budget card ───────────────────────────────────────────
  budgetCard: {},
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  budgetTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  budgetSub: { fontSize: 12, color: C.textMuted },
  budgetEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: C.elevated,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  budgetEditBtnHovered: { backgroundColor: C.floating, borderColor: C.border },
  budgetEditText: { fontSize: 12, color: C.textSub, fontWeight: '600' },
  progressTrack: {
    height: 10,
    backgroundColor: C.elevated,
    borderRadius: 5,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: { height: '100%', borderRadius: 5 },
  milestoneTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: C.bg,
    zIndex: 2,
    opacity: 0.55,
  },
  progressDot: {
    position: 'absolute',
    top: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: C.bg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabelEdge: { fontSize: 10, color: C.textFaint, fontWeight: '500' },
  progressLabelMid: { fontSize: 9, color: C.textFaint, fontWeight: '500' },
  progressLabelPct: { fontSize: 11, fontWeight: '700' },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // ── Section header ────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.primary,
    opacity: 0.7,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },

  // ── Category rows ─────────────────────────────────────────
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  catDetails: { flex: 1, gap: 7 },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 13, fontWeight: '700', color: C.text },
  catPct: { fontSize: 12, fontWeight: '700' },
  catAmount: { fontSize: 12, color: C.textSub, fontWeight: '600' },
  catBarTrack: {
    height: 4,
    backgroundColor: C.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Transactions ──────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: -16,
    opacity: 0.65,
  },

  // ── Empty state ───────────────────────────────────────────
  empty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textSub },
  emptySub: { fontSize: 13, color: C.textMuted },
  emptyAction: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyActionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: C.white },

  // ── Desktop scale variants ────────────────────────────────
  heroBannerDesktop: { padding: 36, borderRadius: 30 },
  heroLabelDesktop: { fontSize: 13, letterSpacing: 0.8, marginBottom: 12 },
  heroAmountDesktop: { fontSize: 60, letterSpacing: -2.4, marginBottom: 28 },
  heroSparklineDesktop: { height: 64 },
  insightsStripDesktop: { paddingVertical: 20, paddingHorizontal: 28, borderRadius: 20 },
  insightIconDesktop: { width: 40, height: 40, borderRadius: 12 },
  insightValueDesktop: { fontSize: 15, letterSpacing: -0.4 },
  insightLabelDesktop: { fontSize: 12, marginTop: 2 },
  insightDividerDesktop: { height: 42 },
  statsRowDesktop: { gap: 16 },
  budgetCardDesktop: { padding: 28 },
  budgetTitleDesktop: { fontSize: 17 },
  budgetSubDesktop: { fontSize: 13, marginTop: 2 },
  progressTrackDesktop: { height: 12, borderRadius: 6 },
  progressFillDesktop: { borderRadius: 6 },
  progressDotDesktop: { width: 20, height: 20, borderRadius: 10, top: -4, marginLeft: -10, borderWidth: 2.5 },
  sectionTitleDesktop: { fontSize: 18, letterSpacing: -0.4 },
  sectionAccentDesktop: { width: 4, height: 20 },
  catIconDesktop: { width: 46, height: 46, borderRadius: 14 },
  catNameDesktop: { fontSize: 14 },
  catAmountDesktop: { fontSize: 13 },
  catBarTrackDesktop: { height: 6 },
  separatorDesktop: { marginHorizontal: -20 },

  // ── Spending Trend ────────────────────────────────────────
  trendSubLabel: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  trendCardDesktop: { padding: 24 },
  trendChart: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trendBarTrack: {
    width: '100%' as any,
    justifyContent: 'flex-end' as any,
    alignItems: 'center',
  },
  trendBarFill: {
    width: '100%' as any,
    maxWidth: 30,
    borderRadius: 5,
    minHeight: 3,
  },
  trendBarLbl: {
    fontSize: 9,
    color: C.textFaint,
    fontWeight: '600',
    textAlign: 'center' as any,
    letterSpacing: 0.2,
  },
  trendBarLblActive: { color: C.primaryLight },
  trendFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  trendFooterText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  trendFooterAccent: { fontSize: 11, fontWeight: '700' },

  // ── Monthly Goal / Projection ─────────────────────────────
  goalCardDesktop: { padding: 26 },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 10,
  },
  goalTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  goalTitleDesktop: { fontSize: 17 },
  goalSub: { fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 3 },
  goalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
  },
  goalStatusDot: { width: 5, height: 5, borderRadius: 3 },
  goalStatusText: { fontSize: 10, fontWeight: '700' },
  goalMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  goalMetric: { flex: 1, alignItems: 'center', gap: 4 },
  goalMetricDivider: { width: 1, height: 40, backgroundColor: C.border },
  goalMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
    textAlign: 'center' as any,
  },
  goalMetricValueDesktop: { fontSize: 17 },
  goalMetricLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '500',
    textAlign: 'center' as any,
  },
  goalProgTrack: {
    height: 8,
    backgroundColor: C.elevated,
    borderRadius: 4,
    overflow: 'hidden' as any,
  },
  goalProgFill: { height: '100%' as any, borderRadius: 4 },
  goalProgLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalProgLabel: { fontSize: 10, color: C.textFaint, fontWeight: '500' },

  // ── Welcome empty state ───────────────────────────────────────────────────
  wcCard: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    gap: 20,
    position: 'relative',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  wcCardDesktop: { maxWidth: 540, alignSelf: 'center' as any, width: '100%' as any, padding: 34 },
  wcHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  wcSteps: { gap: 0 },
  wcStep: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  wcConnector: {
    width: 1,
    height: 12,
    backgroundColor: C.borderLight,
    marginLeft: 21,
    opacity: 0.7,
  },
  wcStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  wcStepTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  wcStepSub: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
  wcBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  wcBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  wcBtnText: { fontSize: 15, fontWeight: '800', color: C.white, letterSpacing: 0.1 },
  wcSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  wcSecondaryText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  // ── Smart insights ────────────────────────────────────────
  siRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingLeft: 10,
    borderLeftWidth: 2,
    marginLeft: 2,
  },
  siRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  siIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  siText: {
    flex: 1,
    fontSize: 13,
    color: C.textSub,
    fontWeight: '500',
    lineHeight: 18,
    paddingTop: 3,
  },

  // ── Business dashboard panel ──────────────────────────────
  bizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: C.accentBgSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  bizBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 0.8,
  },
  bizTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  bizTotalItem: {
    flex: 1,
    gap: 3,
  },
  bizTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  bizTotalLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
  },
  bizTotalDivider: {
    width: 1,
    height: 40,
    backgroundColor: C.border,
  },
  bizEmptyRow: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  bizEmptyText: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },
  bizEmptyLink: {
    fontSize: 13,
    color: C.accentLight,
    fontWeight: '700',
  },
  bizPlaceholderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bizPlaceholderCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: C.card,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  bizPlaceholderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentBgSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizPlaceholderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSub,
    textAlign: 'center' as any,
  },
  bizPlaceholderSub: {
    fontSize: 10,
    color: C.textFaint,
    fontWeight: '500',
    textAlign: 'center' as any,
  },

  // ── Business Reports Card ─────────────────────────────────────────────────
  bizReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  bizReportIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  bizReportLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },
  bizReportSub: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
  },

  // ── Business KPI grid ─────────────────────────────────────────────────────
  bizKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as any,
    gap: 10,
  },
  bizKpiGridDesktop: { gap: 14 },
  bizKpiCard: {
    flex: 1,
    minWidth: '45%' as any,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: C.card,
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  bizKpiCardDesktop: { padding: 18, borderRadius: 18, gap: 8 },
  bizKpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  bizKpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  bizKpiValueDesktop: { fontSize: 19, letterSpacing: -0.7 },
  bizKpiLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '500',
    lineHeight: 14,
  },
  bizKpiLabelDesktop: { fontSize: 11, lineHeight: 16 },
});
