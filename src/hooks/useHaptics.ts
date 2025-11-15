import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

/**
 * Cross-platform haptics hook.
 * On native (iOS/Android) uses expo-haptics.
 * On web attempts navigator.vibrate() when available, otherwise no-op.
 * Provides graceful degradation so production web still gives subtle feedback.
 */
export function useHaptics(disabled?: boolean) {
  const canVibrateWeb = useMemo(() => {
    if (disabled) return false;
    if (Platform.OS !== 'web') return false;
    return typeof navigator !== 'undefined' && !!navigator.vibrate;
  }, [disabled]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (disabled) return;
    if (canVibrateWeb) {
      try { navigator.vibrate(pattern); } catch {}
    }
  }, [canVibrateWeb, disabled]);

  const selection = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'web') vibrate(8);
    else Haptics.selectionAsync().catch(() => {});
  }, [vibrate, disabled]);

  const light = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'web') vibrate(12);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [vibrate, disabled]);

  const medium = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'web') vibrate(24);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [vibrate, disabled]);

  const heavy = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'web') vibrate([32, 40]); // slightly longer pulse
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [vibrate, disabled]);

  const doubleHeavy = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'web') vibrate([28, 40, 28]);
    else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 110);
    }
  }, [vibrate, disabled]);

  return {
    selection,
    light,
    medium,
    heavy,
    doubleHeavy,
  } as const;
}

export type HapticsAPI = ReturnType<typeof useHaptics>;
