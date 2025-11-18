import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import { supabase } from '../src/lib/supabase';

export default function UsernameScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSaveUsername = async () => {
    // Clear previous errors
    setErrorMessage('');

    // Validate username
    if (!username.trim()) {
      setErrorMessage('Please enter a username');
      return;
    }

    setIsLoading(true);

    try {
      // Insert username into Supabase users table
      const { data, error } = await supabase
        .from('users')
        .insert([{ username: username.trim() }])
        .select('id, username')
        .single();

      if (error) {
        // Check if it's a unique constraint violation (duplicate username)
        if (error.code === '23505') {
          setErrorMessage('This username is already taken. Please choose another one.');
        } else {
          setErrorMessage(`Error: ${error.message}`);
        }
        setIsLoading(false);
        return;
      }

      // Save to AsyncStorage
      if (data) {
        await AsyncStorage.setItem('userId', data.id.toString());
        await AsyncStorage.setItem('username', data.username);

        // Navigate to redirect destination or main menu
        const target =
          typeof redirect === 'string' && redirect.length > 0 ? redirect : '/';
        router.replace(target as any);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a Username</Text>
      <Text style={styles.subtitle}>Pick a unique name for the leaderboard</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!isLoading}
      />

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleSaveUsername}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Save Username</Text>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.skipButton,
          pressed && styles.skipButtonPressed,
        ]}
        onPress={() => router.replace('/')}
        disabled={isLoading}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </Pressable>
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(15, 169, 88, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(15, 169, 88, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    maxWidth: 400,
  },
  button: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0FA958',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonPressed: {
    opacity: 0.6,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
});
