import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type DiceProps = {
  value: number | null;
  size?: number;
  rolling?: boolean;
  displayMode?: 'prompt' | 'question' | 'values';
  overlayText?: string;
};

// Vegas casino dice colors: ivory/white body with deep red pips
const DICE_BODY = '#FFFEF7';
const DICE_EDGE = '#F5F3EB';
const PIP_RED = '#D32F2F';
const PIP_DARK = '#B71C1C';

const pipsFor: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 0.5, y: 0.5 }],
  2: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
  ],
  3: [
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.75 },
  ],
  4: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  5: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  6: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.8 },
    { x: 0.75, y: 0.8 },
  ],
};

export default function Dice({
  value,
  size = 100,
  rolling,
  displayMode = 'values',
  overlayText,
}: DiceProps) {
  const rotate = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pulse = useSharedValue(1);
  const pipLayout: { x: number; y: number }[] | undefined =
    displayMode === 'values' && typeof value === 'number' ? pipsFor[value] : undefined;

  useEffect(() => {
    if (rolling) {
      rotate.value = withRepeat(
        withTiming(360, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false
      );
      tilt.value = withRepeat(
        withSequence(
          withTiming(8, { duration: 150 }),
          withTiming(-8, { duration: 300 }),
          withTiming(0, { duration: 150 })
        ),
        -1,
        false
      );
    } else {
      rotate.value = withTiming(0, { duration: 250 });
      tilt.value = withTiming(0, { duration: 250 });
    }
  }, [rolling, rotate, tilt]);

  useEffect(() => {
    if (displayMode === 'values') {
      pulse.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 360, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.94, { duration: 360, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );
  }, [displayMode, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.value}deg` },
      { rotateZ: `${tilt.value}deg` },
      { scale: rolling ? 0.98 : 1 },
    ],
    shadowOpacity: rolling ? 0.25 : 0.35,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: displayMode === 'values' ? 0 : 1,
  }));

  const pipRadius = size * 0.07;
  const overlayLabel = displayMode === 'question' ? '?' : overlayText ?? '';
  const showOverlay = displayMode !== 'values';
  
  // Scale border radius based on size: smaller dice = more square
  const borderRadius = size <= 40 ? size * 0.2 : 20;
  const svgRx = size <= 40 ? size * 0.2 : 18;

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, borderRadius }, animatedStyle]}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Main dice body gradient - ivory/white with subtle shading */}
          <LinearGradient id="diceBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="50%" stopColor={DICE_BODY} />
            <Stop offset="100%" stopColor={DICE_EDGE} />
          </LinearGradient>
          
          {/* Highlight for 3D effect */}
          <LinearGradient id="highlight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
          
          {/* Red pip gradient for depth */}
          <LinearGradient id="pipGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={PIP_DARK} />
            <Stop offset="100%" stopColor={PIP_RED} />
          </LinearGradient>
        </Defs>

        {/* Main dice body */}
        <Rect x={2} y={2} width={size - 4} height={size - 4} rx={svgRx} fill="url(#diceBody)" />
        
        {/* Top-left highlight for glossy 3D effect */}
        <Rect
          x={size * 0.08}
          y={size * 0.08}
          width={size * 0.42}
          height={size * 0.25}
          rx={size <= 40 ? size * 0.15 : 12}
          fill="url(#highlight)"
        />

        {/* Render pips with realistic red color and subtle shadow */}
        {pipLayout?.map(({ x, y }, index) => (
          <React.Fragment key={index}>
            {/* Pip shadow for indented effect */}
            <Circle 
              cx={x * size + 1} 
              cy={y * size + 1} 
              r={pipRadius * 1.05} 
              fill="rgba(0,0,0,0.15)" 
            />
            {/* Main pip */}
            <Circle 
              cx={x * size} 
              cy={y * size} 
              r={pipRadius} 
              fill="url(#pipGradient)" 
            />
          </React.Fragment>
        ))}
      </Svg>
      
      {/* Subtle texture overlay for realism */}
      <ExpoLinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(240,240,235,0.08)', 'rgba(0,0,0,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={styles.texture}
      />
      
      {showOverlay && (
        <Animated.View pointerEvents="none" style={[styles.overlay, pulseStyle]}>
          <Text
            style={[
              styles.overlayText,
              displayMode === 'question' ? styles.questionText : styles.promptText,
            ]}
          >
            {overlayLabel}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
    backgroundColor: DICE_BODY,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    borderRadius: 20,
  },
  overlayText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  questionText: {
    fontSize: 52,
  },
  promptText: {
    fontSize: 28,
  },
});
