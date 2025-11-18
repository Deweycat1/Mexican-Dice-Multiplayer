import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OnlineScreen() {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUsername = async () => {
      try {
        const storedUsername = await AsyncStorage.getItem('username');
        setUsername(storedUsername);
      } catch (error) {
        console.error('Error loading username:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsername();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Online Play (Coming Soon)</Text>

      {isLoading ? (
        <View style={styles.usernameContainer}>
          <ActivityIndicator size="small" color="#E0B50C" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <Text style={styles.username}>
          Signed in as: {username || 'Unknown'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  username: {
    fontSize: 18,
    color: '#E0B50C',
    fontWeight: '600',
    textAlign: 'center',
  },
});
