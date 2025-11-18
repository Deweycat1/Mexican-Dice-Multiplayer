import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

type OnlineGame = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player1_username: string;
  player2_username: string | null;
  player1_score: number;
  player2_score: number;
  current_player: 'player1' | 'player2';
  current_claim: string | null;
  current_roll: string | null;
  status: 'waiting' | 'active' | 'finished';
  winner: 'player1' | 'player2' | null;
  created_at: string;
  updated_at: string;
};

export default function OnlineMatchScreen() {
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGame = async () => {
      // Validate gameId
      if (!gameId || typeof gameId !== 'string') {
        setError('Invalid game id');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (fetchError) {
          console.error('Error loading game:', fetchError);
          setError('Failed to load match. Please try again.');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('Match not found');
          setLoading(false);
          return;
        }

        setGame(data as OnlineGame);
      } catch (err) {
        console.error('Unexpected error loading game:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#E0B50C" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hintText}>Please go back and try again.</Text>
      </View>
    );
  }

  // Not found state
  if (!game) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Match not found</Text>
      </View>
    );
  }

  // Render game info
  const shortenedId = game.id.substring(0, 8);
  
  let statusText = '';
  if (game.status === 'waiting') {
    statusText = 'Status: Waiting for both players';
  } else if (game.status === 'active') {
    statusText = 'Status: In progress';
  } else if (game.status === 'finished') {
    const winnerName = game.winner === 'player1' ? game.player1_username : game.player2_username || 'Unknown';
    statusText = `Status: Finished. Winner: ${winnerName}`;
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Online Match</Text>
      <Text style={styles.gameIdText}>Game ID: {shortenedId}</Text>

      <View style={styles.playersContainer}>
        <View style={styles.playerCard}>
          <Text style={styles.playerLabel}>Player 1</Text>
          <Text style={styles.playerUsername}>{game.player1_username}</Text>
          <Text style={styles.playerScore}>Score: {game.player1_score}</Text>
        </View>

        <View style={styles.playerCard}>
          <Text style={styles.playerLabel}>Player 2</Text>
          <Text style={styles.playerUsername}>
            {game.player2_username || 'Waiting...'}
          </Text>
          <Text style={styles.playerScore}>Score: {game.player2_score}</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{statusText}</Text>
        
        {game.status === 'active' && (
          <Text style={styles.turnText}>
            Current turn: {game.current_player === 'player1' ? 'Player 1' : 'Player 2'}
          </Text>
        )}
      </View>
    </ScrollView>
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
  scrollView: {
    flex: 1,
    backgroundColor: '#0B3A26',
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  gameIdText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  hintText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  playersContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
  },
  playerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  playerLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  playerUsername: {
    fontSize: 20,
    color: '#E0B50C',
    fontWeight: '700',
    marginBottom: 8,
  },
  playerScore: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  statusContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  turnText: {
    fontSize: 14,
    color: '#0FA958',
    fontWeight: '600',
    textAlign: 'center',
  },
});
