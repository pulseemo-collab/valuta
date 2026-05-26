import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { SyncingBanner } from '@/components/ui/SyncingBanner';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { CATEGORIES } from '@/constants/categories';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';
import {
  formatCurrency,
  getWeeklyData,
  getMonthlyData,
  getCategoryTotals,
  getTotalALL,
  getMonthComparison,
  getWeekComparison,
  getInsights,
  isThisMonth,
  getMonthTotal,
  type InsightMessage,
} from '@/lib/utils';
import {
  detectRecurring,
  getFrequencyLabel,
  getNextLabel,
  type RecurringPattern,
} from '@/lib/detectRecurring';
import { getBudgetAdvisory, getBudgetInsights } from '@/lib/budgetAdvisor';
import {
  generateAdviceCards,
  type AdviceCard,
  type AdviceType,
} from '@/lib/financialCoach';
import { SUBSCRIPTION_PRESETS, type SubscriptionPreset } from '@/constants/subscriptions';
import { generateId, computeNextPaymentDate, getSubscriptionMonthlyTotal } from '@/lib/utils';
import type { Subscription } from '@/types';
import { C, GRADIENTS } from '@/constants/colors';

type Period = 'java' | 'muaji';

function insightBorderColor(type: InsightMessage['type']): string {
  switch (type) {
    case 'warning': return C.warning;
    case 'positive': return C.primary;
    case 'info': return C.accent;
    default: return C.textMuted;
  }
}

function insightIconBg(type: InsightMessage['type']): string {
  switch (type) {
    case 'warning': return C.warningBgSubtle;
    case 'positive': return C.primaryBgSubtle;
    case 'info': return C.accentBgSubtle;
    default: return C.elevated;
  }
}

function insightIconColor(type: InsightMessage['type']): string {
  switch (type) {
    case 'warning': return C.warning;
    case 'positive': return C.primary;
    case 'info': return C.accentLight;
    default: return C.textMuted;
  }
}

