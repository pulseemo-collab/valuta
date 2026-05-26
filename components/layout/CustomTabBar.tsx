import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, GRADIENTS } from '@/constants/colors';

type TabName = 'index' | 'historia' | 'buxheti' | 'raporte' | 'qellimet' | 'cilesimet';

const TAB_CONFIG: Record<TabName, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Paneli', icon: 'home-outline', activeIcon: 'home' },
  historia: { label: 'Historia', icon: 'list-outline', activeIcon: 'list' },
  buxheti: { label: 'Buxheti', icon: 'wallet-outline', activeIcon: 'wallet' },
  raporte: { label: 'Raporte', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  qellimet: { label: 'Qëllimet', icon: 'trophy-outline', activeIcon: 'trophy' },
  cilesimet: { label: 'Cilësimet', icon: 'settings-outline', activeIcon: 'settings' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tabs = state.routes;
  const midIndex = Math.floor(tabs.length / 2);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 4 }]}>
      {/* Top border highlight */}
      <View style={styles.topHighlight} />
      <View style={styles.bar}>
        {tabs.map((route, index) => {
          const config = TAB_CONFIG[route.name as TabName];
          const isActive = state.index === index;

          if (index === midIndex) {
            return (
              <React.Fragment key="fab-group">
                <TouchableOpacity
                  style={styles.fabWrapper}
                  onPress={() => router.push('/shto' as any)}
                  activeOpacity={0.80}
                >
                  <View style={styles.fabGlow} />
                  <LinearGradient
                    colors={GRADIENTS.emeraldBlue}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fab}
                  >
                    <Ionicons name="add" size={26} color={C.white} />
                  </LinearGradient>
                </TouchableOpacity>
                <TabItem
                  config={config}
                  isActive={isActive}
                  onPress={() => navigation.navigate(route.name)}
                />
              </React.Fragment>
            );
          }

          return (
            <TabItem
              key={route.key}
              config={config}
              isActive={isActive}
              onPress={() => navigation.navigate(route.name)}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  config,
  isActive,
  onPress,
}: {
  config: { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap };
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.65}>
      <View style={[styles.tabIconWrap, isActive && styles.tabIconActive]}>
        <Ionicons
          name={isActive ? config.activeIcon : config.icon}
          size={20}
          color={isActive ? C.primary : C.textMuted}
        />
        {isActive && <View style={styles.activePill} />}
      </View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(11,17,32,0.97)',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 24,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 3,
    position: 'relative',
    minWidth: 0,
  },
  tabIconWrap: {
    width: 38,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tabIconActive: {
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  activePill: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.primary,
    marginLeft: -10,
  },
  tabLabel: {
    fontSize: 9,
    color: C.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: C.primary,
    fontWeight: '700',
  },
  fabWrapper: {
    marginBottom: 10,
    marginHorizontal: 6,
    position: 'relative',
  },
  fabGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 26,
    backgroundColor: C.primaryGlow,
    opacity: 0.28,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 12,
  },
});
