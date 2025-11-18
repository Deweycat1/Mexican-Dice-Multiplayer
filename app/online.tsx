import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCurrentUser, initializeAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';

export default function OnlineScreen() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [friendUsername, setFriendUsername] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  useEffect(() => {
    const loadUsername = async () => {
      try {
        // Initialize auth first (Phase 3: ensures user has Supabase session)
        await initializeAuth();
        
        const storedUsername = await AsyncStorage.getItem('username');
        setUsername(storedUsername);
      } catch (error) {
        console.error('Error loading username or initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsername();
  }, []);

  const handleStartGame = async () => {
    setMessage(null);

    // Validate friend username
    if (!friendUsername.trim()) {
      setMessage({ type: 'error', text: 'Please enter a friend\'s username' });
      return;
    }

    setIsCreatingGame(true);

    try {
      // Phase 3: Get authenticated Supabase user
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        setMessage({ type: 'error', text: 'Authentication required. Please reload.' });
        setIsCreatingGame(false);
        return;
      }

      // Fetch friend user by username
      const { data: friend, error: friendError } = await supabase
        .from('users')
        .select('*')
        .eq('username', friendUsername.trim())
        .single();

      if (friendError || !friend) {
        setMessage({ type: 'error', text: 'User not found' });
        setIsCreatingGame(false);
        return;
      }

      // Get display username from AsyncStorage
      const myUsername = await AsyncStorage.getItem('username');

      if (!myUsername) {
        setMessage({ type: 'error', text: 'Session error. Please sign in again.' });
        setIsCreatingGame(false);
        return;
      }

      // Insert new game with auth user IDs (Phase 3: RLS-ready)
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          player1_id: currentUser.id,  // Supabase auth user ID
          player1_username: myUsername,  // Display name
          player2_id: friend.id,  // Friend's Supabase auth user ID
          player2_username: friend.username,  // Friend's display name
          status: 'waiting',
          current_player: 'player1',
        })
        .select()
        .single();

      if (gameError) {
        setMessage({ type: 'error', text: `Error creating game: ${gameError.message}` });
        setIsCreatingGame(false);
        return;
      }

      // Success - navigate to match screen
      setFriendUsername('');
      router.push(`/online/${game.id}` as any);
    } catch (error) {
      console.error('Error starting game:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsCreatingGame(false);
    }
  };

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

      {!isLoading && (
        <View style={styles.gameCreationContainer}>
          <Text style={styles.label}>Friend&apos;s Username</Text>
          <TextInput
            style={styles.input}
            value={friendUsername}
            onChangeText={setFriendUsername}
            placeholder="Enter username"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            autoCapitalize="none"
            editable={!isCreatingGame}
          />

          <TouchableOpacity
            style={[styles.button, isCreatingGame && styles.buttonDisabled]}
            onPress={handleStartGame}
            disabled={isCreatingGame}
          >
            {isCreatingGame ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Start Game</Text>
            )}
          </TouchableOpacity>

          {message && (
            <View style={[styles.messageContainer, message.type === 'error' ? styles.errorContainer : styles.successContainer]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          )}
        </View>
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
    marginBottom: 32,
  },
  gameCreationContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'stretch',
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0FA958',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(15, 169, 88, 0.5)',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  successContainer: {
    backgroundColor: 'rgba(15, 169, 88, 0.1)',
    borderColor: 'rgba(15, 169, 88, 0.4)',
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
