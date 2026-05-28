import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GOAL_PRESETS, getGoalPresetTitle, type GoalPreset } from '@/constants/goals';
import {
  formatInPreferred,
  generateId,
  computeGoalProgress,
  estimateGoalMonths,
  getMonthlyData,
} from '@/lib/utils';
import { convertToALL } from '@/constants/currencies';
import { GRADIENTS } from '@/constants/colors';
import { useThemeColors, type ColorPalette } from '@/lib/ThemeContext';
import { useTranslation } from '@/lib/i18n';
import type { FinancialGoal, Currency } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────────

function monthsLabel(n: number, lang: string): string {
  if (lang === 'en') {
    if (n === 1) return '~1 month';
    if (n < 12) return `~${n} months`;
    const yrs = Math.floor(n / 12);
    const mo = n % 12;
    return mo > 0 ? `~${yrs} yr ${mo} mo` : `~${yrs} yr`;
  }
  if (n === 1) return '~1 muaj';
  if (n < 12) return `~${n} muaj`;
  const yrs = Math.floor(n / 12);
  const mo = n % 12;
  return mo > 0 ? `~${yrs} vit e ${mo} muaj` : `~${yrs} vit`;
}

function deadlineLabel(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntilDeadline(deadline: string): number {
  const d = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// ── sub-components ─────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  monthlySavings,
  onAddSavings,
  onDelete,
  preferred,
}: {
  goal: FinancialGoal;
  monthlySavings: number;
  onAddSavings: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
  preferred: Currency;
}) {
  const C = useThemeColors();
  const { t, lang } = useTranslation();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { pct, remainingALL, isComplete } = computeGoalProgress(goal);
  const monthsToGo = estimateGoalMonths(goal, monthlySavings);
  const hasDeadline = !!goal.deadline;
  const deadlineDays = hasDeadline ? daysUntilDeadline(goal.deadline!) : null;
  const deadlineOverdue = deadlineDays !== null && deadlineDays < 0;
  const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 30;

  const progressColor = isComplete
    ? C.primary
    : goal.color;

  const handleDelete = () => {
    Alert.alert(
      t('goalsDeleteConfirmTitle'),
      lang === 'en' ? `Are you sure you want to delete "${goal.title}"?` : `A je i sigurt që dëshiron të fshish "${goal.title}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => onDelete(goal.id) },
      ]
    );
  };

  return (
    <View style={[styles.goalCard, isComplete && styles.goalCardComplete]}>
      {/* Left color strip */}
      <View style={[styles.goalStrip, { backgroundColor: goal.color }]} />

      {isComplete && (
        <LinearGradient
          colors={['rgba(16,185,129,0.08)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <View style={styles.goalCardInner}>
        {/* Header row */}
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconWrap, { backgroundColor: goal.bgColor }]}>
            {isComplete ? (
              <Ionicons name="trophy" size={20} color={C.primary} />
            ) : (
              <Ionicons name={goal.icon as any} size={20} color={goal.color} />
            )}
          </View>
          <View style={styles.goalTitleBlock}>
            <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
            {isComplete && (
              <View style={styles.completeBadge}>
                <Ionicons name="checkmark-circle" size={11} color={C.primary} />
                <Text style={styles.completeBadgeText}>{t('goalsAchievedBadge')}</Text>
              </View>
            )}
          </View>
          <View style={styles.goalActions}>
            <TouchableOpacity
              style={[styles.goalActionBtn, { borderColor: goal.color + '40' }]}
              onPress={() => onAddSavings(goal)}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={14} color={goal.color} />
              <Text style={[styles.goalActionText, { color: goal.color }]}>{t('add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalDeleteBtn}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={14} color={C.textFaint} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${pct}%` as any,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressPct, { color: progressColor }]}>
            {pct.toFixed(0)}%
          </Text>
        </View>

        {/* Amounts */}
        <View style={styles.amountsRow}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{t('goalsSaved')}</Text>
            <Text style={[styles.amountValue, { color: goal.color }]}>
              {formatInPreferred(convertToALL(goal.savedAmount, goal.currency), preferred)}
            </Text>
          </View>
          <View style={styles.amountDivider} />
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{t('goalsObjective')}</Text>
            <Text style={styles.amountValue}>
              {formatInPreferred(convertToALL(goal.targetAmount, goal.currency), preferred)}
            </Text>
          </View>
          {!isComplete && (
            <>
              <View style={styles.amountDivider} />
              <View style={styles.amountBlock}>
                <Text style={styles.amountLabel}>{t('goalsRemaining2')}</Text>
                <Text style={styles.amountValue}>{formatInPreferred(Math.round(remainingALL), preferred)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Footer info */}
        <View style={styles.goalFooter}>
          {!isComplete && monthsToGo !== null && monthsToGo > 0 && (
            <View style={styles.goalChip}>
              <Ionicons name="time-outline" size={11} color={C.textMuted} />
              <Text style={styles.goalChipText}>{monthsLabel(monthsToGo, lang)}</Text>
            </View>
          )}
          {!isComplete && monthsToGo === null && monthlySavings <= 0 && (
            <View style={styles.goalChip}>
              <Ionicons name="time-outline" size={11} color={C.textMuted} />
              <Text style={styles.goalChipText}>{t('goalsSetBudgetForEst')}</Text>
            </View>
          )}
          {hasDeadline && (
            <View style={[
              styles.goalChip,
              deadlineOverdue && { backgroundColor: C.dangerBgSubtle, borderColor: C.dangerBorder },
              deadlineUrgent && !deadlineOverdue && { backgroundColor: C.warningBgSubtle, borderColor: C.warningBorder },
            ]}>
              <Ionicons
                name="calendar-outline"
                size={11}
                color={deadlineOverdue ? C.danger : deadlineUrgent ? C.warning : C.textMuted}
              />
              <Text style={[
                styles.goalChipText,
                deadlineOverdue && { color: C.danger },
                deadlineUrgent && !deadlineOverdue && { color: C.warning },
              ]}>
                {deadlineOverdue
                  ? (lang === 'en' ? `Deadline passed ${Math.abs(deadlineDays!)} days ago` : `Afati kaloi ${Math.abs(deadlineDays!)} ditë më parë`)
                  : deadlineUrgent
                  ? (lang === 'en' ? `${deadlineDays} days until deadline` : `${deadlineDays} ditë deri në afat`)
                  : deadlineLabel(goal.deadline!)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

type ModalStep = 'presets' | 'form';

export default function Qellimet() {
  const { state, addGoal, updateGoal, removeGoal } = useStore();
  const C = useThemeColors();
  const { t, lang } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Estimate monthly savings from last 3 months
  const monthlySavings = useMemo(() => {
    if (state.budget.monthly <= 0) return 0;
    const data = getMonthlyData(state.expenses);
    const recent = data.slice(-3).filter((d) => d.value > 0);
    if (recent.length === 0) return 0;
    const avgSpend = recent.reduce((s, d) => s + d.value, 0) / recent.length;
    return Math.max(state.budget.monthly - avgSpend, 0);
  }, [state.expenses, state.budget]);

  const personalGoals = useMemo(
    () => state.goals.filter((g) => g.mode === 'personal'),
    [state.goals]
  );
  const businessGoals = useMemo(
    () => state.goals.filter((g) => g.mode === 'business'),
    [state.goals]
  );

  const activeGoalsCount = state.goals.filter((g) => !g.completedAt).length;
  const totalGoalsCount = state.goals.length;

  // ── add modal state ────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('presets');
  const [selectedPreset, setSelectedPreset] = useState<GoalPreset | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formSaved, setFormSaved] = useState('0');
  const [formDeadline, setFormDeadline] = useState('');
  const [formCurrency, setFormCurrency] = useState<Currency>('ALL');
  const [formIcon, setFormIcon] = useState('flag-outline');
  const [formColor, setFormColor] = useState('#10B981');
  const [formBgColor, setFormBgColor] = useState('rgba(16,185,129,0.15)');
  const [formMode, setFormMode] = useState<'personal' | 'business'>(state.mode);

  // ── add savings modal ──────────────────────────────────────────────────────
  const [savingsModalGoal, setSavingsModalGoal] = useState<FinancialGoal | null>(null);
  const [savingsAmount, setSavingsAmount] = useState('');

  function openAddModal(preset?: GoalPreset) {
    setModalStep(preset ? 'form' : 'presets');
    if (preset) {
      fillFromPreset(preset);
    } else {
      resetForm();
    }
    setModalVisible(true);
  }

  function fillFromPreset(preset: GoalPreset) {
    setSelectedPreset(preset);
    setFormTitle(preset.title);
    setFormTarget(String(preset.suggestedAmount));
    setFormSaved('0');
    setFormDeadline('');
    setFormCurrency(preset.currency);
    setFormIcon(preset.icon);
    setFormColor(preset.color);
    setFormBgColor(preset.bgColor);
  }

  function resetForm() {
    setSelectedPreset(null);
    setFormTitle('');
    setFormTarget('');
    setFormSaved('0');
    setFormDeadline('');
    setFormCurrency('ALL');
    setFormIcon('flag-outline');
    setFormColor('#10B981');
    setFormBgColor('rgba(16,185,129,0.15)');
  }

  function handleSubmitGoal() {
    const target = parseFloat(formTarget.replace(',', '.'));
    const saved = parseFloat(formSaved.replace(',', '.') || '0');
    if (!formTitle.trim()) {
      Alert.alert(t('goalsErrorTitle'), t('goalsErrorNoTitle'));
      return;
    }
    if (isNaN(target) || target <= 0) {
      Alert.alert(t('goalsErrorTitle'), t('goalsErrorInvalidAmount'));
      return;
    }
    const deadlineValid =
      !formDeadline ||
      (/^\d{4}-\d{2}-\d{2}$/.test(formDeadline) && !isNaN(new Date(formDeadline).getTime()));
    if (!deadlineValid) {
      Alert.alert(t('goalsErrorTitle'), t('goalsErrorInvalidDate'));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const newGoal: FinancialGoal = {
      id: generateId(),
      title: formTitle.trim(),
      icon: formIcon,
      color: formColor,
      bgColor: formBgColor,
      targetAmount: target,
      savedAmount: Math.min(isNaN(saved) ? 0 : saved, target),
      currency: formCurrency,
      deadline: formDeadline || undefined,
      mode: formMode,
      createdAt: today,
      completedAt: saved >= target ? today : undefined,
    };
    addGoal(newGoal);
    setModalVisible(false);
  }

  function openSavingsModal(goal: FinancialGoal) {
    setSavingsModalGoal(goal);
    setSavingsAmount('');
  }

  function handleAddSavings() {
    if (!savingsModalGoal) return;
    const amount = parseFloat(savingsAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('goalsErrorTitle'), t('goalsErrorInvalidSavings'));
      return;
    }
    const newSaved = savingsModalGoal.savedAmount + amount;
    const isNowComplete = newSaved >= savingsModalGoal.targetAmount;
    updateGoal(savingsModalGoal.id, {
      savedAmount: newSaved,
      completedAt: isNowComplete && !savingsModalGoal.completedAt
        ? new Date().toISOString().slice(0, 10)
        : savingsModalGoal.completedAt,
    });
    setSavingsModalGoal(null);
    setSavingsAmount('');
  }

  const hasBizGoals = businessGoals.length > 0;
  const hasPersonalGoals = personalGoals.length > 0;
  const showBothSections = hasPersonalGoals && hasBizGoals;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>{t('goalsTitle')}</Text>
          {totalGoalsCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{activeGoalsCount} {t('goalsActive')}</Text>
            </View>
          )}
        </View>

        {/* Summary strip */}
        {totalGoalsCount > 0 && (
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalGoalsCount}</Text>
              <Text style={styles.summaryLabel}>{t('goalsTotal')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: C.primary }]}>{activeGoalsCount}</Text>
              <Text style={styles.summaryLabel}>{t('goalsInProgress')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                {state.goals.filter((g) => !!g.completedAt).length}
              </Text>
              <Text style={styles.summaryLabel}>{t('goalsCompleted')}</Text>
            </View>
            {monthlySavings > 0 && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {formatInPreferred(Math.round(monthlySavings), state.preferredCurrency)}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('goalsSavingsPerMonth')}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Empty state */}
        {totalGoalsCount === 0 && (
          <View style={styles.emptyCard}>
            <LinearGradient
              colors={['rgba(16,185,129,0.09)', 'rgba(59,130,246,0.04)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <LinearGradient
              colors={GRADIENTS.primaryShine as string[]}
              style={styles.emptyIconGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="trophy-outline" size={30} color={C.white} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t('goalsEmptyTitle2')}</Text>
            <Text style={styles.emptySub}>{t('goalsEmptySub2')}</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => openAddModal()}
              activeOpacity={0.84}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine as string[]}
                style={styles.emptyBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={16} color={C.white} />
                <Text style={styles.emptyBtnText}>{t('goalsAddFirstBtn')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Personal goals */}
        {hasPersonalGoals && (
          <>
            {showBothSections && (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>{t('goalsPersonal')}</Text>
              </View>
            )}
            {personalGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                monthlySavings={monthlySavings}
                onAddSavings={openSavingsModal}
                onDelete={removeGoal}
                preferred={state.preferredCurrency}
              />
            ))}
          </>
        )}

        {/* Business goals */}
        {hasBizGoals && (
          <>
            {showBothSections && (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionAccent, { backgroundColor: C.accentLight }]} />
                <Text style={styles.sectionTitle}>{t('goalsBusiness')}</Text>
                <View style={styles.bizTag}>
                  <Ionicons name="briefcase-outline" size={10} color={C.accentLight} />
                  <Text style={styles.bizTagText}>BIZ</Text>
                </View>
              </View>
            )}
            {businessGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                monthlySavings={monthlySavings}
                onAddSavings={openSavingsModal}
                onDelete={removeGoal}
                preferred={state.preferredCurrency}
              />
            ))}
          </>
        )}

        {/* Add goal button */}
        {totalGoalsCount > 0 && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openAddModal()}
            activeOpacity={0.84}
          >
            <LinearGradient
              colors={GRADIENTS.primaryShine as string[]}
              style={styles.addBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add" size={16} color={C.white} />
              <Text style={styles.addBtnText}>{t('goalsAddNew')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Smart tip */}
        {monthlySavings <= 0 && totalGoalsCount > 0 && (
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={14} color={C.accentLight} />
            <Text style={styles.tipText}>{t('goalsTipText')}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Add Goal Modal ─────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalTopEdge} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              {modalStep === 'form' && (
                <TouchableOpacity
                  onPress={() => setModalStep('presets')}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Ionicons name="arrow-back" size={20} color={C.textSub} />
                </TouchableOpacity>
              )}
              <Text style={styles.modalTitle}>
                {modalStep === 'presets' ? t('goalsModalSelectTitle') : t('goalsModalFormTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {modalStep === 'presets' ? (
                /* Preset grid */
                <View style={styles.presetGrid}>
                  {GOAL_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.title}
                      style={styles.presetCard}
                      onPress={() => {
                        fillFromPreset(preset);
                        setFormMode(state.mode);
                        setModalStep('form');
                      }}
                      activeOpacity={0.78}
                    >
                      <LinearGradient
                        colors={[preset.bgColor, 'transparent']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      <View style={[styles.presetIcon, { backgroundColor: preset.bgColor }]}>
                        <Ionicons name={preset.icon as any} size={20} color={preset.color} />
                      </View>
                      <Text style={styles.presetTitle}>{getGoalPresetTitle(preset.title, lang)}</Text>
                      <Text style={styles.presetAmount}>
                        {formatInPreferred(convertToALL(preset.suggestedAmount, preset.currency), state.preferredCurrency)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {/* Custom option */}
                  <TouchableOpacity
                    style={[styles.presetCard, styles.presetCardCustom]}
                    onPress={() => {
                      resetForm();
                      setFormMode(state.mode);
                      setModalStep('form');
                    }}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.presetIcon, { backgroundColor: C.elevated }]}>
                      <Ionicons name="create-outline" size={20} color={C.textMuted} />
                    </View>
                    <Text style={styles.presetTitle}>{t('goalsCustom')}</Text>
                    <Text style={styles.presetAmount}>{t('goalsCustomSubtitle')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Goal form */
                <View style={styles.form}>
                  {selectedPreset && (
                    <View style={[styles.formPresetBanner, { borderColor: formColor + '50' }]}>
                      <View style={[styles.formPresetIcon, { backgroundColor: formBgColor }]}>
                        <Ionicons name={formIcon as any} size={18} color={formColor} />
                      </View>
                      <Text style={[styles.formPresetName, { color: formColor }]}>{selectedPreset.title}</Text>
                    </View>
                  )}

                  {!selectedPreset && (
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>{t('goalsFormTitleLabel')}</Text>
                      <TextInput
                        style={styles.formInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder={t('goalsPlaceholderTitle')}
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                  )}

                  {selectedPreset && (
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>{t('goalsFormTitleOptional')}</Text>
                      <TextInput
                        style={styles.formInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder={selectedPreset.title}
                        placeholderTextColor={C.textMuted}
                      />
                    </View>
                  )}

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>{t('goalsFormTarget')}</Text>
                    <View style={styles.formInputRow}>
                      <TextInput
                        style={[styles.formInput, { flex: 1 }]}
                        value={formTarget}
                        onChangeText={setFormTarget}
                        keyboardType="numeric"
                        placeholder={t('goalsPlaceholderTarget')}
                        placeholderTextColor={C.textMuted}
                      />
                      <Text style={styles.formCurrencyTag}>L</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>{t('goalsFormSaved')}</Text>
                    <View style={styles.formInputRow}>
                      <TextInput
                        style={[styles.formInput, { flex: 1 }]}
                        value={formSaved}
                        onChangeText={setFormSaved}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={C.textMuted}
                      />
                      <Text style={styles.formCurrencyTag}>L</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>{t('goalsFormDeadline')}</Text>
                    <TextInput
                      style={styles.formInput}
                      value={formDeadline}
                      onChangeText={setFormDeadline}
                      placeholder={t('goalsPlaceholderDeadline')}
                      placeholderTextColor={C.textMuted}
                    />
                  </View>

                  {/* Mode selector */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>{t('goalsFormType')}</Text>
                    <View style={styles.modeRow}>
                      <TouchableOpacity
                        style={[styles.modeChip, formMode === 'personal' && styles.modeChipActive]}
                        onPress={() => setFormMode('personal')}
                        activeOpacity={0.78}
                      >
                        <Ionicons name="person-outline" size={13} color={formMode === 'personal' ? C.primary : C.textMuted} />
                        <Text style={[styles.modeChipText, formMode === 'personal' && styles.modeChipTextActive]}>
                          {t('goalsPersonalLabel')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modeChip, formMode === 'business' && styles.modeChipBizActive]}
                        onPress={() => setFormMode('business')}
                        activeOpacity={0.78}
                      >
                        <Ionicons name="briefcase-outline" size={13} color={formMode === 'business' ? C.accentLight : C.textMuted} />
                        <Text style={[styles.modeChipText, formMode === 'business' && styles.modeChipTextBizActive]}>
                          {t('goalsBizLabel')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.formActions}>
                    <Button variant="secondary" onPress={() => setModalVisible(false)} style={{ flex: 1 }}>
                      {t('cancel')}
                    </Button>
                    <Button onPress={handleSubmitGoal} style={{ flex: 1 }}>
                      {t('add')}
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Savings Modal ──────────────────────────────────── */}
      <Modal visible={!!savingsModalGoal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setSavingsModalGoal(null)}
          activeOpacity={1}
        >
          <TouchableOpacity style={styles.savingsModal} activeOpacity={1}>
            <View style={styles.modalTopEdge} />
            {savingsModalGoal && (
              <>
                <View style={[styles.savingsIconWrap, { backgroundColor: savingsModalGoal.bgColor }]}>
                  <Ionicons name={savingsModalGoal.icon as any} size={22} color={savingsModalGoal.color} />
                </View>
                <Text style={styles.savingsTitle}>{t('goalsAddSavingsTitle')}</Text>
                <Text style={styles.savingsSub}>
                  {savingsModalGoal.title} · {formatInPreferred(convertToALL(savingsModalGoal.savedAmount, savingsModalGoal.currency), state.preferredCurrency)} {t('goalsSaved').toLowerCase()}
                </Text>

                {/* Preview progress */}
                {(() => {
                  const addedNum = parseFloat(savingsAmount.replace(',', '.'));
                  const added = !isNaN(addedNum) && addedNum > 0 ? addedNum : 0;
                  const newSaved = savingsModalGoal.savedAmount + added;
                  const newPct = Math.min((newSaved / savingsModalGoal.targetAmount) * 100, 100);
                  const prevPct = Math.min((savingsModalGoal.savedAmount / savingsModalGoal.targetAmount) * 100, 100);
                  return (
                    <View style={styles.savingsProgress}>
                      <View style={styles.savingsProgressTrack}>
                        <View style={[styles.savingsProgressFill, { width: `${prevPct}%` as any, backgroundColor: savingsModalGoal.color }]} />
                        {added > 0 && (
                          <View style={[styles.savingsProgressPreview, { width: `${newPct - prevPct}%` as any, left: `${prevPct}%` as any, backgroundColor: savingsModalGoal.color + '55' }]} />
                        )}
                      </View>
                      <Text style={[styles.savingsProgressPct, { color: savingsModalGoal.color }]}>
                        {added > 0 ? newPct.toFixed(0) : prevPct.toFixed(0)}%
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.savingsInputRow}>
                  <TextInput
                    style={styles.savingsInput}
                    value={savingsAmount}
                    onChangeText={setSavingsAmount}
                    keyboardType="numeric"
                    placeholder={t('goalsNewAmountPlaceholder')}
                    placeholderTextColor={C.textMuted}
                    autoFocus
                  />
                  <Text style={styles.savingsCurrencyTag}>
                    {savingsModalGoal.currency}
                  </Text>
                </View>

                <View style={styles.savingsActions}>
                  <Button variant="secondary" onPress={() => setSavingsModalGoal(null)} style={{ flex: 1 }}>
                    {t('cancel')}
                  </Button>
                  <Button onPress={handleAddSavings} style={{ flex: 1 }}>
                    {t('save')}
                  </Button>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.7,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.primaryBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primaryLight,
  },

  // ── Summary strip ──────────────────────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  summaryLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  summaryDivider: { width: 1, height: 28, backgroundColor: C.border },

  // ── Goal card ──────────────────────────────────────────────
  goalCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  goalCardComplete: {
    borderColor: C.primaryBorder,
    shadowColor: C.primary,
    shadowOpacity: 0.12,
  },
  goalStrip: {
    width: 4,
    flexShrink: 0,
  },
  goalCardInner: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  goalTitleBlock: { flex: 1, gap: 3 },
  goalTitle: { fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
  },
  goalActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  goalActionText: { fontSize: 11, fontWeight: '700' },
  goalDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.elevated,
  },

  // progress
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.elevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '800', minWidth: 38, textAlign: 'right', letterSpacing: -0.2 },

  // amounts
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.elevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  amountBlock: { flex: 1, alignItems: 'center', gap: 3 },
  amountLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  amountValue: { fontSize: 12, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  amountDivider: { width: 1, height: 28, backgroundColor: C.border },

  // footer chips
  goalFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  goalChipText: { fontSize: 10, color: C.textMuted, fontWeight: '600' },

  // ── Section headers ────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.primary,
    opacity: 0.7,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3, flex: 1 },
  bizTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  bizTagText: { fontSize: 9, fontWeight: '800', color: C.accentLight, letterSpacing: 0.7 },

  // ── Empty state ────────────────────────────────────────────
  emptyCard: {
    borderRadius: 22,
    padding: 28,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    gap: 14,
    position: 'relative',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
    marginTop: 8,
  },
  emptyIconGrad: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    width: '100%',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 7,
    marginTop: 4,
  },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: C.white },

  // ── Add button ─────────────────────────────────────────────
  addBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  // ── Tip card ───────────────────────────────────────────────
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  tipText: { flex: 1, fontSize: 12, color: C.accentLight, fontWeight: '500', lineHeight: 18 },

  // ── Modals ─────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlayStrong,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: C.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: C.borderGlassLight,
    position: 'relative',
  },
  modalTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
  },

  // Preset grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '47%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  presetCardCustom: {
    borderStyle: 'dashed' as any,
    borderColor: C.borderLight,
  },
  presetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  presetAmount: { fontSize: 11, color: C.textMuted, fontWeight: '500' },

  // Form
  form: { gap: 14, paddingBottom: 8 },
  formPresetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: C.card,
    marginBottom: 4,
  },
  formPresetIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  formPresetName: { fontSize: 15, fontWeight: '700' },
  formField: { gap: 6 },
  formLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  formInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  formInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formCurrencyTag: {
    fontSize: 16,
    fontWeight: '800',
    color: C.primary,
    paddingHorizontal: 4,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.elevated,
  },
  modeChipActive: {
    borderColor: C.primaryBorder,
    backgroundColor: C.primaryBg,
  },
  modeChipBizActive: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentBgSubtle,
  },
  modeChipText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  modeChipTextActive: { color: C.primaryLight },
  modeChipTextBizActive: { color: C.accentLight },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 6 },

  // Savings modal
  savingsModal: {
    backgroundColor: C.elevated,
    borderRadius: 24,
    padding: 24,
    margin: 24,
    borderWidth: 1,
    borderColor: C.borderGlassLight,
    gap: 14,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.65,
    shadowRadius: 48,
    elevation: 32,
    alignSelf: 'center',
    width: '90%',
  },
  savingsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  savingsTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  savingsSub: { fontSize: 13, color: C.textMuted },
  savingsProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savingsProgressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: C.elevated,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  savingsProgressFill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 5 },
  savingsProgressPreview: { position: 'absolute', top: 0, bottom: 0, borderRadius: 5 },
  savingsProgressPct: { fontSize: 14, fontWeight: '800', minWidth: 44, textAlign: 'right', letterSpacing: -0.3 },
  savingsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    paddingHorizontal: 16,
    height: 60,
    gap: 8,
  },
  savingsInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  savingsCurrencyTag: { fontSize: 16, fontWeight: '800', color: C.primary },
  savingsActions: { flexDirection: 'row', gap: 12 },
  });
}
