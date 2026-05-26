import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { CATEGORIES } from '@/constants/categories';
import { CURRENCIES } from '@/constants/currencies';
import { C, GRADIENTS } from '@/constants/colors';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';
import { RECURRING_SUBSCRIPTION_KEYWORDS } from '@/constants/subscriptions';
import { parseExpense } from '@/lib/parseExpense';
import { parseExpenseWithAI, needsAI, type AiParseStatus, type AiParseResult } from '@/lib/aiService';
import {
  pickImage,
  scanReceipt,
  countDetectedFields,
  type ScanSource,
  type ScanStatus,
  type ReceiptScanResult,
  type OcrProgressEvent,
} from '@/lib/receiptScanner';
import type { Currency, CategoryId, RecurringFrequency, Subscription } from '@/types';
import { generateId, computeNextPaymentDate } from '@/lib/utils';
import { startListening, stopListening, isVoiceSupported, type VoiceState } from '@/lib/voiceInput';

// Returns YYYY-MM-DD in the device's local timezone (not UTC).
// `new Date().toISOString().slice(0,10)` gives the UTC date, which is wrong
// for users east of UTC (e.g. Albania UTC+2 — past 22:00 the UTC date is already tomorrow).
function localDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// All categories combined for animation value initialization
const ALL_CATS = [...CATEGORIES, ...BUSINESS_CATEGORIES];

