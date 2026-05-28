import React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/layout/CustomTabBar';
import { WebSidebar } from '@/components/layout/WebSidebar';
import { useNotifContext } from '@/lib/NotificationContext';
import { NotificationBanner } from '@/components/ui/NotificationBanner';
import { useThemeColors } from '@/lib/ThemeContext';
import { useTranslation } from '@/lib/i18n';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const { currentBanner, dismissBanner } = useNotifContext();
  const C = useThemeColors();
  const { t } = useTranslation();

  const tabs = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={isDesktopWeb ? () => null : (props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t('navHome') }} />
      <Tabs.Screen name="historia" options={{ title: t('navHistory') }} />
      <Tabs.Screen name="buxheti" options={{ title: t('navBudget') }} />
      <Tabs.Screen name="raporte" options={{ title: t('navReports') }} />
      <Tabs.Screen name="qellimet" options={{ title: t('navGoals') }} />
      <Tabs.Screen name="cilesimet" options={{ title: t('navSettings') }} />
    </Tabs>
  );

  const content = isDesktopWeb ? (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      <WebSidebar />
      <View style={{ flex: 1, overflow: 'hidden' }}>{tabs}</View>
    </View>
  ) : tabs;

  return (
    <View style={{ flex: 1 }}>
      {content}
      <NotificationBanner notification={currentBanner} onDismiss={dismissBanner} />
    </View>
  );
}
