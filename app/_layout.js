import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider } from '../contexts/ThemeContext';
import { BackHandler } from 'react-native';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const onBackPress = () => {
      // Prevent back navigation on sign-in page
      const currentPath = router.asPath || router.pathname || '';
      if (currentPath.includes('/signin') || currentPath === '/signin') {
        return false; // Let OS handle (exit app)
      }
      if (router.canGoBack?.()) {
        router.back();
        return true;
      }
      return false; // Let the OS handle it (exit app)
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
} 