export default function ShtoShpenzim() {
  const router = useRouter();
  const { addExpense, clearSaveError, state, addSubscription } = useStore();
  const activeMode = state.mode;
  const displayCategories = activeMode === 'business' ? BUSINESS_CATEGORIES : CATEGORIES;
  const defaultCatId: CategoryId = activeMode === 'business' ? 'sherbime' : 'ushqim';

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ALL');
  const [category, setCategory] = useState<CategoryId>(defaultCatId);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateStr);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [cloudSaveFailed, setCloudSaveFailed] = useState(false);
  const [cloudDebugError, setCloudDebugError] = useState<string | null>(null);

  // Receipt scan
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanProgressLabel, setScanProgressLabel] = useState('');

  // Quick natural-language input
  const [quickText, setQuickText] = useState('');
  const [quickFocused, setQuickFocused] = useState(false);
  const [aiState, setAiState] = useState<AiParseStatus>('idle');
  const [lastAiResult, setLastAiResult] = useState<AiParseResult | null>(null);
  const quickInputRef = useRef<TextInput>(null);
  // Tracks latest quick-input text so debounce callbacks can read it without stale closures.
  const quickTextRef = useRef('');
  // Debounce handle for auto AI trigger.
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against concurrent AI calls (manual + auto).
  const isAiRunningRef = useRef(false);

  // Recurring
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  // Voice input
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceTranscriptRef = useRef('');
  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const micPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const voiceSupported = isVoiceSupported();

  const amountRef = useRef<TextInput>(null);

  // Animated values
  const amountGlowAnim = useRef(new Animated.Value(0)).current;
  const amountShakeAnim = useRef(new Animated.Value(0)).current;
  const submitScaleAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0.5)).current;

  // Per-category active fill animations — initialized for all personal + business categories
  const catAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      ALL_CATS.map((cat) => [cat.id, new Animated.Value(cat.id === defaultCatId ? 1 : 0)])
    )
  ).current;

  // Per-currency active fill animations
  const currAnims = useRef<Record<string, Animated.Value>>({
    ALL: new Animated.Value(1),
    EUR: new Animated.Value(0),
    USD: new Animated.Value(0),
  }).current;

  // Clear stale cloud errors on open, auto-focus amount
  useEffect(() => {
    clearSaveError();
    const t = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  // Cancel pending timers and voice recognition on unmount.
  useEffect(() => {
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      stopListening();
    };
  }, []);

  const handleAmountFocus = () => {
    setAmountFocused(true);
    Animated.spring(amountGlowAnim, {
      toValue: 1,
      tension: 200,
      friction: 20,
      useNativeDriver: false,
    }).start();
  };

  const handleAmountBlur = () => {
    setAmountFocused(false);
    Animated.timing(amountGlowAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const shakeAmountField = () => {
    Animated.sequence([
      Animated.timing(amountShakeAnim, { toValue: 10, duration: 55, useNativeDriver: false }),
      Animated.timing(amountShakeAnim, { toValue: -10, duration: 55, useNativeDriver: false }),
      Animated.timing(amountShakeAnim, { toValue: 7, duration: 45, useNativeDriver: false }),
      Animated.timing(amountShakeAnim, { toValue: -7, duration: 45, useNativeDriver: false }),
      Animated.timing(amountShakeAnim, { toValue: 0, duration: 35, useNativeDriver: false }),
    ]).start();
    amountRef.current?.focus();
  };

  const handleCategorySelect = (catId: CategoryId) => {
    if (catId === category) return;
    Animated.spring(catAnims[category], { toValue: 0, tension: 300, friction: 22, useNativeDriver: false }).start();
    Animated.spring(catAnims[catId], { toValue: 1, tension: 200, friction: 16, useNativeDriver: false }).start();
    setCategory(catId);
  };

  const handleCurrencySelect = (code: Currency) => {
    if (code === currency) return;
    Animated.timing(currAnims[currency], { toValue: 0, duration: 150, useNativeDriver: false }).start();
    Animated.spring(currAnims[code], { toValue: 1, tension: 220, friction: 18, useNativeDriver: false }).start();
    setCurrency(code);
  };

  const addQuickAmount = (n: number) => {
    const current = parseFloat(amount.replace(',', '.')) || 0;
    setAmount(String(current + n));
  };

  // ── Quick natural-language input handler ─────────────────────────────────
  const handleQuickText = (text: string) => {
    // Keep ref in sync so debounce callbacks always have fresh text.
    quickTextRef.current = text;

    // Cancel any pending auto-AI trigger — we'll re-evaluate below.
    if (aiDebounceRef.current) {
      clearTimeout(aiDebounceRef.current);
      aiDebounceRef.current = null;
    }

    setQuickText(text);
    // Reset AI state whenever the user edits the text
    if (aiState !== 'idle') {
      setAiState('idle');
      setLastAiResult(null);
    }

    if (!text.trim()) {
      // Reset form to defaults on clear
      setAmount('');
      handleCurrencySelect('ALL');
      handleCategorySelect(defaultCatId);
      setNote('');
      setDate(localDateStr());
      setAmountError(null);
      return;
    }

    // Apply local parse immediately (instant feedback)
    const p = parseExpense(text);
    if (p.detectedAmount && p.amount !== null) {
      setAmount(p.amount % 1 === 0 ? String(p.amount) : p.amount.toFixed(2));
      if (amountError) setAmountError(null);
    }
    if (p.detectedCurrency && p.currency !== currency) handleCurrencySelect(p.currency);
    if (p.detectedCategory && p.category !== category) handleCategorySelect(p.category);
    setNote(p.note);
    if (p.detectedDate) setDate(p.date);

    // Auto-trigger AI when local confidence is low and text is long enough.
    // We debounce so the call fires only after the user pauses typing.
    if (text.length >= 4 && needsAI(p) && !isAiRunningRef.current) {
      aiDebounceRef.current = setTimeout(() => {
        const latestText = quickTextRef.current;
        if (!latestText.trim() || isAiRunningRef.current) return;
        isAiRunningRef.current = true;
        setAiState('loading');
        parseExpenseWithAI(latestText)
          .then((result) => {
            isAiRunningRef.current = false;
            setLastAiResult(result);
            if (result.detectedAmount && result.amount !== null) {
              setAmount(result.amount % 1 === 0 ? String(result.amount) : result.amount.toFixed(2));
              setAmountError(null);
            }
            handleCurrencySelect(result.currency);
            handleCategorySelect(result.category);
            if (result.note) setNote(result.note);
            if (result.detectedDate) setDate(result.date);
            setAiState(result.source === 'ai' ? 'success' : 'failed');
          })
          .catch(() => {
            isAiRunningRef.current = false;
            setAiState('failed');
          });
      }, 750);
    }
  };

  const clearQuickInput = () => {
    if (aiDebounceRef.current) { clearTimeout(aiDebounceRef.current); aiDebounceRef.current = null; }
    quickTextRef.current = '';
    setQuickText('');
    setAiState('idle');
    setLastAiResult(null);
    handleQuickText('');
    setTimeout(() => amountRef.current?.focus(), 100);
  };

  // ── Receipt scan ──────────────────────────────────────────────────────────
  const runScan = async (source: ScanSource) => {
    setScanStatus('picking');
    setScanResult(null);
    setScanProgress(0);
    setScanProgressLabel('');

    const base64 = await pickImage(source);
    if (!base64) {
      setScanStatus('idle');
      return;
    }

    setScanStatus('scanning');
    setScanProgress(5);
    const result = await scanReceipt(base64, (e: OcrProgressEvent) => {
      setScanProgress(e.progress);
      setScanProgressLabel(e.status);
    });
    setScanResult(result);

    const hasData = result.source === 'ai' && countDetectedFields(result) > 0;
    setScanStatus(hasData ? 'done' : 'error');

    // Auto-fill form with detected fields
    const p = result.parsed;
    if (p.detectedAmount && p.amount !== null) {
      const v = p.amount % 1 === 0 ? String(p.amount) : p.amount.toFixed(2);
      setAmount(v);
      if (amountError) setAmountError(null);
    }
    if (p.detectedCurrency && p.currency !== currency) handleCurrencySelect(p.currency);
    if (p.detectedCategory && p.category !== category) handleCategorySelect(p.category);
    if (p.note) setNote(p.note);
    if (p.detectedDate) setDate(p.date);
  };

  const resetScan = () => {
    setScanStatus('idle');
    setScanResult(null);
  };

  // ── AI parse handler (manual trigger) ────────────────────────────────────
  const handleAiParse = async () => {
    // Cancel any pending auto-trigger — this manual call takes priority.
    if (aiDebounceRef.current) { clearTimeout(aiDebounceRef.current); aiDebounceRef.current = null; }
    if (!quickText.trim() || isAiRunningRef.current) return;

    isAiRunningRef.current = true;
    setAiState('loading');

    try {
      const result = await parseExpenseWithAI(quickText);
      setLastAiResult(result);

      if (result.detectedAmount && result.amount !== null) {
        setAmount(result.amount % 1 === 0 ? String(result.amount) : result.amount.toFixed(2));
        if (amountError) setAmountError(null);
      }
      if (result.currency !== currency) handleCurrencySelect(result.currency);
      if (result.category !== category) handleCategorySelect(result.category);
      if (result.note) setNote(result.note);
      if (result.detectedDate) setDate(result.date);

      setAiState(result.source === 'ai' ? 'success' : 'failed');
    } finally {
      isAiRunningRef.current = false;
    }
  };

  // ── Voice input ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (voiceState === 'listening') {
      micPulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, { toValue: 1.3, duration: 550, useNativeDriver: false }),
          Animated.timing(micPulseAnim, { toValue: 0.82, duration: 550, useNativeDriver: false }),
        ])
      );
      micPulseLoopRef.current.start();
    } else {
      micPulseLoopRef.current?.stop();
      micPulseLoopRef.current = null;
      Animated.spring(micPulseAnim, { toValue: 1, tension: 300, friction: 20, useNativeDriver: false }).start();
    }
  }, [voiceState]);

  const applyVoiceTranscript = () => {
    const text = voiceTranscriptRef.current.trim();
    if (!text) {
      setVoiceState('error');
      setVoiceError('Nuk u dëgjua asgjë. Provo sërish.');
      setTimeout(() => {
        setVoiceState(prev => prev === 'error' ? 'idle' : prev);
        setVoiceError(null);
      }, 2500);
      return;
    }
    handleQuickText(text);
    setVoiceState('success');
    setTimeout(() => setVoiceState(prev => prev === 'success' ? 'idle' : prev), 1400);
  };

  const startVoice = () => {
    if (!voiceSupported) {
      setVoiceState('error');
      setVoiceError('Zëri nuk mbështetet. Provo Chrome ose Edge.');
      setTimeout(() => {
        setVoiceState(prev => prev === 'error' ? 'idle' : prev);
        setVoiceError(null);
      }, 3500);
      return;
    }
    voiceTranscriptRef.current = '';
    setVoiceError(null);
    startListening(
      (state) => {
        if (state === 'processing') {
          applyVoiceTranscript();
        } else if (state !== 'error') {
          setVoiceState(state);
        }
      },
      (result) => {
        voiceTranscriptRef.current = result.transcript;
        setQuickText(result.transcript);
        quickTextRef.current = result.transcript;
      },
      (error) => {
        setVoiceState('error');
        switch (error) {
          case 'permission_denied':
            setVoiceError('Lejo mikrofonin në cilësimet e shfletuesit.'); break;
          case 'no_speech':
            setVoiceError('Nuk u dëgjua asgjë. Provo sërish.'); break;
          case 'not_supported':
            setVoiceError('Zëri nuk mbështetet. Provo Chrome ose Edge.'); break;
          case 'network':
            setVoiceError('Problem rrjeti. Kontrollo lidhjen.'); break;
          default:
            setVoiceError('Gabim. Provo sërish.');
        }
        setTimeout(() => {
          setVoiceState(prev => prev === 'error' ? 'idle' : prev);
          setVoiceError(null);
        }, 3200);
      },
    );
  };

  const stopVoice = () => stopListening();

  const handleVoiceBtnPress = () => {
    if (voiceState === 'listening') stopVoice();
    else startVoice();
  };

  const isValidDate = (d: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const [y, m, day] = d.split('-').map(Number);
    const parsed = new Date(y, m - 1, day);
    return (
      parsed.getFullYear() === y &&
      parsed.getMonth() === m - 1 &&
      parsed.getDate() === day
    );
  };

  const handleSubmit = async () => {
    // Validate amount
    const trimmed = amount.trim();
    const num = parseFloat(trimmed.replace(',', '.'));
    if (!trimmed || isNaN(num)) {
      setAmountError('Shkruani një shumë të vlefshme.');
      shakeAmountField();
      return;
    }
    if (num <= 0) {
      setAmountError('Shuma duhet të jetë pozitive.');
      shakeAmountField();
      return;
    }

    // Validate date
    if (!isValidDate(date)) {
      setDateError(true);
      return;
    }

    setAmountError(null);
    setDateError(false);
    setLoading(true);
    Animated.spring(submitScaleAnim, { toValue: 0.96, tension: 300, friction: 20, useNativeDriver: false }).start();

    // For today: store the actual current moment so the time display is correct.
    // For past dates: "YYYY-MM-DDT00:00:00" (no Z) is parsed as local midnight.
    const storedDate = date === localDateStr()
      ? new Date().toISOString()
      : new Date(`${date}T00:00:00`).toISOString();

    const { cloudSaved, debugError } = await addExpense({
      amount: num,
      currency,
      category,
      note: note.trim(),
      date: storedDate,
      mode: activeMode,
    });

    // Auto-create subscription when user toggled recurring
    if (isRecurring) {
      const alreadyExists = state.subscriptions.some(
        (s) => s.name.toLowerCase() === (note.trim() || selectedCategory.name).toLowerCase()
      );
      if (!alreadyExists) {
        const newSub: Subscription = {
          id: generateId(),
          name: note.trim() || selectedCategory.name,
          icon: selectedCategory.icon,
          color: selectedCategory.color,
          bgColor: selectedCategory.bgColor,
          amount: num,
          currency,
          frequency: recurringFrequency,
          startDate: date,
          nextPaymentDate: computeNextPaymentDate(date, recurringFrequency),
          isActive: true,
          categoryId: category,
        };
        addSubscription(newSub);
      }
    }

    setLoading(false);
    setCloudSaveFailed(!cloudSaved);
    if (debugError) setCloudDebugError(debugError);
    setShowSuccess(true);

    Animated.parallel([
      Animated.timing(successAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(successScaleAnim, { toValue: 1, tension: 140, friction: 12, useNativeDriver: false }),
    ]).start();

    if (cloudSaved) {
      // Success: auto-dismiss after 1.3s
      setTimeout(() => {
        Animated.timing(successAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
          router.back();
        });
      }, 1300);
    }
    // Failure: overlay stays until the user taps it (handleDismissFailureOverlay)
  };

  const handleDismissFailureOverlay = () => {
    Animated.timing(successAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
      router.back();
    });
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency)!;
  const selectedCategory = [...CATEGORIES, ...BUSINESS_CATEGORIES].find((c) => c.id === category) ?? CATEGORIES[0];

  // Smart suggestion: show when note/quickText matches subscription keywords and not yet dismissed
  const showRecurringSuggestion = (() => {
    if (isRecurring || suggestDismissed) return false;
    const text = (note + ' ' + quickText).toLowerCase();
    return RECURRING_SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw));
  })();

  // Preview data for chips: AI result when available, otherwise live local parse
  const lastParsed = quickText.trim() ? parseExpense(quickText) : null;
  const previewData =
    (aiState === 'success' || aiState === 'failed') && lastAiResult ? lastAiResult : lastParsed;

  const today = localDateStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));

  const quickAmounts = currency === 'ALL' ? [100, 500, 1000, 5000] : [5, 10, 50, 100];

  const amountBorderColor = amountGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.primary],
  });
  const amountShadowOpacity = amountGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.28],
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 16}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.72}>
            <Ionicons name="close" size={20} color={C.textSub} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Animated.View style={[styles.headerDot, { backgroundColor: selectedCategory.color }]} />
            <Text style={styles.headerTitle}>Shto Shpenzim</Text>
          </View>
          {activeMode === 'business' ? (
            <View style={styles.bizModeTag}>
              <Ionicons name="briefcase-outline" size={10} color={C.accentLight} />
              <Text style={styles.bizModeTagText}>BIZ</Text>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Quick Input Card ── */}
          <View style={[
            styles.quickCard,
            quickFocused && aiState === 'idle' && voiceState === 'idle' && styles.quickCardFocused,
            aiState === 'success' && styles.quickCardAI,
            aiState === 'loading' && styles.quickCardLoading,
            voiceState === 'listening' && styles.quickCardVoice,
          ]}>
            <LinearGradient
              colors={
                voiceState === 'listening'
                  ? ['rgba(239,68,68,0.08)', 'rgba(239,68,68,0.02)', 'transparent']
                  : aiState === 'success'
                    ? ['rgba(16,185,129,0.08)', 'rgba(16,185,129,0.02)', 'transparent']
                    : ['rgba(245,158,11,0.07)', 'rgba(245,158,11,0.02)', 'transparent']
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />

            {/* Header row */}
            <View style={styles.quickHeader}>
              {/* Left badge — changes based on AI/voice state */}
              <View style={[
                styles.quickBadge,
                aiState === 'success' && styles.quickBadgeAI,
                voiceState === 'listening' && styles.quickBadgeVoice,
              ]}>
                {voiceState === 'listening' ? (
                  <>
                    <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
                      <Ionicons name="mic" size={10} color={C.danger} />
                    </Animated.View>
                    <Text style={[styles.quickBadgeText, styles.quickBadgeTextVoice]}>
                      DUKE DËGJUAR...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={aiState === 'success' ? 'sparkles' : 'flash-outline'}
                      size={10}
                      color={aiState === 'success' ? C.primary : C.warning}
                    />
                    <Text style={[styles.quickBadgeText, aiState === 'success' && styles.quickBadgeTextAI]}>
                      {aiState === 'success' ? 'AI ANALIZOI' : 'HYRJE E SHPEJTË'}
                    </Text>
                  </>
                )}
              </View>

              {/* Right controls */}
              <View style={styles.quickHeaderRight}>
                {/* Voice button */}
                {voiceState === 'idle' && voiceSupported && (
                  <TouchableOpacity
                    onPress={handleVoiceBtnPress}
                    style={styles.voiceBtn}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="mic-outline" size={11} color={C.textMuted} />
                    <Text style={[styles.aiBtnSmallText, { color: C.textMuted }]}>ZË</Text>
                  </TouchableOpacity>
                )}
                {voiceState === 'listening' && (
                  <TouchableOpacity
                    onPress={handleVoiceBtnPress}
                    style={[styles.voiceBtn, styles.voiceBtnActive]}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    activeOpacity={0.75}
                  >
                    <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
                      <Ionicons name="mic" size={11} color={C.danger} />
                    </Animated.View>
                    <Text style={[styles.aiBtnSmallText, { color: C.danger }]}>NDALOJ</Text>
                  </TouchableOpacity>
                )}
                {voiceState === 'success' && (
                  <View style={[styles.voiceBtn, { backgroundColor: C.primaryBgSubtle, borderColor: C.primaryBorder }]}>
                    <Ionicons name="checkmark" size={11} color={C.primary} />
                  </View>
                )}
                {voiceState === 'processing' && (
                  <ActivityIndicator size="small" color={C.textMuted} />
                )}
                {/* AI trigger — shown when text is ready and AI hasn't run */}
                {quickText.length >= 3 && aiState === 'idle' && (
                  <TouchableOpacity
                    onPress={handleAiParse}
                    style={styles.aiBtnSmall}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="sparkles" size={11} color={C.primary} />
                    <Text style={styles.aiBtnSmallText}>AI</Text>
                  </TouchableOpacity>
                )}
                {/* Retry after fallback */}
                {quickText.length >= 3 && aiState === 'failed' && (
                  <TouchableOpacity
                    onPress={handleAiParse}
                    style={[styles.aiBtnSmall, styles.aiBtnSmallRetry]}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="refresh-outline" size={11} color={C.textMuted} />
                    <Text style={[styles.aiBtnSmallText, { color: C.textMuted }]}>Riprovo</Text>
                  </TouchableOpacity>
                )}
                {/* Loading spinner */}
                {aiState === 'loading' && (
                  <ActivityIndicator size="small" color={C.primary} />
                )}
                {/* Clear button */}
                {quickText.length > 0 && aiState !== 'loading' && (
                  <TouchableOpacity
                    onPress={clearQuickInput}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Text input */}
            <TextInput
              ref={quickInputRef}
              style={[styles.quickInput, quickText.length > 0 && styles.quickInputFilled]}
              value={quickText}
              onChangeText={handleQuickText}
              onSubmitEditing={handleAiParse}
              placeholder={
                activeMode === 'business'
                  ? 'Furnitor 5000 lek  ·  Marketing 200 euro  ·  Shërbim IT 1500'
                  : 'Kafe 150 lek  ·  Netflix 15 euro  ·  Naftë 3000 lek dje'
              }
              placeholderTextColor={C.textFaint}
              onFocus={() => setQuickFocused(true)}
              onBlur={() => setQuickFocused(false)}
              returnKeyType="done"
              blurOnSubmit={false}
              selectionColor={voiceState === 'listening' ? C.danger : aiState === 'success' ? C.primary : C.warning}
              editable={aiState !== 'loading' && voiceState !== 'listening'}
            />

            {/* Loading overlay on the input area */}
            {aiState === 'loading' && (
              <View style={styles.aiLoadingRow}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={styles.aiLoadingText}>AI po analizon...</Text>
              </View>
            )}

            {/* Voice error */}
            {voiceState === 'error' && voiceError && (
              <View style={styles.voiceErrorRow}>
                <Ionicons name="alert-circle-outline" size={11} color={C.danger} />
                <Text style={styles.voiceErrorText} numberOfLines={2}>{voiceError}</Text>
                <TouchableOpacity
                  onPress={handleVoiceBtnPress}
                  style={styles.voiceRetryBtn}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                >
                  <Text style={styles.voiceRetryText}>Riprovo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Parsed preview chips */}
            {previewData && quickText.length > 0 && aiState !== 'loading' && (
              <View style={styles.quickPreviewRow}>
                {/* AI / locale source badge */}
                {(aiState === 'success' || aiState === 'failed') && (
                  <View style={[
                    styles.aiSourceChip,
                    aiState === 'success' ? styles.aiSourceChipSuccess : styles.aiSourceChipLocal,
                  ]}>
                    <Ionicons
                      name={aiState === 'success' ? 'sparkles' : 'phone-portrait-outline'}
                      size={9}
                      color={aiState === 'success' ? C.primary : C.textMuted}
                    />
                    <Text style={[
                      styles.aiSourceChipText,
                      aiState === 'success' ? styles.aiSourceChipTextSuccess : styles.aiSourceChipTextLocal,
                    ]}>
                      {aiState === 'success' ? 'AI' : 'local'}
                    </Text>
                  </View>
                )}

                {/* Category */}
                {previewData.detectedCategory && (() => {
                  const cat = [...CATEGORIES, ...BUSINESS_CATEGORIES].find((c) => c.id === previewData.category);
                  if (!cat) return null;
                  return (
                    <View style={[styles.quickPreviewChip, { backgroundColor: cat.bgColor, borderColor: cat.color + '44' }]}>
                      <Ionicons name={cat.icon as any} size={11} color={cat.color} />
                      <Text style={[styles.quickPreviewChipText, { color: cat.color }]}>{cat.name}</Text>
                    </View>
                  );
                })()}

                {/* Amount */}
                {previewData.detectedAmount && previewData.amount !== null && (
                  <View style={styles.quickPreviewChip}>
                    <Text style={styles.quickPreviewChipText}>
                      {previewData.currency === 'ALL'
                        ? `${Math.round(previewData.amount).toLocaleString('sq-AL')} L`
                        : `${CURRENCIES.find(c => c.code === previewData.currency)?.symbol ?? ''}${previewData.amount}`}
                    </Text>
                  </View>
                )}

                {/* Date */}
                {previewData.detectedDate && (
                  <View style={styles.quickPreviewChip}>
                    <Ionicons name="calendar-outline" size={10} color={C.textMuted} />
                    <Text style={styles.quickPreviewChipText}>
                      {previewData.date === (() => {
                        const d = new Date(); d.setDate(d.getDate()-1);
                        return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
                      })() ? 'Dje' : 'Sot'}
                    </Text>
                  </View>
                )}

                {/* Note preview */}
                {previewData.note.length > 0 && (
                  <Text style={styles.quickNotePreview} numberOfLines={1}>
                    „{previewData.note}"
                  </Text>
                )}
              </View>
            )}

            {/* Hint — shown only when empty */}
            {quickText.length === 0 && (
              <Text style={styles.quickHint}>
                Shembuj: "Kafe 150 lek" · "Netflix 15 euro" · "Naftë 3000 lek dje"
              </Text>
            )}
          </View>

          {/* ── Receipt Scan Section ── */}
          <ScanSection
            status={scanStatus}
            result={scanResult}
            onScan={runScan}
            onReset={resetScan}
          />

          {/* ── Amount Card ── */}
          <Animated.View
            style={[
              styles.amountCard,
              {
                borderColor: amountBorderColor,
                shadowOpacity: amountShadowOpacity,
                transform: [{ translateX: amountShakeAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(16,185,129,0.06)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <Text style={styles.sectionLabel}>SHUMA</Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => amountRef.current?.focus()}
              style={styles.amountRow}
            >
              <Text style={[styles.currSymbol, amountFocused && { color: C.primary }]}>
                {selectedCurrency.symbol}
              </Text>
              <TextInput
                ref={amountRef}
                style={styles.amountInput}
                value={amount}
                onChangeText={(v) => { setAmount(v); if (amountError) setAmountError(null); }}
                placeholder="0"
                placeholderTextColor={C.textFaint}
                keyboardType="decimal-pad"
                onFocus={handleAmountFocus}
                onBlur={handleAmountBlur}
                selectionColor={C.primary}
                returnKeyType="done"
              />
              {amount.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setAmount(''); setAmountError(null); amountRef.current?.focus(); }}
                  style={styles.clearBtn}
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                >
                  <Ionicons name="close-circle" size={22} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Quick amount chips */}
            <View style={styles.quickRow}>
              {quickAmounts.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => addQuickAmount(q)}
                  style={({ pressed, hovered }: any) => [
                    styles.quickChip,
                    pressed && { backgroundColor: C.primaryBgStrong, borderColor: C.primaryBorder },
                    !pressed && hovered && { backgroundColor: C.floating, borderColor: C.borderLight },
                  ]}
                >
                  <Text style={styles.quickChipText}>+{q}</Text>
                </Pressable>
              ))}
            </View>

            {/* Currency tabs */}
            <View style={styles.currTabs}>
              {CURRENCIES.map((c) => {
                const anim = currAnims[c.code];
                const bgColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', C.primaryBgStrong] });
                const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.primaryBorder] });
                const textColor = anim.interpolate({ inputRange: [0, 1], outputRange: [C.textMuted, C.primary] });
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => handleCurrencySelect(c.code)}
                    style={{ flex: 1 }}
                  >
                    <Animated.View style={[styles.currTab, { backgroundColor: bgColor, borderColor }]}>
                      <Animated.Text style={[styles.currTabSym, { color: textColor }]}>{c.symbol}</Animated.Text>
                      <Animated.Text style={[styles.currTabCode, { color: textColor }]}>{c.code}</Animated.Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Amount error ── */}
          {amountError && (
            <View style={styles.amountErrorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={C.danger} />
              <Text style={styles.amountErrorText}>{amountError}</Text>
            </View>
          )}

          {/* ── Category ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>KATEGORIA</Text>
              <View style={[styles.sectionDot, { backgroundColor: selectedCategory.color }]} />
            </View>
            <View style={styles.catGrid}>
              {displayCategories.map((cat) => {
                const isActive = category === cat.id;
                const fillAnim = catAnims[cat.id];
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleCategorySelect(cat.id)}
                    style={({ pressed, hovered }: any) => [
                      styles.catItem,
                      isActive && { borderColor: cat.color + '66' },
                      !isActive && hovered && { backgroundColor: C.elevated, borderColor: C.borderLight },
                      pressed && { opacity: 0.84 },
                    ]}
                  >
                    {/* Animated bg fill */}
                    <Animated.View
                      style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden', opacity: fillAnim }]}
                    >
                      <LinearGradient
                        colors={[cat.bgColor, cat.bgColor + '55']}
                        style={{ flex: 1 }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    </Animated.View>

                    <View style={[styles.catIcon, { backgroundColor: cat.bgColor, borderColor: cat.color + '30' }]}>
                      <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                    </View>
                    <Text style={[styles.catName, isActive && { color: cat.color, fontWeight: '700' }]} numberOfLines={1}>
                      {cat.name}
                    </Text>

                    {/* Animated check badge */}
                    <Animated.View
                      style={[
                        styles.catCheck,
                        { backgroundColor: cat.color, opacity: fillAnim, transform: [{ scale: fillAnim }] },
                      ]}
                    >
                      <Ionicons name="checkmark" size={9} color={C.white} />
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Details (Note + Date) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DETAJE</Text>
            <View style={styles.detailsCard}>
              {/* Note row */}
              <View style={[styles.detailRow, noteFocused && styles.detailRowFocused]}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="create-outline" size={16} color={noteFocused ? C.primary : C.textMuted} />
                </View>
                <TextInput
                  style={styles.detailInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Shënim... (opsional)"
                  placeholderTextColor={C.textMuted}
                  maxLength={100}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}
                  selectionColor={C.primary}
                  returnKeyType="done"
                />
                {note.length > 0 && (
                  <Text style={styles.charCount}>{note.length}/100</Text>
                )}
              </View>

              <View style={styles.detailDivider} />

              {/* Date row */}
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="calendar-outline" size={16} color={C.textMuted} />
                </View>
                <View style={styles.dateInner}>
                  <Pressable
                    onPress={() => setDate(today)}
                    style={[styles.dateChip, date === today && styles.dateChipActive]}
                  >
                    {date === today && (
                      <LinearGradient
                        colors={[C.primaryBgStrong, C.primaryBg]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.dateChipText, date === today && styles.dateChipTextActive]}>
                      Sot
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDate(yesterday)}
                    style={[styles.dateChip, date === yesterday && styles.dateChipActive]}
                  >
                    {date === yesterday && (
                      <LinearGradient
                        colors={[C.primaryBgStrong, C.primaryBg]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.dateChipText, date === yesterday && styles.dateChipTextActive]}>
                      Dje
                    </Text>
                  </Pressable>
                  <TextInput
                    style={[styles.dateInput, dateError && { color: C.danger }]}
                    value={date}
                    onChangeText={(v) => { setDate(v); setDateError(false); }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.textMuted}
                    selectionColor={C.primary}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {dateError && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={C.danger} />
                  <Text style={styles.fieldErrorText}>
                    Formati i datës nuk është i vlefshëm (YYYY-MM-DD)
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Recurring / Abonim ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>PERIODIK</Text>
              <View style={[styles.sectionDot, { backgroundColor: isRecurring ? C.accent : C.textFaint }]} />
            </View>

            {/* Smart suggestion banner */}
            {showRecurringSuggestion && (
              <View style={styles.recurBanner}>
                <LinearGradient
                  colors={['rgba(59,130,246,0.10)', 'rgba(59,130,246,0.03)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />
                <Ionicons name="repeat-outline" size={15} color={C.accentLight} />
                <Text style={styles.recurBannerText}>
                  Ky shpenzim duket periodik. Dëshiron ta ruash si abonim?
                </Text>
                <TouchableOpacity
                  onPress={() => { setIsRecurring(true); setSuggestDismissed(true); }}
                  style={styles.recurBannerYes}
                  activeOpacity={0.75}
                >
                  <Text style={styles.recurBannerYesText}>Po</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSuggestDismissed(true)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <Ionicons name="close" size={14} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.detailsCard}>
              {/* Toggle row */}
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons
                    name="repeat-outline"
                    size={16}
                    color={isRecurring ? C.accentLight : C.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailInput, { paddingVertical: 0, fontSize: 15 }]}>
                    Shpenzim periodik
                  </Text>
                  {isRecurring && (
                    <Text style={{ fontSize: 11, color: C.accentLight, marginTop: 2 }}>
                      {recurringFrequency === 'weekly'
                        ? 'Çdo javë'
                        : recurringFrequency === 'monthly'
                        ? 'Çdo muaj'
                        : 'Çdo vit'}
                    </Text>
                  )}
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={(v) => { setIsRecurring(v); if (v) setSuggestDismissed(true); }}
                  trackColor={{ false: C.elevated, true: 'rgba(59,130,246,0.35)' }}
                  thumbColor={isRecurring ? C.accentLight : C.textMuted}
                  ios_backgroundColor={C.elevated}
                />
              </View>

              {/* Frequency selector */}
              {isRecurring && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={[styles.detailRow, { paddingVertical: 12 }]}>
                    <View style={styles.detailIconWrap}>
                      <Ionicons name="calendar-outline" size={16} color={C.accent} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                      {(['weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((freq) => (
                        <Pressable
                          key={freq}
                          onPress={() => setRecurringFrequency(freq)}
                          style={[
                            styles.freqChip,
                            recurringFrequency === freq && styles.freqChipActive,
                          ]}
                        >
                          {recurringFrequency === freq && (
                            <LinearGradient
                              colors={['rgba(59,130,246,0.18)', 'rgba(59,130,246,0.08)']}
                              style={StyleSheet.absoluteFill}
                            />
                          )}
                          <Text
                            style={[
                              styles.freqChipText,
                              recurringFrequency === freq && styles.freqChipTextActive,
                            ]}
                          >
                            {freq === 'weekly'
                              ? 'Javore'
                              : freq === 'monthly'
                              ? 'Mujore'
                              : 'Vjetore'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Submit ── */}
          <Animated.View style={[styles.submitWrap, { transform: [{ scale: submitScaleAnim }] }]}>
            <Pressable
              onPress={handleSubmit}
              onPressIn={() =>
                Animated.spring(submitScaleAnim, { toValue: 0.97, tension: 300, friction: 22, useNativeDriver: false }).start()
              }
              onPressOut={() =>
                Animated.spring(submitScaleAnim, { toValue: 1, tension: 200, friction: 16, useNativeDriver: false }).start()
              }
              disabled={loading || showSuccess}
              style={({ pressed }: any) => [styles.submitBtn, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <View style={styles.submitInner}>
                    <Ionicons name="hourglass-outline" size={18} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.submitText}>Duke ruajtur...</Text>
                  </View>
                ) : (
                  <View style={styles.submitInner}>
                    <Ionicons name="add-circle-outline" size={20} color={C.white} />
                    <Text style={styles.submitText}>Shto Shpenzimin</Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Scan Overlay ── */}
      {(scanStatus === 'scanning' || scanStatus === 'picking') && (
        <ScanOverlay status={scanStatus} progress={scanProgress} progressLabel={scanProgressLabel} />
      )}

      {/* ── Success / Sync-error Overlay ── */}
      {showSuccess && (
        <TouchableWithoutFeedback
          onPress={cloudSaveFailed ? handleDismissFailureOverlay : undefined}
        >
          <Animated.View style={[styles.successOverlay, { opacity: successAnim }]}>
            <Animated.View
              style={[
                styles.successCard,
                { transform: [{ scale: successScaleAnim }] },
                cloudSaveFailed && { borderColor: C.warningBorder },
              ]}
            >
              <LinearGradient
                colors={
                  cloudSaveFailed
                    ? [C.warningBg, 'transparent']
                    : [C.primaryBgStrong, C.primaryBg, 'transparent']
                }
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.successRing, cloudSaveFailed && { borderColor: C.warningBorder }]}>
                <LinearGradient
                  colors={cloudSaveFailed ? ['#F59E0B', '#D97706'] : (GRADIENTS.primaryShine as string[])}
                  style={styles.successIconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={cloudSaveFailed ? 'cloud-offline-outline' : 'checkmark'}
                    size={34}
                    color={C.white}
                  />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle}>
                {cloudSaveFailed ? 'Ruajtur lokalisht' : 'U ruajt!'}
              </Text>
              <Text style={styles.successSub}>
                {cloudSaveFailed
                  ? 'Nuk u sinkronizua me cloud.'
                  : `${selectedCurrency.symbol}${amount} · ${selectedCategory.name}`}
              </Text>
            </Animated.View>

            {/* ── DEV: Supabase error debug panel ── */}
            {cloudSaveFailed && cloudDebugError && (
              <View style={styles.debugPanel}>
                <Text style={styles.debugPanelLabel}>SUPABASE ERROR · DEV</Text>
                <Text style={styles.debugPanelText} selectable>{cloudDebugError}</Text>
              </View>
            )}
            {cloudSaveFailed && (
              <Text style={styles.debugDismissHint}>Tap anywhere to close</Text>
            )}
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}

// ── ScanSection ──────────────────────────────────────────────────────────────

interface ScanSectionProps {
  status: ScanStatus;
  result: ReceiptScanResult | null;
  onScan: (source: ScanSource) => void;
  onReset: () => void;
}

function ScanSection({ status, result, onScan, onReset }: ScanSectionProps) {
  // 'done' with detected fields → success; 'done' or 'error' without → warn
  const hasScanData = status === 'done' && result && countDetectedFields(result) > 0;
  const noData = (status === 'done' || status === 'error') && !hasScanData;

  if (hasScanData && result) {
    const p = result.parsed;
    const catInfo = CATEGORIES.find(c => c.id === p.category);
    const amountStr = p.detectedAmount && p.amount !== null
      ? (p.amount % 1 === 0
        ? `${Math.round(p.amount).toLocaleString('sq-AL')} ${p.currency}`
        : `${p.amount.toFixed(2)} ${p.currency}`)
      : null;

    return (
      <View style={[scanStyles.card, scanStyles.cardSuccess]}>
        {/* Header */}
        <View style={scanStyles.successHeader}>
          <View style={scanStyles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={18} color={C.primary} />
          </View>
          <Text style={[scanStyles.successTitle, { flex: 1 }]}>Fatura u lexua</Text>
          <TouchableOpacity
            onPress={onReset}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Structured preview: Dyqani / Totali / Artikujt / Kategoria */}
        <View style={scanStyles.previewGrid}>
          <View style={scanStyles.previewRow}>
            <Text style={scanStyles.previewLabel}>Dyqani</Text>
            <Text style={scanStyles.previewVal} numberOfLines={1}>
              {result.merchantName || '—'}
            </Text>
          </View>
          <View style={scanStyles.previewDivider} />
          <View style={scanStyles.previewRow}>
            <Text style={scanStyles.previewLabel}>Totali</Text>
            <Text style={[scanStyles.previewVal, amountStr ? scanStyles.previewValAmount : null]}>
              {amountStr || '—'}
            </Text>
          </View>
          <View style={scanStyles.previewDivider} />
          <View style={[scanStyles.previewRow, result.items.length > 0 && { alignItems: 'flex-start', paddingTop: 10 }]}>
            <Text style={[scanStyles.previewLabel, result.items.length > 0 && { paddingTop: 1 }]}>Artikujt</Text>
            {result.items.length > 0 ? (
              <Text style={scanStyles.previewVal} numberOfLines={3}>
                {result.items.slice(0, 5).map(i => i.toLowerCase()).join(', ')}
              </Text>
            ) : (
              <Text style={[scanStyles.previewVal, scanStyles.previewValMuted]}>
                Artikujt nuk u lexuan qartë
              </Text>
            )}
          </View>
          <View style={scanStyles.previewDivider} />
          <View style={scanStyles.previewRow}>
            <Text style={scanStyles.previewLabel}>Kategoria</Text>
            {catInfo && p.detectedCategory ? (
              <View style={[scanStyles.previewCatChip, { borderColor: catInfo.color + '55', backgroundColor: catInfo.bgColor }]}>
                <Ionicons name={catInfo.icon as any} size={11} color={catInfo.color} />
                <Text style={[scanStyles.previewCatChipText, { color: catInfo.color }]}>{catInfo.name}</Text>
              </View>
            ) : (
              <Text style={[scanStyles.previewVal, scanStyles.previewValMuted]}>—</Text>
            )}
          </View>
        </View>

        <View style={scanStyles.confirmBanner}>
          <Ionicons name="information-circle-outline" size={13} color={C.warning} />
          <Text style={scanStyles.confirmText}>
            {result.uncertainAmount
              ? 'Kontrollo shumën para ruajtjes'
              : 'Kontrollo të dhënat para ruajtjes'}
          </Text>
        </View>
      </View>
    );
  }

  if (noData) {
    const rawText = result?.rawText?.trim() ?? '';
    const hasRawText = rawText.length > 10;
    return (
      <View style={[scanStyles.card, scanStyles.cardWarn]}>
        <View style={scanStyles.noDataRow}>
          <Ionicons name="scan-outline" size={16} color={C.warning} />
          <View style={{ flex: 1 }}>
            <Text style={scanStyles.noDataTitle}>
              {hasRawText ? 'Nuk u gjet shuma' : 'Nuk u gjet tekst'}
            </Text>
            <Text style={scanStyles.noDataSub}>
              {hasRawText ? 'Kontrollo dhe plotëso manualisht' : 'Provo me imazh më të qartë'}
            </Text>
          </View>
          <TouchableOpacity
            style={scanStyles.retryBtn}
            onPress={() => Platform.OS === 'web' ? onScan('gallery') : onScan('camera')}
            activeOpacity={0.75}
          >
            <Text style={scanStyles.retryText}>Provo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReset}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>
        {hasRawText && (
          <View style={scanStyles.rawTextBox}>
            <Text style={scanStyles.rawTextLabel}>Tekst i zbuluar:</Text>
            <Text style={scanStyles.rawTextContent} numberOfLines={3}>{rawText.slice(0, 120)}</Text>
          </View>
        )}
      </View>
    );
  }

  // idle state — show scan triggers
  return (
    <View style={scanStyles.card}>
      <View style={scanStyles.idleHeader}>
        <View style={scanStyles.badge}>
          <Ionicons name="scan-outline" size={10} color={C.accentLight} />
          <Text style={scanStyles.badgeText}>SKANO FATURËN</Text>
        </View>
        <Text style={scanStyles.hint}>Ngarko imazhin e faturës</Text>
      </View>
      <View style={scanStyles.btnRow}>
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={scanStyles.scanBtn}
            onPress={() => onScan('camera')}
            activeOpacity={0.78}
          >
            <LinearGradient
              colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.06)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="camera-outline" size={18} color={C.accentLight} />
            <Text style={scanStyles.scanBtnText}>Kamera</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[scanStyles.scanBtn, Platform.OS === 'web' && { flex: 1 }]}
          onPress={() => onScan('gallery')}
          activeOpacity={0.78}
        >
          <LinearGradient
            colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.06)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons
            name={Platform.OS === 'web' ? 'cloud-upload-outline' : 'images-outline'}
            size={18}
            color={C.accentLight}
          />
          <Text style={scanStyles.scanBtnText}>
            {Platform.OS === 'web' ? 'Ngarko Imazh' : 'Galeria'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── ScanOverlay ───────────────────────────────────────────────────────────────

interface ScanOverlayProps {
  status: ScanStatus;
  progress: number;
  progressLabel: string;
}

function ScanOverlay({ status, progress, progressLabel }: ScanOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 700, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 700, useNativeDriver: false }),
      ])
    );
    const spin = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 2400, useNativeDriver: false })
    );
    pulse.start();
    spin.start();
    return () => { pulse.stop(); spin.stop(); };
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const label = status === 'picking' ? 'Duke hapur...' : (progressLabel || 'Duke skanuar faturën...');
  const pct = status === 'scanning' && progress > 0 ? `${progress}%` : '';

  return (
    <View style={scanStyles.overlay}>
      <View style={scanStyles.overlayCard}>
        <LinearGradient
          colors={['rgba(59,130,246,0.12)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[scanStyles.overlayIconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            style={scanStyles.overlayIconGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="scan-outline" size={32} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
        <Text style={scanStyles.overlayLabel}>{label}</Text>
        {status === 'scanning' && (
          <View style={scanStyles.progressWrap}>
            <View style={scanStyles.progressTrack}>
              <Animated.View style={[scanStyles.progressFill, { width: progressWidth }]} />
            </View>
            {pct.length > 0 && <Text style={scanStyles.progressPct}>{pct}</Text>}
          </View>
        )}
        {status !== 'scanning' && (
          <Text style={scanStyles.overlaySub}>Prisni pak…</Text>
        )}
      </View>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  // Scan section card
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    gap: 12,
    overflow: 'hidden',
  },
  cardSuccess: {
    borderColor: C.primaryBorder,
  },
  cardWarn: {
    borderColor: C.warningBorder,
  },

  // Idle
  idleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.accentBgSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 1.1,
  },
  hint: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accentLight,
  },

  // Success state
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.primaryBgSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.2,
  },
  successFields: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: C.warningBgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.warningBorder,
  },
  confirmText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.warning,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    backgroundColor: C.primaryBgSubtle,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },

  // Structured scan preview grid
  previewGrid: {
    backgroundColor: C.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  previewDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },
  previewLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  previewVal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
  },
  previewValAmount: {
    color: C.primary,
    fontWeight: '800',
  },
  previewValMuted: {
    color: C.textFaint,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  previewCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  previewCatChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // No-data / error state
  noDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noDataTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSub,
  },
  noDataSub: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.warningBgSubtle,
    borderWidth: 1,
    borderColor: C.warningBorder,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.warning,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,11,24,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  overlayCard: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 36,
    paddingHorizontal: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 18,
  },
  overlayIconWrap: {
    padding: 4,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: C.accentBorder,
  },
  overlayIconGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  overlaySub: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },

  // Progress bar (inside ScanOverlay)
  progressWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(59,130,246,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  progressPct: {
    fontSize: 12,
    color: C.accentLight,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Raw text box (in no-data state)
  rawTextBox: {
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 4,
  },
  rawTextLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rawTextContent: {
    fontSize: 12,
    color: C.textSub,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 17,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },

  content: { padding: 20, gap: 20 },

  // Amount Card
  amountCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
    gap: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 6,
  },
  sectionLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 64,
  },
  currSymbol: {
    fontSize: 34,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  amountInput: {
    flex: 1,
    fontSize: 52,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -2.5,
    padding: 0,
    margin: 0,
  },
  clearBtn: {
    padding: 4,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.elevated,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSub,
  },

  currTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  currTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  currTabSym: {
    fontSize: 16,
    fontWeight: '800',
    color: C.textMuted,
  },
  currTabCode: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
  },

  // Sections
  section: { gap: 10 },

  // Category grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    position: 'relative',
    minWidth: '46%',
    flex: 1,
    overflow: 'hidden',
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
    flex: 1,
  },
  catCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Details card
  detailsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  detailRowFocused: {
    backgroundColor: C.elevated,
  },
  detailIconWrap: {
    width: 24,
    alignItems: 'center',
  },
  detailInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 0,
  },
  charCount: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 14,
  },

  dateInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.elevated,
    overflow: 'hidden',
    position: 'relative',
  },
  dateChipActive: {
    borderColor: C.primaryBorder,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMuted,
  },
  dateChipTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: C.textSub,
    paddingVertical: 0,
    minWidth: 90,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 10,
  },
  fieldErrorText: {
    fontSize: 11,
    color: C.danger,
    fontWeight: '500',
    flex: 1,
  },

  // Submit button
  submitWrap: { marginTop: 4 },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  submitGradient: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.2,
  },

  // Amount error
  amountErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -10,
    paddingHorizontal: 4,
  },
  amountErrorText: {
    fontSize: 13,
    color: C.danger,
    fontWeight: '500',
    flex: 1,
  },

  // Success overlay
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlayStrong,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  successCard: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 40,
    paddingHorizontal: 52,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 20,
  },
  successRing: {
    padding: 4,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: C.primaryBorder,
    marginBottom: 4,
  },
  successIconGrad: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.6,
  },
  successSub: {
    fontSize: 15,
    color: C.textSub,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Quick natural-language input card
  quickCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.warningBorder,
    overflow: 'hidden',
    gap: 10,
  },
  quickCardFocused: {
    borderColor: C.warning,
    shadowColor: C.warning,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.warningBgSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.warningBorder,
  },
  quickBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.warning,
    letterSpacing: 1.2,
  },
  quickInput: {
    fontSize: 16,
    color: C.text,
    paddingVertical: 6,
    letterSpacing: -0.2,
  },
  quickInputFilled: {
    fontWeight: '600',
  },
  quickPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.elevated,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  quickPreviewChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSub,
  },
  quickNotePreview: {
    fontSize: 11,
    color: C.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  quickHint: {
    fontSize: 11,
    color: C.textFaint,
    lineHeight: 17,
  },

  // ── AI state styles ────────────────────────────────────────────────────────
  quickCardAI: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  quickCardLoading: {
    borderColor: C.accentBorder,
    opacity: 0.92,
  },
  quickBadgeAI: {
    backgroundColor: C.primaryBgSubtle,
    borderColor: C.primaryBorder,
  },
  quickBadgeTextAI: {
    color: C.primary,
  },
  quickHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: C.primaryBgSubtle,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  aiBtnSmallRetry: {
    backgroundColor: C.elevated,
    borderColor: C.border,
  },
  aiBtnSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 0.5,
  },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  aiLoadingText: {
    fontSize: 12,
    color: C.primaryLight,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  aiSourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  aiSourceChipSuccess: {
    backgroundColor: C.primaryBgSubtle,
    borderColor: C.primaryBorder,
  },
  aiSourceChipLocal: {
    backgroundColor: C.elevated,
    borderColor: C.border,
  },
  aiSourceChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  aiSourceChipTextSuccess: {
    color: C.primary,
  },
  aiSourceChipTextLocal: {
    color: C.textMuted,
  },

  // ── Voice input ────────────────────────────────────────────────────────────
  quickBadgeVoice: {
    backgroundColor: C.dangerBgSubtle,
    borderColor: C.dangerBorder,
  },
  quickBadgeTextVoice: {
    color: C.danger,
  },
  quickCardVoice: {
    borderColor: C.danger,
    shadowColor: C.danger,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  voiceBtnActive: {
    backgroundColor: C.dangerBgSubtle,
    borderColor: C.dangerBorder,
  },
  voiceErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: C.dangerBgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },
  voiceErrorText: {
    flex: 1,
    fontSize: 11,
    color: C.danger,
    fontWeight: '500',
    lineHeight: 15,
  },
  voiceRetryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },
  voiceRetryText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.danger,
    letterSpacing: 0.3,
  },

  // ── Recurring section ─────────────────────────────────────────────────────
  recurBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: C.card,
    overflow: 'hidden',
    marginBottom: 2,
  },
  recurBannerText: {
    flex: 1,
    fontSize: 12,
    color: C.accentLight,
    fontWeight: '500',
    lineHeight: 17,
  },
  recurBannerYes: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  recurBannerYesText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accentLight,
  },
  freqChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.elevated,
    overflow: 'hidden',
    position: 'relative',
  },
  freqChipActive: {
    borderColor: C.accentBorder,
  },
  freqChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
  },
  freqChipTextActive: {
    color: C.accentLight,
  },

  // ── Dev debug panel (shown on cloud save failure) ─────────────────────────
  debugPanel: {
    marginTop: 12,
    width: 320,
    maxWidth: '90%' as any,
    backgroundColor: '#0D1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF444466',
    padding: 12,
    gap: 6,
  },
  debugPanelLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#EF4444',
    letterSpacing: 1.2,
  },
  debugPanelText: {
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 17,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  debugDismissHint: {
    marginTop: 10,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },

  // ── Business mode tag ──────────────────────────────────────────────────────
  bizModeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.accentBgSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  bizModeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accentLight,
    letterSpacing: 1.1,
  },
});
