import React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/components/layout/CustomTabBar';
import { WebSidebar } from '@/components/layout/WebSidebar';
import { C } from '@/constants/colors';
import { useNotifContext } from '@/lib/NotificationContext';
import { NotificationBanner } from '@/components/ui/NotificationBanner';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const { currentBanner, dismissBanner } = useNotifContext();

  const tabs = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={isDesktopWeb ? () => null : (props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Paneli' }} />
      <Tabs.Screen name="historia" options={{ title: 'Historia' }} />
      <Tabs.Screen name="buxheti" options={{ title: 'Buxheti' }} />
      <Tabs.Screen name="raporte" options={{ title: 'Raporte' }} />
      <Tabs.Screen name="qellimet" options={{ title: 'Qëllimet' }} />
      <Tabs.Screen name="cilesimet" options={{ title: 'Cilësimet' }} />
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
