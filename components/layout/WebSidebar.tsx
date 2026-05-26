import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from '@/constants/colors';
import { useStore } from '@/lib/store';

interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Paneli', icon: 'home-outline', activeIcon: 'home' },
  { path: '/historia', label: 'Historia', icon: 'list-outline', activeIcon: 'list' },
  { path: '/buxheti', label: 'Buxheti', icon: 'wallet-outline', activeIcon: 'wallet' },
  { path: '/raporte', label: 'Raporte', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { path: '/qellimet', label: 'Qëllimet', icon: 'trophy-outline', activeIcon: 'trophy' },
  { path: '/cilesimet', label: 'Cilësimet', icon: 'settings-outline', activeIcon: 'settings' },
];

export function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useStore();

  const sidebarName = state.userName?.trim()
    ? state.userName.trim()
    : state.userEmail
    ? state.userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Valuta';
  const sidebarInitials = sidebarName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'V';

  return (
    <View style={styles.container}>
      {/* Top edge highlight */}
      <View style={styles.topEdge} />

      {/* Logo */}
      <View style={styles.logoSection}>
        <LinearGradient
          colors={GRADIENTS.emeraldBlue}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoGradient}
        >
          <Text style={styles.logoLetter}>V</Text>
        </LinearGradient>
        <View>
          <Text style={styles.logoText}>Valuta</Text>
          <Text style={styles.logoSub}>Financa personale</Text>
        </View>
      </View>

      {/* Nav label */}
      <Text style={styles.navLabel}>NAVIGIMI</Text>

      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path || (item.path === '/' && pathname === '');
          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as any)}
              style={({ pressed, hovered }: any) => [
                styles.navItem,
                isActive && styles.navItemActive,
                !isActive && hovered && styles.navItemHovered,
                pressed && styles.navItemPressed,
              ]}
            >
              {isActive && (
                <LinearGradient
                  colors={[C.primaryBgSubtle, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {isActive && <View style={styles.activeBar} />}
              <View style={[styles.navIcon, isActive && styles.navIconActive]}>
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={18}
                  color={isActive ? C.primary : C.textMuted}
                />
              </View>
              <Text style={[styles.navItemLabel, isActive && styles.navItemLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicatorDot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Add button */}
      <Pressable
        style={({ pressed, hovered }: any) => [
          styles.addButton,
          hovered && styles.addButtonHovered,
          pressed && { opacity: 0.88 },
        ]}
        onPress={() => router.push('/shto' as any)}
      >
        <LinearGradient
          colors={GRADIENTS.primaryShine}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.addButtonGradient}
        >
          <View style={styles.addButtonIcon}>
            <Ionicons name="add" size={16} color={C.white} />
          </View>
          <Text style={styles.addButtonText}>Shto Shpenzim</Text>
        </LinearGradient>
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerUser}>
          <View style={styles.footerAvatar}>
            <Text style={styles.footerAvatarText}>{sidebarInitials}</Text>
          </View>
          <View style={styles.footerInfo}>
            <Text style={styles.footerName} numberOfLines={1}>{sidebarName}</Text>
            <View style={styles.footerBadge}>
              <View style={[styles.footerBadgeDot, state.mode === 'business' && { backgroundColor: C.accentLight }]} />
              <Text style={[styles.footerBadgeText, state.mode === 'business' && { color: C.accentLight }]}>
                {state.mode === 'business' ? 'Biznes' : 'Personal'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 252,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingVertical: 24,
    paddingHorizontal: 14,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  logoGradient: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  logoLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  logoText: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.4,
  },
  logoSub: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textFaint,
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  nav: { flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  navItemActive: {
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  navItemHovered: {
    backgroundColor: C.elevated,
  },
  navItemPressed: {
    opacity: 0.75,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconActive: {
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textSub,
    flex: 1,
  },
  navItemLabelActive: {
    color: C.primary,
    fontWeight: '700',
  },
  activeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
    opacity: 0.85,
  },
  addButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonHovered: {
    shadowOpacity: 0.55,
    shadowRadius: 18,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  addButtonIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.1,
  },
  footer: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  footerAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.primary,
  },
  footerInfo: {
    flex: 1,
    gap: 3,
  },
  footerName: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSub,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.primary,
  },
  footerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.primary,
  },
});
