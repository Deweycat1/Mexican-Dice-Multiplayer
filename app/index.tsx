import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import MexicanDiceLogo from '../assets/images/mexican-dice-logo.png';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Image source={MexicanDiceLogo} style={styles.logo} />
      <Text style={styles.subtitle}>Ready to roll?</Text>

      <Link href="/game" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Quick Play</Text>
        </Pressable>
      </Link>

      <Link href="/survival" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Survival Mode</Text>
        </Pressable>
      </Link>

      <Link href="/stats" asChild>
        <Pressable style={styles.buttonStats}>
          <Text style={styles.buttonText}>Stats</Text>
        </Pressable>
      </Link>

      <Link href="/rules" asChild>
        <Pressable style={styles.buttonRules}>
          <Text style={styles.buttonText}>Rules</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const baseButton = {
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 24,
  marginVertical: 6,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B3A26', alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  subtitle: { fontSize: 15, color: '#E6FFE6', marginBottom: 20 },
  button: { ...baseButton, backgroundColor: '#C21807' },
  buttonStats: { ...baseButton, backgroundColor: '#D4AF37' },
  buttonRules: { ...baseButton, backgroundColor: '#0FA958' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