export default function Raporte() {
  const { state, addSubscription, removeSubscription, toggleSubscription } = useStore();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('java');
  const [showPresets, setShowPresets] = useState(false);

  const isBizMode = state.mode === 'business';
  const effectiveExpenses = useMemo(
    () => isBizMode ? state.expenses.filter((e) => e.mode === 'business') : state.expenses,
    [state.expenses, isBizMode]
  );

  const chartData = period === 'java'
    ? getWeeklyData(effectiveExpenses)
    : getMonthlyData(effectiveExpenses);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const activeIdx = chartData.findIndex((d) => d.value === Math.max(...chartData.map((v) => v.value)));

  // This-month analytics
  const thisMonthExpenses = effectiveExpenses.filter((e) => isThisMonth(e.date));
  const thisMonthTotal = getMonthTotal(effectiveExpenses);
  const thisMonthCount = thisMonthExpenses.length;
  const daysElapsed = new Date().getDate();
  const avgDailyMonth = thisMonthCount > 0 && daysElapsed > 0 ? thisMonthTotal / daysElapsed : 0;

  // Category totals for this month and all time
  const categoryTotalsMonth = getCategoryTotals(thisMonthExpenses);
  const categoryTotalsAll = getCategoryTotals(effectiveExpenses);
  const totalAllTime = getTotalALL(effectiveExpenses);

  // Comparisons
  const monthComp = getMonthComparison(effectiveExpenses);
  const weekComp = getWeekComparison(effectiveExpenses);

  // Insights
  const insights = getInsights(effectiveExpenses, { monthly: state.budget.monthly });

  // Recurring pattern detection
  const recurringPatterns = useMemo(
    () => detectRecurring(effectiveExpenses),
    [effectiveExpenses]
  );

  // Budget advisory
  const budgetAdvisory = useMemo(
    () => getBudgetAdvisory(effectiveExpenses, state.budget),
    [effectiveExpenses, state.budget]
  );
  const budgetInsightMessages = useMemo(
    () => getBudgetInsights(budgetAdvisory),
    [budgetAdvisory]
  );

  // AI coach advice cards
  const adviceCards = useMemo(
    () => generateAdviceCards(effectiveExpenses, state.budget, recurringPatterns, budgetAdvisory),
    [effectiveExpenses, state.budget, recurringPatterns, budgetAdvisory]
  );

  // Merge budget insights into the insights list (prepend critical budget signals)
  const allInsights = useMemo(() => {
    const budgetWarnings = budgetInsightMessages.filter((i) => i.type === 'warning');
    const rest = insights.filter(
      (i) => !i.icon.includes('warning') && !i.icon.includes('alert') && !i.icon.includes('calculator')
    );
    return [...budgetWarnings, ...rest].slice(0, 8);
  }, [insights, budgetInsightMessages]);

  const allCats = isBizMode ? BUSINESS_CATEGORIES : CATEGORIES;

  const donutData = categoryTotalsAll.slice(0, 6).map((item) => {
    const cat = allCats.find((c) => c.id === item.category);
    return cat ? {
      value: item.total,
      color: cat.color,
      label: cat.name,
    } : null;
  }).filter(Boolean) as Array<{ value: number; color: string; label: string }>;

  const isNewUser = !state.syncing && effectiveExpenses.length === 0;
  const isLoadingSkeleton = state.syncing && state.expenses.length === 0;

  // Subscriptions
  const activeSubCount = state.subscriptions.filter((s) => s.isActive).length;
  const subMonthlyTotal = useMemo(
    () => getSubscriptionMonthlyTotal(state.subscriptions),
    [state.subscriptions]
  );

  const handleAddPreset = (preset: SubscriptionPreset) => {
    const alreadyExists = state.subscriptions.some(
      (s) => s.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (alreadyExists) return;
    const today = new Date().toISOString().slice(0, 10);
    const newSub: Subscription = {
      id: generateId(),
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      bgColor: preset.bgColor,
      amount: preset.defaultAmount,
      currency: preset.defaultCurrency,
      frequency: 'monthly',
      startDate: today,
      nextPaymentDate: computeNextPaymentDate(today, 'monthly'),
      isActive: true,
      categoryId: preset.categoryId,
    };
    addSubscription(newSub);
    setShowPresets(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.pageTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Text style={styles.pageTitle}>{isBizMode ? 'Raporte Biznesi' : 'Raporte'}</Text>
            {isBizMode && (
              <View style={styles.pageBizBadge}>
                <Ionicons name="briefcase-outline" size={11} color={C.accentLight} />
                <Text style={styles.pageBizBadgeText}>MOD BIZNES</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => router.push('/export' as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="share-outline" size={15} color={C.primary} />
            <Text style={styles.shareBtnText}>Eksporto</Text>
          </TouchableOpacity>
        </View>

        <SyncingBanner />

        {/* Skeleton while syncing */}
        {isLoadingSkeleton && (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[0, 1, 2].map((i) => <CardSkeleton key={i} height={80} />)}
            </View>
            <CardSkeleton height={240} />
            <CardSkeleton height={180} />
          </View>
        )}

        {/* New user empty state */}
        {isNewUser && (
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={['rgba(16,185,129,0.16)', 'rgba(16,185,129,0.04)']}
              style={styles.emptyIconWrap}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="bar-chart-outline" size={30} color={C.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {isBizMode ? 'Raportet e biznesit po ju presin' : 'Raportet po ju presin'}
            </Text>
            <Text style={styles.emptySub}>
              {isBizMode
                ? 'Regjistro shpenzimet e biznesit dhe do\ntë shohësh KPI, analiza dhe tendenca.'
                : 'Regjistro shpenzimet dhe do të shohësh\ngrafikë, analiza dhe tendenca.'}
            </Text>

            <View style={styles.emptyTeasers}>
              {(isBizMode ? [
                { icon: 'bar-chart-outline', label: 'KPI biznesi' },
                { icon: 'pie-chart-outline', label: 'Sipas kategorisë' },
                { icon: 'trending-up-outline', label: 'Kosto operative' },
              ] : [
                { icon: 'bar-chart-outline', label: 'Grafik javor' },
                { icon: 'pie-chart-outline', label: 'Sipas kategorisë' },
                { icon: 'trending-up-outline', label: 'Tendenca mujore' },
              ] as const).map((t) => (
                <View key={t.icon} style={styles.emptyTeaser}>
                  <Ionicons name={t.icon as any} size={20} color={C.textMuted} />
                  <Text style={styles.emptyTeaserText}>{t.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/shto' as any)}
              activeOpacity={0.78}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine}
                style={styles.emptyBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={16} color={C.white} />
                <Text style={styles.emptyBtnText}>Shto shpenzimin e parë</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Content — only shown when there are expenses */}
        {!isLoadingSkeleton && !isNewUser && (
        <>
        {/* Summary Row — this month stats */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Këtë muaj"
            value={formatCurrency(Math.round(thisMonthTotal), 'ALL')}
            icon="calendar-outline"
            iconColor={C.accentLight}
            iconBg={C.accentBg}
            iconBorder={C.accentBorder}
          />
          <SummaryCard
            label="Mesatare/ditë"
            value={formatCurrency(Math.round(avgDailyMonth), 'ALL')}
            icon="stats-chart-outline"
            iconColor={C.primaryLight}
            iconBg={C.primaryBg}
            iconBorder={C.primaryBorder}
            highlight
          />
          <SummaryCard
            label="Transaksione"
            value={String(thisMonthCount)}
            icon="receipt-outline"
            iconColor={C.warning}
            iconBg={C.warningBgSubtle}
            iconBorder={C.warningBorder}
          />
        </View>

        {/* Këshilla Smart — AI financial coach */}
        {adviceCards.length > 0 && (
          <KeshillaSmartSection cards={adviceCards} />
        )}

        {/* Month vs Last Month comparison */}
        {monthComp.lastMonth > 0 && (
          <Card>
            <View style={styles.compHeader}>
              <View style={styles.compTitleWrap}>
                <Ionicons name="swap-horizontal-outline" size={15} color={C.accentLight} />
                <Text style={styles.compTitle}>Ky muaj vs muaji i kaluar</Text>
              </View>
              {monthComp.direction !== 'same' && (
                <View style={[
                  styles.compBadge,
                  { backgroundColor: monthComp.direction === 'up' ? C.dangerBgSubtle : C.primaryBgSubtle },
                ]}>
                  <Ionicons
                    name={monthComp.direction === 'up' ? 'trending-up' : 'trending-down'}
                    size={11}
                    color={monthComp.direction === 'up' ? C.danger : C.primary}
                  />
                  <Text style={[
                    styles.compBadgeText,
                    { color: monthComp.direction === 'up' ? C.danger : C.primary },
                  ]}>
                    {monthComp.direction === 'up' ? '+' : ''}{monthComp.pctChange.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.compBars}>
              <View style={styles.compBarGroup}>
                <Text style={styles.compBarLabel}>Ky muaj</Text>
                <View style={styles.compBarTrack}>
                  <View
                    style={[
                      styles.compBarFill,
                      {
                        width: `${Math.min(
                          (monthComp.thisMonth / Math.max(monthComp.thisMonth, monthComp.lastMonth)) * 100,
                          100
                        )}%` as any,
                        backgroundColor: C.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.compBarAmount}>{formatCurrency(Math.round(monthComp.thisMonth), 'ALL')}</Text>
              </View>

              <View style={styles.compBarGroup}>
                <Text style={styles.compBarLabel}>Muaji i kaluar</Text>
                <View style={styles.compBarTrack}>
                  <View
                    style={[
                      styles.compBarFill,
                      {
                        width: `${Math.min(
                          (monthComp.lastMonth / Math.max(monthComp.thisMonth, monthComp.lastMonth)) * 100,
                          100
                        )}%` as any,
                        backgroundColor: C.elevated,
                        borderWidth: 1,
                        borderColor: C.borderLight,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.compBarAmount, { color: C.textSub }]}>{formatCurrency(Math.round(monthComp.lastMonth), 'ALL')}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Insights */}
        {allInsights.length > 0 && (
          <Card>
            <View style={styles.insightHeader}>
              <View style={styles.insightTitleWrap}>
                <LinearGradient
                  colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.06)']}
                  style={styles.insightSectionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="bulb-outline" size={13} color={C.warning} />
                </LinearGradient>
                <Text style={styles.insightTitle}>Sinjale</Text>
              </View>
              <View style={styles.insightCountBadge}>
                <Text style={styles.insightCountText}>{allInsights.length}</Text>
              </View>
            </View>

            <View style={styles.insightList}>
              {allInsights.map((insight, i) => (
                <View
                  key={i}
                  style={[
                    styles.insightRow,
                    { borderLeftColor: insightBorderColor(insight.type) },
                    i < allInsights.length - 1 && styles.insightRowBorder,
                  ]}
                >
                  <View style={[styles.insightIconWrap, { backgroundColor: insightIconBg(insight.type) }]}>
                    <Ionicons name={insight.icon as any} size={14} color={insightIconColor(insight.type)} />
                  </View>
                  <Text style={styles.insightText}>{insight.text}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ── Subscriptions / Abonimet ── */}
        <Card>
          {/* Header */}
          <View style={subStyles.header}>
            <View style={subStyles.titleRow}>
              <LinearGradient
                colors={['rgba(59,130,246,0.20)', 'rgba(59,130,246,0.06)']}
                style={subStyles.headerIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="repeat" size={13} color={C.accentLight} />
              </LinearGradient>
              <Text style={subStyles.title}>Abonimet</Text>
              {activeSubCount > 0 && (
                <View style={subStyles.countBadge}>
                  <Text style={subStyles.countText}>{activeSubCount} aktive</Text>
                </View>
              )}
            </View>
            {subMonthlyTotal > 0 && (
              <Text style={subStyles.monthlyTotal}>
                {formatCurrency(Math.round(subMonthlyTotal), 'ALL')}/muaj
              </Text>
            )}
          </View>

          {/* Subscription list */}
          {state.subscriptions.length > 0 ? (
            <View style={subStyles.list}>
              {state.subscriptions.map((sub, i) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  isLast={i === state.subscriptions.length - 1}
                  onToggle={() => toggleSubscription(sub.id)}
                  onRemove={() => removeSubscription(sub.id)}
                />
              ))}
            </View>
          ) : (
            <View style={subStyles.emptyState}>
              <Ionicons name="apps-outline" size={28} color={C.textFaint} />
              <Text style={subStyles.emptyTitle}>Nuk ka abonime aktive</Text>
              <Text style={subStyles.emptySub}>
                Shto shërbimet që paguan çdo muaj
              </Text>
            </View>
          )}

          {/* Preset picker */}
          {showPresets && (
            <View style={subStyles.presetGrid}>
              {SUBSCRIPTION_PRESETS.filter(
                (p) => !state.subscriptions.some((s) => s.name === p.name)
              ).map((preset) => (
                <TouchableOpacity
                  key={preset.name}
                  style={subStyles.presetItem}
                  onPress={() => handleAddPreset(preset)}
                  activeOpacity={0.75}
                >
                  <View style={[subStyles.presetIcon, { backgroundColor: preset.bgColor }]}>
                    <Ionicons name={preset.icon as any} size={15} color={preset.color} />
                  </View>
                  <Text style={subStyles.presetName} numberOfLines={1}>{preset.name}</Text>
                  <Text style={subStyles.presetAmt}>
                    {preset.defaultCurrency === 'ALL'
                      ? `${preset.defaultAmount.toLocaleString('sq-AL')} L`
                      : `€${preset.defaultAmount}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Add button */}
          <TouchableOpacity
            style={subStyles.addBtn}
            onPress={() => setShowPresets((p) => !p)}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.06)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons
              name={showPresets ? 'chevron-up' : 'add-circle-outline'}
              size={15}
              color={C.accentLight}
            />
            <Text style={subStyles.addBtnText}>
              {showPresets ? 'Mbyll listën' : 'Shto abonim'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Recurring Patterns */}
        {recurringPatterns.length > 0 && (
          <Card>
            <View style={styles.recurHeader}>
              <View style={styles.recurTitleWrap}>
                <LinearGradient
                  colors={['rgba(59,130,246,0.18)', 'rgba(59,130,246,0.06)']}
                  style={styles.recurSectionIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="repeat-outline" size={13} color={C.accentLight} />
                </LinearGradient>
                <Text style={styles.recurTitle}>Shpenzime Periodike</Text>
              </View>
              <View style={styles.rankMonthBadge}>
                <Text style={styles.rankMonthBadgeText}>{recurringPatterns.length} gjet</Text>
              </View>
            </View>

            <View style={styles.recurList}>
              {recurringPatterns.slice(0, 6).map((pattern, i) => (
                <RecurringPatternRow
                  key={pattern.key}
                  pattern={pattern}
                  isLast={i === Math.min(recurringPatterns.length, 6) - 1}
                />
              ))}
            </View>
          </Card>
        )}

        {/* Bar Chart */}
        <Card>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Shpenzimet</Text>
              {maxVal > 0 && (
                <Text style={styles.chartSubtitle}>
                  Më i lartë: {formatCurrency(maxVal, 'ALL')}
                </Text>
              )}
            </View>
            <View style={styles.periodToggle}>
              {(['java', 'muaji'] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.75}
                >
                  {period === p && (
                    <LinearGradient
                      colors={GRADIENTS.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                    {p === 'java' ? 'Javore' : 'Mujore'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.chartWrap}>
            <BarChart
              data={chartData}
              height={210}
              activeIndex={activeIdx}
              formatValue={(v) => v > 999 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`}
            />
          </View>

          {maxVal > 0 && (
            <View style={styles.chartFooter}>
              <View style={styles.chartLegendDot} />
              <Text style={styles.chartLegendText}>
                {period === 'java' && weekComp.lastWeek > 0
                  ? weekComp.direction === 'up'
                    ? `Kjo javë +${weekComp.pctChange.toFixed(0)}% krahasuar me javën e kaluar`
                    : weekComp.direction === 'down'
                    ? `Kjo javë −${Math.abs(weekComp.pctChange).toFixed(0)}% krahasuar me javën e kaluar`
                    : 'Shpenzime të ngjashme me javën e kaluar'
                  : 'Shpenzime mujore — 6 muajt e fundit'}
              </Text>
            </View>
          )}
        </Card>

        {/* Donut Chart — all-time category split */}
        {donutData.length > 0 && (
          <Card>
            <Text style={[styles.chartTitle, { marginBottom: 18 }]}>
              {isBizMode ? 'Shpenzime biznesi sipas Kategorisë' : 'Shpenzime sipas Kategorisë'}
            </Text>
            <DonutChart
              data={donutData}
              size={164}
              thickness={24}
              centerValue={formatCurrency(Math.round(totalAllTime), 'ALL')}
              centerLabel="Totali"
            />
          </Card>
        )}

        {/* Category Ranking — this month */}
        {categoryTotalsMonth.length > 0 && (
          <Card>
            <View style={styles.rankHeaderRow}>
              <Text style={styles.chartTitle}>
                {isBizMode ? 'Kategoritë e biznesit këtë muaj' : 'Kategoritë këtë muaj'}
              </Text>
              <View style={styles.rankMonthBadge}>
                <Text style={styles.rankMonthBadgeText}>{thisMonthCount} tx</Text>
              </View>
            </View>
            <View style={[styles.rankList, { marginTop: 14 }]}>
              {categoryTotalsMonth.map((item, i) => {
                const cat = allCats.find((c) => c.id === item.category);
                if (!cat) return null;
                const isTop = i === 0;
                const txCount = thisMonthExpenses.filter((e) => e.category === item.category).length;
                return (
                  <View key={item.category} style={styles.rankItem}>
                    <View style={styles.rankLeft}>
                      <View style={[styles.rankNumWrap, isTop && { backgroundColor: C.warningBgSubtle }]}>
                        <Text style={[styles.rankNum, isTop && { color: C.warning }]}>
                          {isTop ? '★' : i + 1}
                        </Text>
                      </View>
                      <View style={[styles.rankIcon, { backgroundColor: cat.bgColor, borderWidth: 1, borderColor: cat.color + '28' }]}>
                        <Ionicons name={cat.icon as any} size={15} color={cat.color} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.rankLabelRow}>
                          <Text style={styles.rankLabel}>{cat.name}</Text>
                          <Text style={styles.rankTxCount}>{txCount} tx</Text>
                        </View>
                        <View style={styles.rankBar}>
                          <View
                            style={[
                              styles.rankBarFill,
                              { width: `${item.percent}%` as any, backgroundColor: cat.color },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.rankRight}>
                      <Text style={styles.rankAmount}>{formatCurrency(Math.round(item.total), 'ALL')}</Text>
                      <Text style={[styles.rankPct, { color: cat.color }]}>{item.percent.toFixed(1)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        <View style={{ height: 100 }} />
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Këshilla Smart ────────────────────────────────────────────────────────────

const ADVICE_META: Record<
  AdviceType,
  { label: string; color: string; bgColor: string }
> = {
  saving_tip: {
    label: 'Kursim',
    color: C.primary,
    bgColor: C.primaryBgSubtle,
  },
  warning: {
    label: 'Kujdes',
    color: C.warning,
    bgColor: C.warningBgSubtle,
  },
  trend: {
    label: 'Tendencë',
    color: C.accentLight,
    bgColor: C.accentBgSubtle,
  },
  recurring_payment: {
    label: 'Periodike',
    color: C.accent,
    bgColor: C.accentBgSubtle,
  },
  budget_suggestion: {
    label: 'Buxhet',
    color: '#A78BFA',
    bgColor: 'rgba(167,139,250,0.08)',
  },
};

function KeshillaSmartSection({ cards }: { cards: AdviceCard[] }) {
  return (
    <Card>
      {/* Header */}
      <View style={coachStyles.header}>
        <View style={coachStyles.titleRow}>
          <LinearGradient
            colors={['rgba(167,139,250,0.22)', 'rgba(59,130,246,0.10)']}
            style={coachStyles.headerIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles-outline" size={13} color="#A78BFA" />
          </LinearGradient>
          <Text style={coachStyles.title}>Këshilla Smart</Text>
          <View style={coachStyles.aiBadge}>
            <Text style={coachStyles.aiBadgeText}>AI</Text>
          </View>
        </View>
        <View style={coachStyles.countBadge}>
          <Text style={coachStyles.countText}>{cards.length}</Text>
        </View>
      </View>

      {/* Advice rows */}
      <View style={coachStyles.list}>
        {cards.map((card, i) => {
          const meta = ADVICE_META[card.type];
          return (
            <View
              key={card.id}
              style={[
                coachStyles.row,
                { borderLeftColor: meta.color },
                i < cards.length - 1 && coachStyles.rowDivider,
              ]}
            >
              <View style={[coachStyles.iconWrap, { backgroundColor: meta.bgColor }]}>
                <Ionicons name={card.icon as any} size={14} color={meta.color} />
              </View>
              <View style={coachStyles.rowBody}>
                <View style={[coachStyles.typeBadge, { backgroundColor: meta.bgColor }]}>
                  <Text style={[coachStyles.typeBadgeText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
                <Text style={coachStyles.rowText}>{card.text}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={coachStyles.cta}
        activeOpacity={0.72}
        onPress={() => {}}
      >
        <Text style={coachStyles.ctaText}>Shiko analizën e plotë</Text>
        <Ionicons name="arrow-forward" size={13} color="#A78BFA" />
      </TouchableOpacity>
    </Card>
  );
}

const coachStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  aiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: '#A78BFA', letterSpacing: 0.6 },
  countBadge: {
    backgroundColor: C.elevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  countText: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    marginLeft: 2,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, gap: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  rowText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: '500',
    lineHeight: 19,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: '#A78BFA' },
});

// ── SubscriptionRow ───────────────────────────────────────────────────────────

function SubscriptionRow({
  sub,
  isLast,
  onToggle,
  onRemove,
}: {
  sub: Subscription;
  isLast: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const nextLabel = getNextLabel(sub.nextPaymentDate);
  const freqLabel =
    sub.frequency === 'weekly' ? 'Javore' : sub.frequency === 'monthly' ? 'Mujore' : 'Vjetore';

  return (
    <View style={[subStyles.row, !isLast && subStyles.rowDivider]}>
      <View style={[subStyles.rowIcon, { backgroundColor: sub.bgColor, borderColor: sub.color + '30' }]}>
        <Ionicons name={sub.icon as any} size={15} color={sub.color} />
      </View>
      <View style={subStyles.rowMid}>
        <Text style={[subStyles.rowName, !sub.isActive && subStyles.rowNameInactive]} numberOfLines={1}>
          {sub.name}
        </Text>
        <View style={subStyles.rowMeta}>
          <View style={[subStyles.freqPill, { borderColor: sub.color + '30', backgroundColor: sub.bgColor }]}>
            <Text style={[subStyles.freqPillText, { color: sub.color }]}>{freqLabel}</Text>
          </View>
          {sub.isActive && nextLabel !== '' && (
            <Text style={subStyles.nextPayText}>{nextLabel}</Text>
          )}
          {!sub.isActive && (
            <View style={subStyles.inactivePill}>
              <Text style={subStyles.inactivePillText}>Joaktiv</Text>
            </View>
          )}
        </View>
      </View>
      <View style={subStyles.rowRight}>
        <Text style={[subStyles.rowAmt, !sub.isActive && { color: C.textFaint }]}>
          {formatCurrency(sub.amount, sub.currency)}
        </Text>
        <Switch
          value={sub.isActive}
          onValueChange={onToggle}
          trackColor={{ false: C.elevated, true: 'rgba(59,130,246,0.35)' }}
          thumbColor={sub.isActive ? C.accentLight : C.textMuted}
          ios_backgroundColor={C.elevated}
        />
      </View>
    </View>
  );
}

const subStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  countText: { fontSize: 10, fontWeight: '700', color: C.accentLight, letterSpacing: 0.2 },
  monthlyTotal: { fontSize: 13, fontWeight: '800', color: C.accent, letterSpacing: -0.2 },

  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  rowMid: { flex: 1, gap: 4, minWidth: 0 },
  rowName: { fontSize: 13, fontWeight: '700', color: C.text },
  rowNameInactive: { color: C.textMuted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freqPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  freqPillText: { fontSize: 10, fontWeight: '600' },
  nextPayText: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  inactivePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.elevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  inactivePillText: { fontSize: 10, color: C.textFaint, fontWeight: '600' },
  rowRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  rowAmt: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: C.textSub },
  emptySub: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },

  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.elevated,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.border,
  },
  presetIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetName: { fontSize: 12, fontWeight: '700', color: C.textSub, maxWidth: 90 },
  presetAmt: { fontSize: 11, color: C.textMuted, fontWeight: '500' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.accentBorder,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: C.accentLight },
});

// ── RecurringPatternRow ───────────────────────────────────────────────────────

function RecurringPatternRow({
  pattern,
  isLast,
}: {
  pattern: RecurringPattern;
  isLast: boolean;
}) {
  const cat = [...CATEGORIES, ...BUSINESS_CATEGORIES].find((c) => c.id === pattern.category);
  const nextLabel = getNextLabel(pattern.nextExpected);
  const confColor =
    pattern.confidence === 'high'
      ? C.primary
      : pattern.confidence === 'medium'
      ? C.warning
      : C.textMuted;

  return (
    <View style={[recurStyles.row, !isLast && recurStyles.rowBorder]}>
      {/* Left: icon */}
      <View
        style={[
          recurStyles.icon,
          { backgroundColor: cat?.bgColor ?? C.elevated, borderColor: (cat?.color ?? C.border) + '28' },
        ]}
      >
        <Ionicons name={(cat?.icon ?? 'ellipse-outline') as any} size={14} color={cat?.color ?? C.textMuted} />
      </View>

      {/* Middle: info */}
      <View style={recurStyles.middle}>
        <View style={recurStyles.nameRow}>
          <Text style={recurStyles.name} numberOfLines={1}>{pattern.name}</Text>
          {pattern.isSubscription && (
            <View style={recurStyles.subBadge}>
              <Text style={recurStyles.subBadgeText}>ABONIM</Text>
            </View>
          )}
        </View>
        <View style={recurStyles.metaRow}>
          <View style={recurStyles.freqBadge}>
            <Text style={recurStyles.freqText}>{getFrequencyLabel(pattern.frequency)}</Text>
          </View>
          <Text style={recurStyles.occText}>{pattern.occurrences}×</Text>
          {nextLabel !== '' && (
            <Text style={recurStyles.nextText}>{nextLabel}</Text>
          )}
          {/* Confidence dot */}
          <View style={[recurStyles.confDot, { backgroundColor: confColor }]} />
        </View>
      </View>

      {/* Right: amount */}
      <View style={recurStyles.right}>
        <Text style={recurStyles.amount}>
          ≈ {formatCurrency(pattern.avgAmount, pattern.currency)}
        </Text>
        <Text style={recurStyles.amountLabel}>/ {pattern.frequency === 'daily' ? 'ditë' : pattern.frequency === 'weekly' ? 'javë' : 'muaj'}</Text>
      </View>
    </View>
  );
}

const recurStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  middle: { flex: 1, gap: 5, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  subBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.accentBorder,
    flexShrink: 0,
  },
  subBadgeText: { fontSize: 8, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freqBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.elevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  freqText: { fontSize: 10, fontWeight: '600', color: C.textMuted },
  occText: { fontSize: 10, color: C.textMuted, fontWeight: '600' },
  nextText: { fontSize: 10, color: C.textFaint, fontWeight: '500' },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  right: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  amount: { fontSize: 12, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  amountLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
});

function SummaryCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  iconBorder,
  highlight,
}: {
  label: string;
  value: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  highlight?: boolean;
}) {
  return (
    <View style={[summaryStyles.card, highlight && summaryStyles.highlight]}>
      <View style={summaryStyles.topEdge} />
      {highlight && (
        <LinearGradient
          colors={['rgba(16,185,129,0.10)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={[summaryStyles.iconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={summaryStyles.value}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    borderColor: C.primaryBorder,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 2,
  },
  value: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  label: { fontSize: 10, color: C.textMuted, fontWeight: '500', lineHeight: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.primaryBgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.7 },
  pageBizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.accentBorder,
    marginTop: 3,
  },
  pageBizBadgeText: { fontSize: 10, fontWeight: '800', color: C.accentLight, letterSpacing: 0.6 },
  summaryRow: { flexDirection: 'row', gap: 10 },

  // Month comparison
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  compTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  compBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compBadgeText: { fontSize: 11, fontWeight: '800' },
  compBars: { gap: 12 },
  compBarGroup: { gap: 6 },
  compBarLabel: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  compBarTrack: {
    height: 10,
    backgroundColor: C.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  compBarFill: { height: '100%', borderRadius: 5 },
  compBarAmount: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.2 },

  // Insights
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  insightTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightSectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightTitle: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  insightCountBadge: {
    backgroundColor: C.elevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  insightCountText: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  insightList: { gap: 0 },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    marginLeft: 2,
  },
  insightRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  insightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: C.textSub,
    fontWeight: '500',
    lineHeight: 19,
    paddingTop: 1,
  },

  // Chart
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  chartSubtitle: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: C.elevated,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  periodBtn: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  periodBtnActive: {},
  periodText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  periodTextActive: { color: C.white, fontWeight: '700' },
  chartWrap: { marginHorizontal: -4 },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  chartLegendText: { fontSize: 11, color: C.textMuted, flex: 1 },

  // Category ranking
  rankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankMonthBadge: {
    backgroundColor: C.elevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  rankMonthBadgeText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  rankList: { gap: 12 },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  rankNumWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.elevated,
  },
  rankNum: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  rankIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rankLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  rankTxCount: { fontSize: 10, fontWeight: '600', color: C.textMuted },
  rankBar: {
    height: 4,
    backgroundColor: C.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rankBarFill: { height: '100%', borderRadius: 2 },
  rankRight: { alignItems: 'flex-end', gap: 2 },
  rankAmount: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  rankPct: { fontSize: 11, fontWeight: '700' },

  // Recurring patterns header
  recurHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recurTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recurSectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurTitle: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  recurList: { gap: 0 },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 52,
    gap: 12,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primaryBorder,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textSub },
  emptySub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  emptyTeasers: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 4 },
  emptyTeaser: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: C.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTeaserText: { fontSize: 10, color: C.textMuted, fontWeight: '600', textAlign: 'center' as any },
  emptyBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
});
