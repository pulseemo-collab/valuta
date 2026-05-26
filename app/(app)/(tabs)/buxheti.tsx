import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SyncingBanner } from '@/components/ui/SyncingBanner';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { CATEGORIES } from '@/constants/categories';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';
import { formatCurrency, getMonthTotal, getTotalALL } from '@/lib/utils';
import { getBudgetAdvisory, type RiskLevel } from '@/lib/budgetAdvisor';
import { C, GRADIENTS } from '@/constants/colors';

function riskColor(level: RiskLevel): string {
  if (level === 'danger') return C.danger;
  if (level === 'caution') return C.warning;
  return C.primary;
}

function riskBg(level: RiskLevel): string {
  if (level === 'danger') return C.dangerBgSubtle;
  if (level === 'caution') return C.warningBgSubtle;
  return C.primaryBgSubtle;
}

function riskBorder(level: RiskLevel): string {
  if (level === 'danger') return C.dangerBorder;
  if (level === 'caution') return C.warningBorder;
  return C.primaryBorder;
}

function riskLabel(level: RiskLevel): string {
  if (level === 'danger') return 'Rrezik';
  if (level === 'caution') return 'Kujdes';
  return 'I sigurtë';
}

export default function Buxheti() {
  const { state, setBudget } = useStore();
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [newBudget, setNewBudget] = useState(state.budget.monthly.toString());
  const [saving, setSaving] = useState(false);

  const isBizMode = state.mode === 'business';
  const hasBudget = state.budget.monthly > 0;

  const bizExpenses = useMemo(
    () => state.expenses.filter((e) => e.mode === 'business'),
    [state.expenses]
  );

  const monthExpenses = useMemo(() => {
    const now = new Date();
    const source = isBizMode ? bizExpenses : state.expenses;
    return source.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [state.expenses, bizExpenses, isBizMode]);

  const advisory = useMemo(
    () => getBudgetAdvisory(isBizMode ? bizExpenses : state.expenses, state.budget),
    [state.expenses, bizExpenses, state.budget, isBizMode]
  );

  const totalSpent = isBizMode ? getMonthTotal(bizExpenses) : getMonthTotal(state.expenses);
  const remaining = state.budget.monthly - totalSpent;
  const pct = hasBudget ? Math.min((totalSpent / state.budget.monthly) * 100, 100) : 0;
  const overWarning = pct >= 80;
  const overBudget = totalSpent > state.budget.monthly;

  const categoryBreakdown = useMemo(() => {
    if (isBizMode) {
      return BUSINESS_CATEGORIES.map((cat) => {
        const catExpenses = monthExpenses.filter((e) => e.category === cat.id);
        const total = getTotalALL(catExpenses);
        return { cat, total, count: catExpenses.length, risk: null };
      }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
    }
    return CATEGORIES.map((cat) => {
      const catExpenses = monthExpenses.filter((e) => e.category === cat.id);
      const total = getTotalALL(catExpenses);
      const risk = advisory.categoryRisks.find((r) => r.category === cat.id) ?? null;
      return { cat, total, count: catExpenses.length, risk };
    }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  }, [monthExpenses, advisory.categoryRisks, isBizMode]);

  const handleSave = () => {
    const val = parseFloat(newBudget.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Gabim', 'Vendos një buxhet të vlefshëm.');
      return;
    }
    setSaving(true);
    setBudget({ monthly: val, currency: 'ALL' });
    setTimeout(() => {
      setSaving(false);
      setEditMode(false);
    }, 500);
  };

  const progressColors = overBudget
    ? [C.danger, '#DC2626']
    : overWarning
    ? [C.warning, '#D97706']
    : GRADIENTS.primaryShine;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>{isBizMode ? 'Buxheti Biznesi' : 'Buxheti'}</Text>

        <SyncingBanner />

        {/* Skeleton while syncing with no local data */}
        {state.syncing && state.expenses.length === 0 && (
          <View style={{ gap: 14 }}>
            <CardSkeleton height={220} />
            <CardSkeleton height={160} />
          </View>
        )}

        {/* Set Budget Welcome — shown when no budget is configured yet */}
        {!state.syncing && !hasBudget && (
          <View style={styles.setBudgetCard}>
            <LinearGradient
              colors={['rgba(16,185,129,0.10)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.setBudgetIconRing}>
              <LinearGradient
                colors={GRADIENTS.primaryShine as string[]}
                style={styles.setBudgetIconGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="wallet-outline" size={28} color={C.white} />
              </LinearGradient>
            </View>
            <View style={styles.setBudgetText}>
              <Text style={styles.setBudgetTitle}>Vendos buxhetin tënd mujor</Text>
              <Text style={styles.setBudgetSub}>
                Cakto një limit shpenzimesh dhe Valuta{'\n'}do të gjurmojë çdo lekë automatikisht.
              </Text>
            </View>
            <View style={styles.setBudgetFeatures}>
              {([
                { icon: 'trending-up-outline', text: 'Gjurmo progresin çdo ditë' },
                { icon: 'alert-circle-outline', text: 'Sinjalizim kur afrohet limiti' },
                { icon: 'analytics-outline', text: 'Analiza financiare mujore' },
              ] as const).map((f) => (
                <View key={f.icon} style={styles.setBudgetFeatureRow}>
                  <View style={styles.setBudgetFeatureIcon}>
                    <Ionicons name={f.icon as any} size={14} color={C.primary} />
                  </View>
                  <Text style={styles.setBudgetFeatureText}>{f.text}</Text>
                </View>
              ))}
            </View>
            {advisory.suggestion && (
              <View style={styles.setBudgetSuggChip}>
                <Ionicons name="sparkles-outline" size={12} color={C.accentLight} />
                <Text style={styles.setBudgetSuggText}>
                  Rekomandohet: {formatCurrency(advisory.suggestion.amount, 'ALL')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setNewBudget(String(advisory.suggestion!.amount));
                    setEditMode(true);
                  }}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Text style={styles.setBudgetSuggApply}>Vendos →</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.setBudgetBtn}
              onPress={() => setEditMode(true)}
              activeOpacity={0.84}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine as string[]}
                style={styles.setBudgetBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="wallet-outline" size={16} color={C.white} />
                <Text style={styles.setBudgetBtnText}>Cakto buxhetin tani</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Budget Card — only shown when a budget has been set */}
        {(!state.syncing || state.expenses.length > 0) && hasBudget && <LinearGradient
          colors={
            overBudget
              ? ['rgba(239,68,68,0.14)', '#0a0a14']
              : overWarning
              ? ['rgba(245,158,11,0.12)', '#060B18']
              : ['#0c2918', '#081524', '#060B18']
          }
          style={styles.mainCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Top highlight */}
          <View style={styles.mainCardShimmer} />
          <View style={[
            styles.mainCardGlow,
            { backgroundColor: overBudget ? C.dangerGlow : overWarning ? C.warningGlow : 'rgba(16,185,129,0.12)' }
          ]} />

          <View style={styles.mainCardContent}>
            {/* Budget amount row */}
            <View style={styles.budgetRow}>
              <View style={{ gap: 4 }}>
                <Text style={styles.budgetLabel}>{isBizMode ? 'Buxheti i Biznesit' : 'Buxheti Mujor'}</Text>
                <Text style={styles.budgetAmount}>{formatCurrency(state.budget.monthly, 'ALL')}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editBtn} activeOpacity={0.78}>
                <Ionicons name="pencil" size={12} color={C.textSub} />
                <Text style={styles.editBtnText}>Ndrysho</Text>
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={progressColors as string[]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${pct}%` as any }]}
                />
              </View>
              <Text style={[styles.progressPct, {
                color: overBudget ? C.danger : overWarning ? C.warning : C.text
              }]}>
                {pct.toFixed(0)}%
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatCurrency(totalSpent, 'ALL')}</Text>
                <Text style={styles.statLabel}>Shpenzuar</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: overBudget ? C.danger : C.primary }]}>
                  {overBudget ? '−' : ''}{formatCurrency(Math.abs(remaining), 'ALL')}
                </Text>
                <Text style={styles.statLabel}>{overBudget ? 'Tejkalim' : 'Mbetur'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{monthExpenses.length}</Text>
                <Text style={styles.statLabel}>Transaksione</Text>
              </View>
            </View>

            {overWarning && (
              <View style={[styles.alertBanner, {
                backgroundColor: overBudget ? C.dangerBgSubtle : C.warningBgSubtle,
                borderColor: overBudget ? C.dangerBorder : C.warningBorder,
              }]}>
                <Ionicons name="warning" size={14} color={overBudget ? C.danger : C.warning} />
                <Text style={[styles.alertText, { color: overBudget ? C.danger : C.warning }]}>
                  {overBudget
                    ? `Ke tejkaluar buxhetin me ${formatCurrency(Math.abs(remaining), 'ALL')}`
                    : `Ke shpenzuar ${pct.toFixed(0)}% të buxhetit muajor`}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>}

        {/* ── Critical warnings ── */}
        {hasBudget && advisory.warnings.filter(w => w.severity === 'critical').length > 0 && (
          <View style={styles.warnStack}>
            {advisory.warnings
              .filter((w) => w.severity === 'critical')
              .slice(0, 2)
              .map((w, i) => (
                <View
                  key={i}
                  style={[styles.warnRow, { backgroundColor: C.dangerBgSubtle, borderColor: C.dangerBorder }]}
                >
                  <Ionicons name={w.icon as any} size={15} color={C.danger} />
                  <Text style={[styles.warnText, { color: C.danger }]}>{w.text}</Text>
                </View>
              ))}
          </View>
        )}

        {/* ── Forecast card ── */}
        {hasBudget && advisory.forecast && (
          <Card>
            <View style={styles.fcHeader}>
              <View style={styles.fcTitleWrap}>
                <View style={[styles.fcIcon, { backgroundColor: riskBg(advisory.forecast.riskLevel) }]}>
                  <Ionicons name="stats-chart-outline" size={14} color={riskColor(advisory.forecast.riskLevel)} />
                </View>
                <Text style={styles.fcTitle}>Parashikim Mujor</Text>
              </View>
              <View style={[styles.fcRiskBadge, { backgroundColor: riskBg(advisory.forecast.riskLevel), borderColor: riskBorder(advisory.forecast.riskLevel) }]}>
                <View style={[styles.fcRiskDot, { backgroundColor: riskColor(advisory.forecast.riskLevel) }]} />
                <Text style={[styles.fcRiskText, { color: riskColor(advisory.forecast.riskLevel) }]}>
                  {riskLabel(advisory.forecast.riskLevel)}
                </Text>
              </View>
            </View>

            {/* Projected vs budget bar */}
            <View style={styles.fcBarWrap}>
              <View style={styles.fcBarTrack}>
                <LinearGradient
                  colors={
                    advisory.forecast.riskLevel === 'danger'
                      ? [C.danger, '#DC2626']
                      : advisory.forecast.riskLevel === 'caution'
                      ? [C.warning, '#D97706']
                      : GRADIENTS.primary
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.fcBarFill,
                    {
                      width: `${Math.min(
                        (advisory.forecast.projectedMonthly / state.budget.monthly) * 100,
                        100
                      )}%` as any,
                    },
                  ]}
                />
                {/* Budget limit marker */}
                <View style={styles.fcBudgetMarker} />
              </View>
              <Text style={[styles.fcBarPct, { color: riskColor(advisory.forecast.riskLevel) }]}>
                {((advisory.forecast.projectedMonthly / state.budget.monthly) * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.fcBarLabels}>
              <Text style={styles.fcBarLabelLeft}>0</Text>
              <Text style={[styles.fcBarLabelRight, { color: riskColor(advisory.forecast.riskLevel) }]}>
                Parashikim: {formatCurrency(Math.round(advisory.forecast.projectedMonthly), 'ALL')}
              </Text>
            </View>

            {/* Metrics row */}
            <View style={styles.fcMetrics}>
              <View style={styles.fcMetric}>
                <Text style={styles.fcMetricValue}>
                  {formatCurrency(Math.round(advisory.forecast.burnRate), 'ALL')}
                </Text>
                <Text style={styles.fcMetricLabel}>Ritmi/ditë</Text>
              </View>
              <View style={styles.fcMetricDivider} />
              <View style={styles.fcMetric}>
                <Text
                  style={[
                    styles.fcMetricValue,
                    { color: advisory.forecast.safeDaily > 0 ? C.primaryLight : C.danger },
                  ]}
                >
                  {advisory.forecast.safeDaily > 0
                    ? formatCurrency(Math.round(advisory.forecast.safeDaily), 'ALL')
                    : '—'}
                </Text>
                <Text style={styles.fcMetricLabel}>Limit i sigurtë/ditë</Text>
              </View>
              <View style={styles.fcMetricDivider} />
              <View style={styles.fcMetric}>
                <Text style={styles.fcMetricValue}>{advisory.forecast.daysRemaining}</Text>
                <Text style={styles.fcMetricLabel}>Ditë mbeten</Text>
              </View>
            </View>

            {/* Overrun / buffer note */}
            {advisory.forecast.projectedOverrun !== 0 && (
              <View
                style={[
                  styles.fcNote,
                  {
                    backgroundColor:
                      advisory.forecast.projectedOverrun > 0 ? C.dangerBgSubtle : C.primaryBgSubtle,
                    borderColor:
                      advisory.forecast.projectedOverrun > 0 ? C.dangerBorder : C.primaryBorder,
                  },
                ]}
              >
                <Ionicons
                  name={advisory.forecast.projectedOverrun > 0 ? 'trending-up-outline' : 'trending-down-outline'}
                  size={13}
                  color={advisory.forecast.projectedOverrun > 0 ? C.danger : C.primary}
                />
                <Text
                  style={[
                    styles.fcNoteText,
                    { color: advisory.forecast.projectedOverrun > 0 ? C.danger : C.primary },
                  ]}
                >
                  {advisory.forecast.projectedOverrun > 0
                    ? `Tejkalim i parashikuar: +${formatCurrency(Math.round(advisory.forecast.projectedOverrun), 'ALL')}`
                    : `Kursim i parashikuar: ${formatCurrency(Math.round(-advisory.forecast.projectedOverrun), 'ALL')}`}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ── Budget suggestion ── */}
        {advisory.suggestion !== null && (
          <View style={styles.suggCard}>
            <LinearGradient
              colors={['rgba(59,130,246,0.08)', 'rgba(59,130,246,0.02)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.suggHeader}>
              <View style={styles.suggBadge}>
                <Ionicons name="sparkles-outline" size={11} color={C.accentLight} />
                <Text style={styles.suggBadgeText}>REKOMANDIM</Text>
              </View>
              <View style={styles.suggConfWrap}>
                <View
                  style={[
                    styles.suggConfDot,
                    {
                      backgroundColor:
                        advisory.suggestion.confidence === 'high'
                          ? C.primary
                          : advisory.suggestion.confidence === 'medium'
                          ? C.warning
                          : C.textMuted,
                    },
                  ]}
                />
                <Text style={styles.suggConfText}>
                  {advisory.suggestion.confidence === 'high'
                    ? 'Saktësi e lartë'
                    : advisory.suggestion.confidence === 'medium'
                    ? 'Saktësi mesatare'
                    : 'Saktësi e ulët'}
                </Text>
              </View>
            </View>
            <View style={styles.suggBody}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.suggLabel}>Buxhet i sugjeruar</Text>
                <Text style={styles.suggAmount}>
                  {formatCurrency(advisory.suggestion.amount, 'ALL')}
                </Text>
                <Text style={styles.suggBasis}>{advisory.suggestion.basis}</Text>
              </View>
              <TouchableOpacity
                style={styles.suggApplyBtn}
                onPress={() => {
                  setNewBudget(String(advisory.suggestion!.amount));
                  setEditMode(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.suggApplyText}>Apliko</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Category warnings (non-critical) ── */}
        {hasBudget && advisory.warnings.filter(w => w.severity === 'warning' || (w.severity === 'info' && w.category)).length > 0 && (
          <View style={styles.warnStack}>
            {advisory.warnings
              .filter((w) => (w.severity === 'warning' || w.severity === 'info') && w.category)
              .slice(0, 3)
              .map((w, i) => (
                <View
                  key={i}
                  style={[
                    styles.warnRow,
                    {
                      backgroundColor: w.severity === 'warning' ? C.warningBg : C.elevated,
                      borderColor: w.severity === 'warning' ? C.warningBorder : C.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={w.icon as any}
                    size={14}
                    color={w.severity === 'warning' ? C.warning : C.textMuted}
                  />
                  <Text
                    style={[
                      styles.warnText,
                      { color: w.severity === 'warning' ? C.warning : C.textSub },
                    ]}
                  >
                    {w.text}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {/* No expenses this month — shown only when budget is set */}
        {!state.syncing && hasBudget && monthExpenses.length === 0 && (
          <View style={[styles.emptyMonth, isBizMode && { borderColor: C.accentBorder }]}>
            <LinearGradient
              colors={isBizMode ? ['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.04)'] : ['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']}
              style={[styles.emptyMonthIconWrap, isBizMode && { borderColor: C.accentBorder }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={isBizMode ? 'briefcase-outline' : 'calendar-outline'} size={24} color={isBizMode ? C.accentLight : C.primary} />
            </LinearGradient>
            <Text style={styles.emptyMonthTitle}>
              {isBizMode ? 'Asnjë shpenzim biznesi këtë muaj' : 'Asnjë shpenzim këtë muaj'}
            </Text>
            <Text style={styles.emptyMonthSub}>
              {isBizMode
                ? 'Shto shpenzimin e parë të biznesit\npër të gjurmuar buxhetin.'
                : 'Fillo duke regjistruar shpenzimin\ne parë të muajit.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyMonthBtn}
              onPress={() => router.push('/shto' as any)}
              activeOpacity={0.78}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine}
                style={styles.emptyMonthBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={15} color={C.white} />
                <Text style={styles.emptyMonthBtnText}>Shto shpenzim</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, isBizMode && { backgroundColor: C.accentLight }]} />
              <Text style={styles.sectionTitle}>
                {isBizMode ? 'Kategoritë e Biznesit' : 'Shpenzime sipas Kategorisë'}
              </Text>
            </View>
            <Card>
              {categoryBreakdown.map((item, i) => {
                const catPct = state.budget.monthly > 0 ? (item.total / state.budget.monthly) * 100 : 0;
                const risk = item.risk;
                const trendIcon =
                  risk?.trend === 'rising'
                    ? 'trending-up-outline'
                    : risk?.trend === 'falling'
                    ? 'trending-down-outline'
                    : null;
                const trendColor =
                  risk?.riskLevel === 'high'
                    ? C.danger
                    : risk?.riskLevel === 'medium'
                    ? C.warning
                    : risk?.trend === 'falling'
                    ? C.primary
                    : C.textFaint;

                return (
                  <React.Fragment key={item.cat.id}>
                    <View style={styles.catRow}>
                      <View style={[styles.catIcon, {
                        backgroundColor: item.cat.bgColor,
                        borderWidth: 1,
                        borderColor: item.cat.color + '28',
                      }]}>
                        <Ionicons name={item.cat.icon as any} size={17} color={item.cat.color} />
                      </View>
                      <View style={styles.catDetails}>
                        <View style={styles.catHeader}>
                          <View style={styles.catNameRow}>
                            <Text style={styles.catName}>{item.cat.name}</Text>
                            {trendIcon && (
                              <Ionicons name={trendIcon as any} size={13} color={trendColor} />
                            )}
                          </View>
                          <Text style={styles.catAmount}>{formatCurrency(item.total, 'ALL')}</Text>
                        </View>
                        <View style={styles.catProgressTrack}>
                          <View
                            style={[
                              styles.catProgressFill,
                              {
                                width: `${Math.min(catPct, 100)}%` as any,
                                backgroundColor:
                                  risk?.riskLevel === 'high'
                                    ? C.danger
                                    : risk?.riskLevel === 'medium'
                                    ? C.warning
                                    : item.cat.color,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.catMeta}>
                          <Text style={styles.catPct}>
                            {catPct.toFixed(1)}% e buxhetit · {item.count} tx
                          </Text>
                          {risk && risk.avgMonthlyTotal > 0 && (
                            <Text style={[styles.catProjected, { color: trendColor }]}>
                              Parashikim: {formatCurrency(Math.round(risk.projectedMonthly), 'ALL')}/muaj
                            </Text>
                          )}
                        </View>
                        {risk?.riskLevel === 'high' && (
                          <View style={styles.catRiskRow}>
                            <Ionicons name="alert-circle-outline" size={11} color={C.danger} />
                            <Text style={styles.catRiskText}>
                              +{Math.round(risk.pctChange)}% mbi normën historike
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {i < categoryBreakdown.length - 1 && <View style={styles.separator} />}
                  </React.Fragment>
                );
              })}
            </Card>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editMode} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setEditMode(false)} activeOpacity={1}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            {/* Modal top edge */}
            <View style={styles.modalTopEdge} />
            <View style={styles.modalIconWrap}>
              <Ionicons name="wallet-outline" size={22} color={C.primary} />
            </View>
            <Text style={styles.modalTitle}>Ndrysho Buxhetin</Text>
            <Text style={styles.modalSub}>Vendos buxhetin tënd mujor në Lekë</Text>
            <View style={styles.modalInput}>
              <TextInput
                value={newBudget}
                onChangeText={setNewBudget}
                keyboardType="numeric"
                style={styles.modalTextInput}
                placeholderTextColor={C.textMuted}
                placeholder="p.sh. 50000"
                autoFocus
              />
              <Text style={styles.modalCurrency}>L</Text>
            </View>
            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={() => setEditMode(false)}
                style={{ flex: 1 }}
                disabled={saving}
              >
                Anulo
              </Button>
              <Button onPress={handleSave} style={{ flex: 1 }} disabled={saving} loading={saving}>
                {saving ? 'Duke ruajtur...' : 'Ruaj'}
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.7 },

  mainCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  mainCardShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  mainCardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  mainCardContent: { padding: 20, gap: 16 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  budgetLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  budgetAmount: { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -1.0 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  editBtnText: { fontSize: 12, color: C.textSub, fontWeight: '600' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 6 },
  progressPct: { fontSize: 15, fontWeight: '800', minWidth: 44, textAlign: 'right', letterSpacing: -0.3 },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statBox: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  statLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  alertText: { fontSize: 13, fontWeight: '600', flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.primary,
    opacity: 0.7,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  catDetails: { flex: 1, gap: 5 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  catName: { fontSize: 14, fontWeight: '600', color: C.text },
  catAmount: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  catProgressTrack: { height: 6, backgroundColor: C.elevated, borderRadius: 3, overflow: 'hidden' },
  catProgressFill: { height: '100%', borderRadius: 3 },
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPct: { fontSize: 11, color: C.textMuted },
  catProjected: { fontSize: 10, fontWeight: '600' },
  catRiskRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  catRiskText: { fontSize: 10, fontWeight: '600', color: C.danger },
  separator: { height: 1, backgroundColor: C.border, marginHorizontal: -16, opacity: 0.6 },

  // ── Warnings stack ───────────────────────────────────────────
  warnStack: { gap: 8 },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  warnText: { fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },

  // ── Forecast card ─────────────────────────────────────────────
  fcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  fcTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fcIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fcTitle: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  fcRiskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  fcRiskDot: { width: 6, height: 6, borderRadius: 3 },
  fcRiskText: { fontSize: 10, fontWeight: '700' },
  fcBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  fcBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: C.elevated,
    borderRadius: 5,
    overflow: 'visible',
    position: 'relative',
  },
  fcBarFill: { height: '100%', borderRadius: 5 },
  fcBudgetMarker: {
    position: 'absolute',
    right: 0,
    top: -3,
    bottom: -3,
    width: 2,
    borderRadius: 1,
    backgroundColor: C.borderGlassStrong,
  },
  fcBarPct: { fontSize: 13, fontWeight: '800', minWidth: 40, textAlign: 'right', letterSpacing: -0.3 },
  fcBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fcBarLabelLeft: { fontSize: 10, color: C.textFaint, fontWeight: '500' },
  fcBarLabelRight: { fontSize: 10, fontWeight: '700' },
  fcMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.elevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  fcMetric: { flex: 1, alignItems: 'center', gap: 4 },
  fcMetricDivider: { width: 1, height: 32, backgroundColor: C.border },
  fcMetricValue: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  fcMetricLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500', textAlign: 'center' as any },
  fcNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  fcNoteText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // ── Suggestion card ───────────────────────────────────────────
  suggCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    gap: 10,
    position: 'relative',
  },
  suggHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  suggBadgeText: { fontSize: 9, fontWeight: '800', color: C.accentLight, letterSpacing: 1.0 },
  suggConfWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  suggConfDot: { width: 6, height: 6, borderRadius: 3 },
  suggConfText: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  suggBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggLabel: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  suggAmount: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  suggBasis: { fontSize: 10, color: C.textFaint, lineHeight: 15, marginTop: 1 },
  suggApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.accentBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accentBorder,
    flexShrink: 0,
  },
  suggApplyText: { fontSize: 12, fontWeight: '700', color: C.accentLight },

  // ── Suggestion chip inside set-budget card ────────────────────
  setBudgetSuggChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accentBorder,
    width: '100%',
  },
  setBudgetSuggText: { flex: 1, fontSize: 12, color: C.accentLight, fontWeight: '600' },
  setBudgetSuggApply: { fontSize: 12, color: C.accentLight, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlayStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: C.elevated,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.borderGlassLight,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.65,
    shadowRadius: 48,
    elevation: 32,
    position: 'relative',
  },
  modalTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  modalSub: { fontSize: 13, color: C.textMuted },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    paddingHorizontal: 16,
    height: 64,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalTextInput: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  modalCurrency: { fontSize: 18, fontWeight: '800', color: C.primary, flexShrink: 0 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },

  // Set budget welcome card
  setBudgetCard: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    gap: 18,
    position: 'relative',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 8,
  },
  setBudgetIconRing: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.primaryBorder,
    marginBottom: 2,
  },
  setBudgetIconGrad: {
    width: 68,
    height: 68,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setBudgetText: { alignItems: 'center', gap: 6 },
  setBudgetTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4, textAlign: 'center' as any },
  setBudgetSub: { fontSize: 13, color: C.textMuted, textAlign: 'center' as any, lineHeight: 20 },
  setBudgetFeatures: { gap: 9, width: '100%' },
  setBudgetFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: C.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  setBudgetFeatureIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.primaryBgSubtle,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  setBudgetFeatureText: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  setBudgetBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    width: '100%',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 7,
  },
  setBudgetBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  setBudgetBtnText: { fontSize: 15, fontWeight: '800', color: C.white, letterSpacing: 0.1 },

  // Empty month (budget set, no expenses this month)
  emptyMonth: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  emptyMonthIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primaryBorder,
    marginBottom: 2,
  },
  emptyMonthTitle: { fontSize: 15, fontWeight: '700', color: C.textSub },
  emptyMonthSub: { fontSize: 13, color: C.textMuted, textAlign: 'center' as any, lineHeight: 19 },
  emptyMonthBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyMonthBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  emptyMonthBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
});
