// app/_layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

export default function RootLayout() {
  // Ensure web root/background fills viewport and uses the canonical dark green
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const color = '#0B3A26';
      const html = document.documentElement as HTMLElement;
      const body = document.body as HTMLElement;
      html.style.backgroundColor = color;
      html.style.height = '100%';
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.minHeight = '100%';
      body.style.backgroundColor = color;
      const root = (document.getElementById('root') ||
        document.getElementById('__next') ||
        (document.querySelector('.expo-root') as HTMLElement | null));
      if (root) {
        root.style.minHeight = '100%';
        root.style.backgroundColor = color;
      }
    } catch {}
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0B3A26' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0B3A26' },
        }}
      />
      {Platform.OS === 'web' && <Analytics />}
    </>
  );
}
