import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SectionList,
  Animated,
  PanResponder,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { TransactionItem } from '@/components/dashboard/TransactionItem';
import { SyncingBanner } from '@/components/ui/SyncingBanner';
import { ListSkeleton } from '@/components/ui/SkeletonLoader';
import { CATEGORIES } from '@/constants/categories';
import { BUSINESS_CATEGORIES } from '@/constants/businessCategories';
import { CURRENCIES } from '@/constants/currencies';
import { groupByDate, formatCurrency, getTotalALL } from '@/lib/utils';
import { detectRecurring, getExpenseKey } from '@/lib/detectRecurring';
import { C, GRADIENTS } from '@/constants/colors';
import type { Expense, CategoryId, Currency, AppMode } from '@/types';

type ModeFilter = 'all' | 'personal' | 'business';

const ALL_CATEGORIES = 'te-gjitha';
const ALL_CURRENCIES = 'TE_GJITHA';
const SWIPE_THRESHOLD = 80;

type ExpenseSection = {
  title: string;
  isToday: boolean;
  total: number;
  txCount: number;
  data: Expense[];
};

function formatGroupDate(key: string): string {
  const date = new Date(key);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Sot';
  if (date.toDateString() === yesterday.toDateString()) return 'Dje';
  return date.toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isDateToday(key: string): boolean {
  return new Date(key).toDateString() === new Date().toDateString();
}

// ── Swipeable delete row (also owns card boundary styling) ────────────────────
function SwipeRow({
  onDelete,
  isFirst,
  isLast,
  children,
}: {
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const isWeb = Platform.OS === 'web';
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const [webHovered, setWebHovered] = useState(false);

  const snapClose = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      tension: 180,
      friction: 18,
      useNativeDriver: true,
    }).start();
    isOpen.current = false;
  }, []);

  const snapOpen = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -SWIPE_THRESHOLD,
      tension: 180,
      friction: 18,
      useNativeDriver: true,
    }).start();
    isOpen.current = true;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -SWIPE_THRESHOLD : 0;
        const clamped = Math.min(0, Math.max(-SWIPE_THRESHOLD - 16, base + g.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current ? -SWIPE_THRESHOLD : 0;
        if (base + g.dx < -SWIPE_THRESHOLD / 2) {
          snapOpen();
        } else {
          snapClose();
        }
      },
    })
  ).current;

  const cardStyle = [
    styles.swipeCard,
    isFirst && styles.swipeCardFirst,
    isLast && styles.swipeCardLast,
  ];

  if (isWeb) {
    return (
      <View
        style={[...cardStyle, styles.swipeWebWrap]}
        // @ts-ignore — web-only mouse events
        onMouseEnter={() => setWebHovered(true)}
        onMouseLeave={() => setWebHovered(false)}
      >
        {children}
        {webHovered && (
          <TouchableOpacity
            style={styles.swipeWebDeleteBtn}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[...cardStyle, styles.swipeOuter]}>
      {/* Delete zone sits at the right edge of the card */}
      <TouchableOpacity
        style={[
          styles.swipeDeleteZone,
          isFirst && styles.swipeDeleteFirst,
          isLast && styles.swipeDeleteLast,
        ]}
        onPress={() => { snapClose(); setTimeout(onDelete, 80); }}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={18} color={C.white} />
        <Text style={styles.swipeDeleteLabel}>Fshi</Text>
      </TouchableOpacity>

      {/* Swipeable content — bg matches card so it covers the delete zone until revealed */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeContent, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Historia() {
  const { state, deleteExpense } = useStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const isBizMode = state.mode === 'business';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [activeCurrency, setActiveCurrency] = useState<string>(ALL_CURRENCIES);
  const [activeModeFilter, setActiveModeFilter] = useState<ModeFilter>(isBizMode ? 'business' : 'all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync mode filter when app mode changes
  useEffect(() => {
    setActiveModeFilter(state.mode === 'business' ? 'business' : 'all');
  }, [state.mode]);

  const listOpacity = useRef(new Animated.Value(1)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const prevFilterKey = useRef('');

  // ── Filtered + grouped data ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return state.expenses.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        e.note.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q);
      const matchCat = activeCategory === ALL_CATEGORIES || e.category === activeCategory;
      const matchCur = activeCurrency === ALL_CURRENCIES || e.currency === activeCurrency;
      const matchMode =
        activeModeFilter === 'all' ||
        (activeModeFilter === 'business' ? e.mode === 'business' : e.mode !== 'business');
      return matchSearch && matchCat && matchCur && matchMode;
    });
  }, [state.expenses, search, activeCategory, activeCurrency, activeModeFilter]);

  const sections = useMemo((): ExpenseSection[] => {
    const grouped = groupByDate(filtered);
    return Object.entries(grouped).map(([dateKey, expenses]) => ({
      title: formatGroupDate(dateKey),
      isToday: isDateToday(dateKey),
      total: getTotalALL(expenses),
      txCount: expenses.length,
      data: expenses,
    }));
  }, [filtered]);

  // Recurring key set — computed once from full expense list (not filtered)
  const recurringKeySet = useMemo(() => {
    const patterns = detectRecurring(state.expenses);
    return new Set(patterns.map((p) => p.key));
  }, [state.expenses]);

  const totalFiltered = getTotalALL(filtered);

  const activeFilterCount =
    (activeCategory !== ALL_CATEGORIES ? 1 : 0) +
    (activeCurrency !== ALL_CURRENCIES ? 1 : 0) +
    (activeModeFilter !== 'all' ? 1 : 0) +
    (search.length > 0 ? 1 : 0);

  // ── Fade list on filter change ────────────────────────────────────────────
  useEffect(() => {
    const key = `${search}|${activeCategory}|${activeCurrency}|${activeModeFilter}`;
    if (prevFilterKey.current === key) return;
    prevFilterKey.current = key;
    Animated.sequence([
      Animated.timing(listOpacity, { toValue: 0.42, duration: 90, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
    ]).start();
  }, [search, activeCategory, activeCurrency, activeModeFilter]);

  // ── Filter panel toggle ───────────────────────────────────────────────────
  const toggleFilters = useCallback(() => {
    setFiltersOpen((prev) => {
      const next = !prev;
      Animated.spring(filterAnim, {
        toValue: next ? 1 : 0,
        tension: 140,
        friction: 17,
        useNativeDriver: false,
      }).start();
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveCategory(ALL_CATEGORIES);
    setActiveCurrency(ALL_CURRENCIES);
    setActiveModeFilter('all');
    setSearch('');
  }, []);

  const handleDelete = useCallback(
    (id: string) => { deleteExpense(id); },
    [deleteExpense]
  );

  const filterPanelHeight = filterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 178],
  });
  const filterPanelOpacity = filterAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });

  // ── Section header ────────────────────────────────────────────────────────
  const renderSectionHeader = useCallback(
    ({ section }: { section: ExpenseSection }) => (
      <View style={[styles.sectionHeaderOuter, { backgroundColor: C.bg }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionDot, section.isToday && styles.sectionDotToday]} />
            <Text style={[styles.sectionDate, section.isToday && styles.sectionDateToday]}>
              {section.title}
            </Text>
            <View style={styles.sectionTxBadge}>
              <Text style={styles.sectionTxText}>{section.txCount}</Text>
            </View>
          </View>
          <View style={styles.sectionTotalPill}>
            <Text style={styles.sectionTotalText}>
              {formatCurrency(Math.round(section.total), 'ALL')}
            </Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  // ── Item renderer ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index, section }: { item: Expense; index: number; section: ExpenseSection }) => {
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;
      const key = getExpenseKey(item);
      return (
        <SwipeRow
          onDelete={() => handleDelete(item.id)}
          isFirst={isFirst}
          isLast={isLast}
        >
          <TransactionItem
            expense={item}
            isRecurring={key !== '' && recurringKeySet.has(key)}
          />
          {!isLast && <View style={styles.itemSeparator} />}
        </SwipeRow>
      );
    },
    [handleDelete, recurringKeySet]
  );

  const keyExtractor = useCallback((item: Expense) => item.id, []);

  // ── List header (search + filters + stats) ────────────────────────────────
  const listHeaderComponent = (
    <View>
      <SyncingBanner style={{ marginBottom: 10 }} />

      {/* Search + filter toggle */}
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused, isDesktop && styles.searchWrapDesktop]}>
          <Ionicons
            name="search-outline"
            size={17}
            color={searchFocused ? C.primary : C.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Kërko shpenzimet..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={17} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            filtersOpen && styles.filterToggleBtnActive,
            activeFilterCount > 0 && !filtersOpen && styles.filterToggleBtnBadged,
          ]}
          onPress={toggleFilters}
          activeOpacity={0.75}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? C.primary : filtersOpen ? C.primaryLight : C.textMuted}
          />
          {activeFilterCount > 0 && !filtersOpen && (
            <View style={styles.filterBadgeDot}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.activeFilterPills}
          >
            {search.length > 0 && (
              <View style={styles.activePill}>
                <Ionicons name="search-outline" size={10} color={C.primary} />
                <Text style={styles.activePillText} numberOfLines={1}>{search}</Text>
              </View>
            )}
            {activeModeFilter !== 'all' && (
              <View style={[styles.activePill, activeModeFilter === 'business' && { borderColor: C.accentBorder }]}>
                <Ionicons
                  name={activeModeFilter === 'business' ? 'briefcase-outline' : 'person-outline'}
                  size={10}
                  color={activeModeFilter === 'business' ? C.accentLight : C.primary}
                />
                <Text style={[styles.activePillText, activeModeFilter === 'business' && { color: C.accentLight }]}>
                  {activeModeFilter === 'business' ? 'Biznes' : 'Personal'}
                </Text>
              </View>
            )}
            {activeCategory !== ALL_CATEGORIES && (() => {
              const cat = [...CATEGORIES, ...BUSINESS_CATEGORIES].find((c) => c.id === activeCategory);
              return cat ? (
                <View style={[styles.activePill, { borderColor: cat.color + '40' }]}>
                  <Ionicons name={cat.icon as any} size={10} color={cat.color} />
                  <Text style={[styles.activePillText, { color: cat.color }]}>{cat.name}</Text>
                </View>
              ) : null;
            })()}
            {activeCurrency !== ALL_CURRENCIES && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{activeCurrency}</Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity onPress={clearFilters} style={styles.clearAllBtn} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={13} color={C.textMuted} />
            <Text style={styles.clearAllText}>Pastro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Expandable filter panel */}
      <Animated.View
        style={[
          styles.filterPanel,
          { height: filterPanelHeight, opacity: filterPanelOpacity },
        ]}
      >
        <View style={styles.filterPanelInner}>
          {/* Mode filter toggle */}
          <View style={styles.modeToggleRow}>
            {([
              { key: 'all', label: 'Të gjitha', icon: 'apps-outline' },
              { key: 'personal', label: 'Personal', icon: 'person-outline' },
              { key: 'business', label: 'Biznes', icon: 'briefcase-outline' },
            ] as { key: ModeFilter; label: string; icon: string }[]).map((opt) => {
              const isActive = activeModeFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.modeToggleBtn,
                    isActive && (opt.key === 'business' ? styles.modeToggleBtnBiz : styles.modeToggleBtnActive),
                  ]}
                  onPress={() => setActiveModeFilter(opt.key)}
                  activeOpacity={0.72}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={12}
                    color={isActive
                      ? (opt.key === 'business' ? C.accentLight : C.primary)
                      : C.textMuted}
                  />
                  <Text style={[
                    styles.modeToggleText,
                    isActive && (opt.key === 'business' ? styles.modeToggleTextBiz : styles.modeToggleTextActive),
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <TouchableOpacity
              style={[styles.chip, activeCategory === ALL_CATEGORIES && styles.chipActive]}
              onPress={() => setActiveCategory(ALL_CATEGORIES)}
              activeOpacity={0.72}
            >
              <Text style={[styles.chipText, activeCategory === ALL_CATEGORIES && styles.chipTextActive]}>
                Të gjitha
              </Text>
            </TouchableOpacity>
            {[...CATEGORIES, ...BUSINESS_CATEGORIES].map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    isActive && { backgroundColor: cat.bgColor, borderColor: cat.color + '50' },
                  ]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.72}
                >
                  <Ionicons name={cat.icon as any} size={12} color={isActive ? cat.color : C.textMuted} />
                  <Text style={[styles.chipText, isActive && { color: cat.color, fontWeight: '700' }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Currency chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {[{ code: ALL_CURRENCIES, name: 'Të gjitha' }, ...CURRENCIES].map((c) => {
              const isActive = activeCurrency === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.chip, styles.chipSm, isActive && styles.chipActive]}
                  onPress={() => setActiveCurrency(c.code)}
                  activeOpacity={0.72}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {c.code === ALL_CURRENCIES ? 'Të gjitha' : c.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Result summary bar */}
      {filtered.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryCount}>
            {filtered.length} {filtered.length === 1 ? 'transaksion' : 'transaksione'}
          </Text>
          <Text style={styles.summaryTotal}>
            {formatCurrency(Math.round(totalFiltered), 'ALL')}
          </Text>
        </View>
      )}
    </View>
  );

  const isNewUser = !state.syncing && state.expenses.length === 0;
  const isLoadingSkeleton = state.syncing && state.expenses.length === 0;

  // ── Empty / loading states ────────────────────────────────────────────────
  if (isLoadingSkeleton) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.screenHeader}>
          <Text style={styles.title}>Historia</Text>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <ListSkeleton rows={6} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.title}>Historia</Text>
        <View style={styles.headerBadge}>
          <View style={styles.headerBadgeDot} />
          <Text style={styles.headerBadgeText}>
            {state.expenses.length} {state.expenses.length === 1 ? 'hyrje' : 'hyrje'}
          </Text>
        </View>
      </View>

      {isNewUser ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state */}
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={isBizMode ? ['rgba(59,130,246,0.18)', 'rgba(59,130,246,0.05)'] : ['rgba(16,185,129,0.16)', 'rgba(16,185,129,0.05)']}
              style={[styles.emptyIconWrap, isBizMode && { borderColor: C.accentBorder }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={isBizMode ? 'briefcase-outline' : 'receipt-outline'} size={28} color={isBizMode ? C.accentLight : C.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {isBizMode ? 'Asnjë shpenzim biznesi ende' : 'Asnjë shpenzim ende'}
            </Text>
            <Text style={styles.emptySub}>
              {isBizMode
                ? 'Regjistro shpenzimet e biznesit tënd\ndhe fillo të gjurmosh kostot.'
                : 'Shto shpenzimin e parë dhe fillo\ntë gjurmosh financat tua.'}
            </Text>
            <View style={styles.emptyFeatures}>
              {(isBizMode ? [
                { icon: 'cube-outline', text: 'Gjurmo furnitorë dhe inventar' },
                { icon: 'business-outline', text: 'Ndaj kostot operative' },
                { icon: 'calculator-outline', text: 'Mbaj shënime për taksa e shërbime' },
              ] : [
                { icon: 'filter-outline', text: 'Filtro sipas kategorisë dhe monedhës' },
                { icon: 'calendar-outline', text: 'Shiko historinë sipas datës' },
                { icon: 'search-outline', text: 'Kërko çdo transaksion lehtësisht' },
              ] as const).map((f) => (
                <View key={f.icon} style={styles.emptyFeatureRow}>
                  <View style={[styles.emptyFeatureIcon, isBizMode && { backgroundColor: C.accentBgSubtle, borderColor: C.accentBorder }]}>
                    <Ionicons name={f.icon as any} size={13} color={isBizMode ? C.accentLight : C.primary} />
                  </View>
                  <Text style={styles.emptyFeatureText}>{f.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => router.push('/shto' as any)}
              activeOpacity={0.78}
            >
              <LinearGradient
                colors={GRADIENTS.primaryShine}
                style={styles.emptyActionGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add" size={16} color={C.white} />
                <Text style={styles.emptyActionText}>Shto shpenzimin e parë</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          <SectionList<Expense, ExpenseSection>
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              isDesktop && styles.listContentDesktop,
            ]}
            ListHeaderComponent={listHeaderComponent}
            ListHeaderComponentStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
            ListEmptyComponent={
              <View style={styles.filterEmptyWrap}>
                <LinearGradient
                  colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.04)']}
                  style={styles.filterEmptyIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="search-outline" size={26} color={C.accentLight} />
                </LinearGradient>
                <Text style={styles.filterEmptyTitle}>Nuk u gjet asgjë</Text>
                <Text style={styles.filterEmptySub}>Provo të ndryshosh filtrat</Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={clearFilters} style={styles.filterEmptyClear} activeOpacity={0.75}>
                    <Text style={styles.filterEmptyClearText}>Pastro filtrat</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListFooterComponent={<View style={{ height: 110 }} />}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Screen header ─────────────────────────────────────────
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.7 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: C.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.primary,
  },
  headerBadgeText: { fontSize: 12, color: C.textSub, fontWeight: '600' },

  // ── Search + filter controls ──────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.elevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    height: 46,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  searchWrapFocused: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  searchWrapDesktop: { height: 48 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  filterToggleBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    position: 'relative',
  },
  filterToggleBtnActive: {
    borderColor: C.primaryBorder,
    backgroundColor: C.primaryBg,
  },
  filterToggleBtnBadged: {
    borderColor: C.primaryBorder,
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: { fontSize: 8, fontWeight: '800', color: C.white },

  // ── Active filter pills ───────────────────────────────────
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activeFilterPills: { gap: 6, paddingRight: 4 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: C.primaryBgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  activePillText: { fontSize: 11, color: C.primary, fontWeight: '600' },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  clearAllText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },

  // ── Expandable filter panel ───────────────────────────────
  filterPanel: {
    overflow: 'hidden',
  },
  filterPanelInner: {
    gap: 8,
    paddingBottom: 10,
  },
  chipRow: { gap: 7, paddingRight: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.elevated,
  },
  chipSm: { paddingVertical: 6, paddingHorizontal: 10 },
  chipActive: { borderColor: C.primaryBorder, backgroundColor: C.primaryBg },
  chipText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  chipTextActive: { color: C.primary, fontWeight: '700' },

  // ── Mode filter toggle ─────────────────────────────────────
  modeToggleRow: {
    flexDirection: 'row',
    gap: 7,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.elevated,
  },
  modeToggleBtnActive: {
    borderColor: C.primaryBorder,
    backgroundColor: C.primaryBg,
  },
  modeToggleBtnBiz: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentBgSubtle,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  modeToggleTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  modeToggleTextBiz: {
    color: C.accentLight,
    fontWeight: '700',
  },

  // ── Summary bar ───────────────────────────────────────────
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 6,
  },
  summaryCount: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  summaryTotal: { fontSize: 14, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  // ── Section headers ───────────────────────────────────────
  sectionHeaderOuter: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.textFaint,
  },
  sectionDotToday: { backgroundColor: C.primary },
  sectionDate: { fontSize: 13, fontWeight: '700', color: C.textMuted, letterSpacing: -0.1 },
  sectionDateToday: { color: C.text, fontSize: 14 },
  sectionTxBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.elevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTxText: { fontSize: 10, fontWeight: '700', color: C.textMuted },
  sectionTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTotalText: { fontSize: 12, fontWeight: '800', color: C.text },

  // ── List content ──────────────────────────────────────────
  listContent: { paddingBottom: 20 },
  listContentDesktop: { maxWidth: 740, alignSelf: 'center' as any, width: '100%' as any },

  // ── Swipeable card (owns border + radius + margin) ───────
  swipeCard: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  swipeCardFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  swipeCardLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  // ── Swipe-to-delete (native) ──────────────────────────────
  swipeOuter: {
    position: 'relative',
  },
  swipeDeleteZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_THRESHOLD,
    backgroundColor: C.danger,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteFirst: {
    borderTopRightRadius: 15,
  },
  swipeDeleteLast: {
    borderBottomRightRadius: 15,
  },
  swipeDeleteLabel: { fontSize: 11, fontWeight: '700', color: C.white },
  swipeContent: { backgroundColor: C.card },

  // ── Item separator ────────────────────────────────────────
  itemSeparator: {
    height: 1,
    backgroundColor: C.border,
    opacity: 0.7,
  },

  // ── Swipe delete (web hover) ──────────────────────────────
  swipeWebWrap: {
    position: 'relative',
  },
  swipeWebDeleteBtn: {
    position: 'absolute',
    right: 14,
    top: '50%' as any,
    marginTop: -16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: C.dangerBgSubtle,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },

  // ── Empty states ──────────────────────────────────────────
  emptyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textSub },
  emptySub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyFeatures: { gap: 9, width: '100%', paddingHorizontal: 4, marginVertical: 6 },
  emptyFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyFeatureIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: C.primaryBgSubtle,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emptyFeatureText: { fontSize: 13, color: C.textSub, fontWeight: '500', flex: 1 },
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
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyActionText: { fontSize: 14, fontWeight: '700', color: C.white },

  filterEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
    gap: 10,
  },
  filterEmptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.accentBorder,
    marginBottom: 4,
  },
  filterEmptyTitle: { fontSize: 16, fontWeight: '700', color: C.textSub },
  filterEmptySub: { fontSize: 13, color: C.textMuted, textAlign: 'center' as any },
  filterEmptyClear: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterEmptyClearText: { fontSize: 13, color: C.textSub, fontWeight: '600' },
});
