import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import BluffModal from '../../src/components/BluffModal';
import Dice from '../../src/components/Dice';
import FeltBackground from '../../src/components/FeltBackground';
import { ScoreDie } from '../../src/components/ScoreDie';
import StyledButton from '../../src/components/StyledButton';
import { splitClaim } from '../../src/engine/mexican';
import { applyCallBluff, applyClaim, type CoreGameState } from '../../src/engine/onlineActions';
import { rollDice } from '../../src/engine/onlineRoll';
import { buildClaimOptions } from '../../src/lib/claimOptions';
import { supabase } from '../../src/lib/supabase';

type OnlineGame = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player1_username: string;
  player2_username: string | null;
  player1_score: number;
  player2_score: number;
  player1_joined: boolean;
  player2_joined: boolean;
  current_player: 'player1' | 'player2';
  current_claim: string | null;
  current_roll: string | null;
  baseline_claim: string | null;
  last_action: 'normal' | 'reverseVsMexican';
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
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRoll, setMyRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);

  useEffect(() => {
    const loadGame = async () => {
      // Validate gameId
      if (!gameId || typeof gameId !== 'string') {
        setError('Invalid game id');
        setLoading(false);
        return;
      }

      try {
        // Load user ID from AsyncStorage
        const storedUserId = await AsyncStorage.getItem('userId');
        setMyUserId(storedUserId);

        // Fetch game from Supabase
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

  // Mark the current player as joined
  useEffect(() => {
    if (!game || !myUserId) return;

    const markJoined = async () => {
      const isPlayer1 = myUserId === game.player1_id;
      const field = isPlayer1 ? 'player1_joined' : 'player2_joined';

      // If this field is already true in the current game object, do nothing
      if ((isPlayer1 && game.player1_joined) || (!isPlayer1 && game.player2_joined)) {
        return;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update({ [field]: true })
        .eq('id', game.id);

      if (updateError) {
        console.error('Error marking player as joined:', updateError);
      } else {
        // Update local state to reflect the change
        setGame({ ...game, [field]: true });
      }
    };

    markJoined();
  }, [game, myUserId]);

  // Auto-activate the game when both players have joined
  useEffect(() => {
    if (!game) return;

    const maybeActivate = async () => {
      if (
        game.status === 'waiting' &&
        game.player1_joined === true &&
        game.player2_joined === true
      ) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ status: 'active' })
          .eq('id', game.id);

        if (updateError) {
          console.error('Error activating game:', updateError);
        } else {
          // Update local state to reflect the change
          setGame({ ...game, status: 'active' });
        }
      }
    };

    maybeActivate();
  }, [game]);

  // Handle rolling dice for the current player
  const handleRoll = async () => {
    if (!game || !isMyTurn || !myUserId || isRolling) return;
    if (myRoll !== null) return; // Already rolled this turn

    try {
      setIsRolling(true);

      // Roll the dice using the same logic as Quick Play
      const { normalized } = rollDice();
      
      // Update local state immediately for responsive UI
      setMyRoll(normalized);
      
      // Convert roll to string for database storage
      const rollStr = String(normalized);
      
      // Update the game in Supabase
      const { error: updateError } = await supabase
        .from('games')
        .update({
          current_roll: rollStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', game.id);

      if (updateError) {
        console.error('Error updating roll:', updateError);
        setMyRoll(null); // Revert on error
      } else {
        // Update local game state
        setGame({ ...game, current_roll: rollStr });
      }
    } catch (err) {
      console.error('Unexpected error during roll:', err);
      setMyRoll(null);
    } finally {
      setIsRolling(false);
    }
  };

  // Mapper functions to convert between Supabase game row and CoreGameState
  const mapGameToCoreState = (game: OnlineGame): CoreGameState => ({
    player1Score: game.player1_score,
    player2Score: game.player2_score,
    currentPlayer: game.current_player,
    currentRoll: game.current_roll,
    currentClaim: game.current_claim,
    baselineClaim: game.baseline_claim,
    lastAction: game.last_action || 'normal',
    status: game.status === 'finished' ? 'finished' : 'active',
    winner: game.winner,
  });

  const mapCoreStateToGameUpdate = (core: CoreGameState) => ({
    player1_score: core.player1Score,
    player2_score: core.player2Score,
    current_player: core.currentPlayer,
    current_roll: core.currentRoll,
    current_claim: core.currentClaim,
    baseline_claim: core.baselineClaim,
    last_action: core.lastAction,
    status: core.status,
    winner: core.winner,
    updated_at: new Date().toISOString(),
  });

  // Handle making a claim
  const handleClaim = async (claimValue: number) => {
    if (!game || !isMyTurn || !myUserId) return;
    if (myRoll === null) return; // Must roll before claiming

    try {
      // Convert game to core state
      const coreState = mapGameToCoreState(game);
      
      // Apply the claim using shared logic
      const result = applyClaim(coreState, claimValue, myRoll);
      
      if (!result.success) {
        console.error('Claim failed:', result.error);
        alert(result.error || 'Invalid claim');
        return;
      }

      // Update Supabase with new state
      const updates = mapCoreStateToGameUpdate(result.newState!);
      const { error: updateError } = await supabase
        .from('games')
        .update(updates)
        .eq('id', game.id);

      if (updateError) {
        console.error('Error updating claim:', updateError);
        alert('Failed to update game');
      } else {
        // Update local state
        setGame({ ...game, ...updates });
        setMyRoll(null); // Clear roll after claiming
      }
    } catch (err) {
      console.error('Unexpected error during claim:', err);
      alert('An unexpected error occurred');
    }
  };

  // Handle calling bluff
  const handleCallBluff = async () => {
    if (!game || !isMyTurn || !myUserId) return;
    if (!game.current_claim) return; // No claim to challenge

    try {
      // Get the opponent's actual roll from the database
      // In a real implementation, this should be stored securely
      // For now, we'll use the current_roll field
      const opponentRoll = game.current_roll ? parseInt(game.current_roll, 10) : 0;
      
      // Convert game to core state
      const coreState = mapGameToCoreState(game);
      
      // Apply the bluff call using shared logic
      const result = applyCallBluff(coreState, opponentRoll);
      
      // Update Supabase with new state (BluffResult always returns newState)
      const updates = mapCoreStateToGameUpdate(result.newState!);
      const { error: updateError } = await supabase
        .from('games')
        .update(updates)
        .eq('id', game.id);

      if (updateError) {
        console.error('Error updating after bluff call:', updateError);
        alert('Failed to update game');
      } else {
        // Update local state
        setGame({ ...game, ...updates });
        setMyRoll(null); // Clear roll
        
        // Show result message
        alert(result.message);
      }
    } catch (err) {
      console.error('Unexpected error during bluff call:', err);
      alert('An unexpected error occurred');
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E0B50C" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hintText}>Please go back and try again.</Text>
      </View>
    );
  }

  // Not found state
  if (!game) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Match not found</Text>
      </View>
    );
  }

  // Determine which player is me and which is friend
  const isPlayer1 = myUserId === game.player1_id;
  const myScore = isPlayer1 ? game.player1_score : game.player2_score;
  const friendName = isPlayer1 ? (game.player2_username || 'Friend') : game.player1_username;
  const friendScore = isPlayer1 ? game.player2_score : game.player1_score;

  // Determine if it's my turn
  const isMyTurn =
    !!game &&
    !!myUserId &&
    ((isPlayer1 && game.current_player === 'player1') ||
      (!isPlayer1 && game.current_player === 'player2'));

  return (
    <FeltBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* HEADER */}
          <View style={styles.headerCard}>
            {/* Top row: Player avatar, title, Friend avatar */}
            <View style={styles.headerRow}>
              {/* Player Column (You) */}
              <View style={styles.playerColumn}>
                <View style={styles.avatarCircle}>
                  <Image
                    source={require('../../assets/images/User.png')}
                    style={styles.userAvatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.playerScoreLabel}>
                  You: {myScore}
                </Text>
                <ScoreDie points={myScore} style={styles.scoreDie} />
              </View>

              {/* Title Column - Shows current claim */}
              <View style={styles.titleColumn}>
                <Text style={styles.subtle}>
                  Current claim: {game.current_claim || '—'} {'\n'}
                  Your roll: {myRoll !== null ? String(myRoll) : '—'}
                </Text>
              </View>

              {/* Friend Column (Rival spot) */}
              <View style={styles.playerColumn}>
                <View style={styles.avatarCircle}>
                  <Image
                    source={require('../../assets/images/Rival.png')}
                    style={styles.rivalAvatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.playerScoreLabel}>
                  {friendName}: {friendScore}
                </Text>
                <ScoreDie points={friendScore} style={styles.scoreDie} />
              </View>
            </View>

            {/* Status text below */}
            <Text style={styles.status} numberOfLines={2}>
              {game.status === 'waiting' && (() => {
                const isPlayer1 = myUserId === game.player1_id;
                const myJoined = isPlayer1 ? game.player1_joined : game.player2_joined;
                const friendJoined = isPlayer1 ? game.player2_joined : game.player1_joined;
                
                if (!myJoined && !friendJoined) {
                  return 'Waiting for both players...';
                } else if (myJoined && !friendJoined) {
                  return 'Waiting for your friend to join...';
                } else if (!myJoined && friendJoined) {
                  return 'Waiting for you to join...';
                } else {
                  return 'Both players joined. Starting game...';
                }
              })()}
              {game.status === 'active' && (isMyTurn ? 'Your turn.' : `${friendName}'s turn.`)}
              {game.status === 'finished' && `Game finished! Winner: ${game.winner === 'player1' ? game.player1_username : game.player2_username}`}
            </Text>
          </View>

          {/* HISTORY BOX - Placeholder for now */}
          <View style={styles.historyBox}>
            <Text style={styles.historyText}>
              Online match in progress. Gameplay coming soon.
            </Text>
          </View>

          {/* DICE BLOCK */}
          <View style={styles.diceArea}>
            <View style={styles.diceRow}>
              <Dice
                value={myRoll !== null ? splitClaim(myRoll)[0] : null}
                rolling={isRolling}
                displayMode={myRoll !== null ? 'values' : 'prompt'}
                overlayText={myRoll === null ? 'Your' : undefined}
              />
              <View style={{ width: 24 }} />
              <Dice
                value={myRoll !== null ? splitClaim(myRoll)[1] : null}
                rolling={isRolling}
                displayMode={myRoll !== null ? 'values' : 'prompt'}
                overlayText={myRoll === null ? 'Roll' : undefined}
              />
            </View>
          </View>

          {/* ACTION BAR */}
          <View style={styles.controls}>
            <View style={styles.actionRow}>
              <StyledButton
                label="Roll"
                variant="success"
                onPress={handleRoll}
                style={[styles.btn, (!isMyTurn || myRoll !== null) && styles.disabledButton]}
                disabled={!isMyTurn || myRoll !== null || isRolling}
              />
              <StyledButton
                label="Call Bluff"
                variant="primary"
                onPress={handleCallBluff}
                style={[styles.btn, (!isMyTurn || !game.current_claim) && styles.disabledButton]}
                disabled={!isMyTurn || !game.current_claim}
              />
            </View>

            <View style={styles.bottomRow}>
              <StyledButton
                label="Bluff Options"
                variant="outline"
                onPress={() => setClaimPickerOpen(true)}
                style={[styles.btnWide, (!isMyTurn || myRoll === null) && styles.disabledButton]}
                disabled={!isMyTurn || myRoll === null}
              />
            </View>

            <View style={styles.bottomRow}>
              <StyledButton
                label="Leave Match"
                variant="ghost"
                onPress={() => console.log('Leave (coming soon)')}
                style={[styles.btn, styles.ghostBtn]}
              />
              <StyledButton
                label="Menu"
                variant="ghost"
                onPress={() => console.log('Menu (coming soon)')}
                style={[styles.btn, styles.ghostBtn]}
              />
              <StyledButton
                label="View Rules"
                variant="ghost"
                onPress={() => console.log('Rules (coming soon)')}
                style={[styles.btn, styles.ghostBtn]}
              />
            </View>
          </View>

          {/* BLUFF OPTIONS MODAL */}
          <BluffModal
            visible={claimPickerOpen}
            options={game ? buildClaimOptions(
              game.current_claim ? parseInt(game.current_claim) : null,
              myRoll || 21
            ) : []}
            onCancel={() => setClaimPickerOpen(false)}
            onSelect={(claimValue) => {
              setClaimPickerOpen(false);
              handleClaim(claimValue);
            }}
            canShowSocial={myRoll === 41}
            onShowSocial={() => {
              setClaimPickerOpen(false);
              handleClaim(41);
            }}
          />
        </View>
      </SafeAreaView>
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerCard: {
    position: 'relative',
    backgroundColor: '#115E38',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E0B50C',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  userAvatarImage: {
    width: 62,
    height: 62,
  },
  rivalAvatarImage: {
    width: 56,
    height: 56,
  },
  playerScoreLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scoreDie: {
    marginTop: 6,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginTop: 75,
  },
  subtle: {
    color: '#E0B50C',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  status: {
    color: '#fff',
    opacity: 0.95,
    textAlign: 'center',
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
  },
  historyText: {
    color: '#E6FFE6',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 2,
  },
  diceArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controls: {
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
  },
  btnWide: {
    flex: 1,
  },
  ghostBtn: {
    borderWidth: 2,
    borderColor: '#e0b50c',
  },
  disabledButton: {
    opacity: 0.4,
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
});
