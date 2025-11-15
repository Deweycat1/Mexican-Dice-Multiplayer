import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export default function FeltBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="felt" cx="50%" cy="30%" r="90%">
            <Stop offset="0%" stopColor="#0c5030" />
            <Stop offset="70%" stopColor="#0a3f28" />
            <Stop offset="100%" stopColor="#0a3723" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#felt)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

