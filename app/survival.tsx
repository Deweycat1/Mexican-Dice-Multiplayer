import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import BluffModal from '../src/components/BluffModal';
import Dice from '../src/components/Dice';
import FeltBackground from '../src/components/FeltBackground';
import FireworksOverlay from '../src/components/FireworksOverlay';
import StyledButton from '../src/components/StyledButton';
import { isAlwaysClaimable, meetsOrBeats, splitClaim } from '../src/engine/mexican';
import { buildClaimOptions } from '../src/lib/claimOptions';
import { useGameStore } from '../src/state/useGameStore';

function formatClaim(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (value === 21) return '21 (Mexican 🌮)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return `${hi}${lo}`;
}
function formatRoll(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const [hi, lo] = splitClaim(value);
  return `${hi}${lo}`;
}
function facesFromRoll(value: number | null | undefined): readonly [number | null, number | null] {
  if (typeof value !== 'number' || Number.isNaN(value)) return [null, null] as const;
  const [hi, lo] = splitClaim(value);
  return [hi, lo] as const;
}

export default function Survival() {
  const router = useRouter();
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [rollingAnim, setRollingAnim] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const {
    // survival controls
    lastClaim,
    turn,
    lastPlayerRoll,
    lastCpuRoll,
    isRolling,
    isBusy,
    turnLock,
    playerRoll,
    playerClaim,
    callBluff,
    buildBanner,
    message,
    survivalClaims,
    gameOver,
    mustBluff,
    mexicanFlashNonce,
    // survival controls
    startSurvival,
    restartSurvival,
    stopSurvival,
    currentStreak,
    bestStreak,
    globalBest,
    isSurvivalOver,
  } = useGameStore();

  // pulsing animation for the caption/title to add adrenaline
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // helpers
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };
  const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

  // compute dynamic parameters from streak
  const normalized = clamp(currentStreak / 20, 0, 1); // 0..1 over first 20 streaks
  const amplitude = 1 + clamp(0.06 + currentStreak * 0.008, 0.06, 0.20); // scale
  const periodMs = Math.round(clamp(840 - currentStreak * 18, 480, 840)); // faster with streak

  // color shift: from green (#E6FFE6) to red (#FF6B6B) based on normalized streak
  const startCol = hexToRgb('#E6FFE6');
  const endCol = hexToRgb('#FF6B6B');
  const interp = (i: number) => Math.round(lerp(startCol[i], endCol[i], normalized));
  const dynamicScoreColor = rgbToHex(interp(0), interp(1), interp(2));

  // ensure we can restart animation & haptics when streak changes
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hapticTimerRef = useRef<number | null>(null);

  // subtle flash on streak increment
  const streakFlashAnim = useRef(new Animated.Value(1)).current;
  const prevStreakRef = useRef(currentStreak);

  useEffect(() => {
    // if streak increased, trigger a subtle brightening flash
    if (currentStreak > prevStreakRef.current) {
      streakFlashAnim.setValue(0.5);
      Animated.timing(streakFlashAnim, {
        toValue: 1.0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak, streakFlashAnim]);

  useEffect(() => {
    // clear previous animation
    if (animLoopRef.current) {
      try { (animLoopRef.current as any).stop(); } catch {}
      animLoopRef.current = null;
    }

    const half = Math.round(periodMs / 2);
    const seq = Animated.sequence([
      Animated.timing(pulseAnim, { toValue: amplitude, duration: half, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: half, useNativeDriver: true }),
    ]);
    const loop = Animated.loop(seq);
    animLoopRef.current = loop;
    loop.start();

    return () => {
      if (animLoopRef.current) {
        try { (animLoopRef.current as any).stop(); } catch {}
        animLoopRef.current = null;
      }
    };
  }, [pulseAnim, amplitude, periodMs]);

  // haptics scaling and pattern
  useEffect(() => {
    // clear existing timer
    if (hapticTimerRef.current) {
      clearInterval(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }

    const intervalMs = periodMs;

    const fireHaptic = () => {
      if (isSurvivalOver) return;
      try {
        if (currentStreak >= 20) {
          // strong double pulse
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 100);
        } else if (currentStreak >= 15) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        } else if (currentStreak >= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } catch {}
    };

    // start interval
    const id = setInterval(fireHaptic, intervalMs);
    hapticTimerRef.current = id as unknown as number;

    // fire immediately once to match visual feel
    fireHaptic();

    return () => {
      if (hapticTimerRef.current) {
        clearInterval(hapticTimerRef.current);
        hapticTimerRef.current = null;
      }
    };
  }, [periodMs, currentStreak, isSurvivalOver]);

  useEffect(() => {
    // start a run when this screen mounts
    startSurvival();
    return () => {
      // ensure we leave survival mode when the screen unmounts
      stopSurvival();
    };
  }, [startSurvival, stopSurvival]);

  const narration = (buildBanner?.() || message || '').trim();
  const lastClaimValue = lastClaim ?? null;

  const claimText = useMemo(() => {
    const claimPart = formatClaim(lastClaimValue);
    const rollPart = formatRoll(lastPlayerRoll);
    return `Current claim: ${claimPart} | Your roll: ${rollPart}`;
  }, [lastClaimValue, lastPlayerRoll]);

  const [playerHi, playerLo] = facesFromRoll(lastPlayerRoll);
  const [cpuHi, cpuLo] = facesFromRoll(lastCpuRoll);
  const rolling = rollingAnim || isRolling;

  const isGameOver = gameOver !== null;
  const controlsDisabled = isGameOver || turn !== 'player' || isBusy || turnLock || isSurvivalOver;
  const showCpuThinking = turn !== 'player' && !isGameOver;
  const hasRolled = turn === 'player' && lastPlayerRoll !== null;
  const rolledValue = hasRolled ? lastPlayerRoll : null;
  const rolledCanClaim =
    hasRolled &&
    rolledValue !== null &&
    (lastClaimValue == null || meetsOrBeats(rolledValue, lastClaimValue) || isAlwaysClaimable(rolledValue));

  const isRivalClaimPhase = useMemo(() => {
    if (isGameOver) return false;
    if (turn !== 'player') return false;
    if (lastClaim == null) return false;
    return lastPlayerRoll == null;
  }, [isGameOver, turn, lastClaim, lastPlayerRoll]);

  const diceDisplayMode = useMemo(() => {
    if (isRivalClaimPhase) {
      return 'question';
    }
    if (turn === 'player') {
      return lastPlayerRoll == null ? 'prompt' : 'values';
    }
    return 'values';
  }, [isRivalClaimPhase, turn, lastPlayerRoll]);

  const claimOptions = useMemo(() => buildClaimOptions(lastClaimValue, lastPlayerRoll), [lastClaimValue, lastPlayerRoll]);

  useEffect(() => setClaimPickerOpen(false), [turn]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [survivalClaims, fadeAnim]);

  useEffect(() => {
    if (!mexicanFlashNonce) return;
    setShowFireworks(true);
  }, [mexicanFlashNonce]);

  function handleRollOrClaim() {
    if (controlsDisabled) return;

    if (hasRolled && !mustBluff && lastPlayerRoll != null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playerClaim(lastPlayerRoll);
      return;
    }

    if (hasRolled && mustBluff) return;

    setRollingAnim(true);
    Haptics.selectionAsync();
    playerRoll();
    setTimeout(() => setRollingAnim(false), 400);
  }

  function handleCallBluff() {
    if (controlsDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    callBluff();
  }

  function handleOpenBluff() {
    if (controlsDisabled) return;
    setClaimPickerOpen(true);
  }

  function handleSelectClaim(claim: number) {
    if (controlsDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playerClaim(claim);
    setClaimPickerOpen(false);
  }

  return (
    <View style={styles.root}>
      <FeltBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            {/* HEADER */}
            <View style={styles.headerCard}>
              <View style={styles.titleRow}>
                <Animated.Text style={[styles.title, { transform: [{ scale: pulseAnim }] }]}>Survival</Animated.Text>
                <Image
                  source={require('../assets/images/mexican-dice-logo.png')}
                  style={styles.logoImage}
                />
                <Animated.Text style={[styles.title, { transform: [{ scale: pulseAnim }] }]}>Mode</Animated.Text>
              </View>
              <Animated.Text style={[styles.scoreLine, { transform: [{ scale: pulseAnim }], color: dynamicScoreColor, opacity: streakFlashAnim }]}>Streak: {currentStreak} | Best: {bestStreak} | Global Best: {globalBest}</Animated.Text>
              <Text style={styles.subtle}>{claimText}</Text>
              <Text style={styles.status} numberOfLines={2}>
                {narration || 'Ready to roll.'}
              </Text>
              {showCpuThinking && (
                <Text style={styles.subtleSmall}>The Rival thinking…</Text>
              )}
            </View>

            {/* HISTORY BOX */}
            <Pressable
              onPress={() => setHistoryModalOpen(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.historyBox,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Animated.View style={{ opacity: fadeAnim }}>
                {survivalClaims && survivalClaims.length > 0 ? (
                  [...survivalClaims.slice(-2)].reverse().map((h, i) => (
                    <Text key={i} style={styles.historyText} numberOfLines={1}>
                      {h.type === 'event' ? h.text : `${h.who === 'player' ? 'You' : 'The Rival'} ${h.claim === 41 ? 'rolled' : 'claimed'} ${formatClaim(h.claim)}`}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.historyText}>No recent events.</Text>
                )}
              </Animated.View>
            </Pressable>

            {/* DICE BLOCK */}
            <View testID="dice-area" style={styles.diceArea}>
              <View style={styles.diceRow}>
                <Dice
                  value={turn === 'player' ? playerHi : cpuHi}
                  rolling={rolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Your' : undefined}
                />
                <View style={{ width: 24 }} />
                <Dice
                  value={turn === 'player' ? playerLo : cpuLo}
                  rolling={rolling}
                  displayMode={diceDisplayMode}
                  overlayText={diceDisplayMode === 'prompt' ? 'Roll' : undefined}
                />
              </View>
            </View>

            {/* ACTION BAR */}
            <View style={styles.controls}>
              <View style={styles.actionRow}>
                <StyledButton
                  label={hasRolled && !mustBluff ? 'Claim Roll' : 'Roll'}
                  variant="primary"
                  onPress={handleRollOrClaim}
                  style={styles.btn}
                  disabled={controlsDisabled || (hasRolled && !rolledCanClaim)}
                />
                <StyledButton
                  label="Call Bluff"
                  variant="success"
                  onPress={handleCallBluff}
                  style={styles.btn}
                  disabled={controlsDisabled || hasRolled}
                />
              </View>
              {hasRolled && !rolledCanClaim && !controlsDisabled && (
                <Text style={styles.rollHelper}>
                  Your roll doesn’t beat the current claim. Choose a bluff — 21 and 31 are always available.
                </Text>
              )}

              <View style={styles.bottomRow}>
                <StyledButton
                  label="Choose Claim"
                  variant="outline"
                  onPress={handleOpenBluff}
                  style={styles.btnWide}
                  disabled={controlsDisabled}
                />
              </View>

              <View style={styles.bottomRow}>
                <StyledButton
                  label="New Game"
                  variant="ghost"
                  onPress={() => { restartSurvival(); }}
                  style={[styles.btn, styles.newGameBtn]}
                />
                <StyledButton
                  label="Menu"
                  variant="ghost"
                  onPress={() => router.push('/')}
                  style={[styles.btn, styles.menuBtn]}
                />
                <StyledButton
                  label="View Rules"
                  variant="ghost"
                  onPress={() => router.push('/rules')}
                  style={[styles.btn, styles.newGameBtn]}
                />
              </View>
            </View>

            {/* FOOTER REMOVED: View Rules button omitted for Survival mode */}
          </View>

          <BluffModal
            visible={claimPickerOpen}
            options={claimOptions}
            onCancel={() => setClaimPickerOpen(false)}
            onSelect={handleSelectClaim}
            canShowSocial={hasRolled && lastPlayerRoll === 41}
            onShowSocial={() => handleSelectClaim(41)}
          />

          {/* EXPANDABLE HISTORY MODAL */}
          <Modal
            visible={historyModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setHistoryModalOpen(false)}
          >
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setHistoryModalOpen(false)}
            />
            <View style={styles.modalCenter}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Full History</Text>
                  <Pressable
                    onPress={() => setHistoryModalOpen(false)}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.modalHistoryList}>
                  {survivalClaims && survivalClaims.length > 0 ? (
                    [...survivalClaims].reverse().map((h, i) => (
                      <View key={i} style={styles.historyItem}>
                        <Text style={styles.historyItemText}>
                          {h.type === 'event' ? h.text : `${h.who === 'player' ? 'You' : 'The Rival'} ${h.claim === 41 ? 'rolled' : 'claimed'} ${formatClaim(h.claim)}`}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noHistoryText}>No history yet.</Text>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </FeltBackground>
      <FireworksOverlay visible={showFireworks} onDone={() => setShowFireworks(false)} />
    </View>
  );
}

const BAR_BG = '#115E38';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B3A26' },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerCard: {
    backgroundColor: '#115E38',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 28,
    marginBottom: 4,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoImage: {
    width: 32,
    height: 32,
    marginHorizontal: 8,
  },
  scoreLine: {
    color: '#E6FFE6',
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtleSmall: {
    color: '#C9F0D6',
    opacity: 0.8,
    textAlign: 'center',
    fontSize: 13,
  },
  status: {
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    marginTop: -134,
    marginBottom: 20,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: BAR_BG,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: -150,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  btn: { flex: 1 },
  newGameBtn: {
    borderWidth: 2,
    borderColor: '#e0b50c',
  },
  menuBtn: {
    borderWidth: 2,
    borderColor: '#063a25',
  },
  btnWide: { flex: 1 },
  rollHelper: {
    color: '#F8E9A1',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  historyBox: {
    alignSelf: 'center',
    width: '70%',
    minHeight: 72,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: '#000',
    borderWidth: 2,
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    marginBottom: 10,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  historyText: {
    color: '#E6FFE6',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 2,
  },
  historyIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  iconPlayer: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  iconCpu: {
    color: '#6BFF89',
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a4d2e',
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
    width: '85%',
    borderColor: '#e0b50c',
    borderWidth: 2,
    zIndex: 1001,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#E6FFE6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalHistoryList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  historyItemIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  historyItemText: {
    color: '#E6FFE6',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  noHistoryText: {
    color: '#C9F0D6',
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
  },
});
