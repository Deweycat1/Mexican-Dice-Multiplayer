import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ensureUserProfile, type UserProfile } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';

export default function OnlineScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [friendUsername, setFriendUsername] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        console.log('🚀 Loading user profile...');
        const userProfile = await ensureUserProfile();
        
        if (isMounted) {
          setProfile(userProfile);
          setProfileError(null);
          console.log('✅ Profile loaded:', userProfile.username);
        }
      } catch (error: any) {
        console.error('❌ Failed to load user profile:', error);
        
        if (isMounted) {
          setProfileError(error.message ?? 'Could not load user profile');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartGame = async () => {
    setMessage(null);

    // Validate that we have a profile
    if (!profile) {
      setMessage({ type: 'error', text: 'Please wait for your profile to load' });
      return;
    }

    // Validate friend username
    if (!friendUsername.trim()) {
      setMessage({ type: 'error', text: 'Please enter a friend\'s username' });
      return;
    }

    setIsCreatingGame(true);

    try {
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

      // Insert new game with auth user IDs (Phase 3: RLS-ready)
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          player1_id: profile.id,  // Current user's Supabase auth ID
          player1_username: profile.username,  // Current user's display name
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
      <Text style={styles.title}>Online Play</Text>

      {isLoading ? (
        <View style={styles.usernameContainer}>
          <ActivityIndicator size="small" color="#E0B50C" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      ) : profileError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {profileError}</Text>
          <Text style={styles.errorHint}>You can still try to play, but features may be limited.</Text>
        </View>
      ) : (
        <Text style={styles.username}>
          Signed in as: {profile?.username ?? 'Unknown'}
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
  errorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    maxWidth: 400,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
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
