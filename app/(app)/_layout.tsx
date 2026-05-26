import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { NotificationProvider } from '@/lib/NotificationContext';

export default function AppLayout() {
  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="shto"
          options={{
            presentation: Platform.OS === 'web' ? 'card' : 'modal',
            animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="export"
          options={{
            presentation: Platform.OS === 'web' ? 'card' : 'modal',
            animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom',
          }}
        />
      </Stack>
    </NotificationProvider>
  );
}
