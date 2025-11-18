import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import BluffModal from '../../src/components/BluffModal';
import Dice from '../../src/components/Dice';
import FeltBackground from '../../src/components/FeltBackground';
import OnlineGameOverModal from '../../src/components/OnlineGameOverModal';
import { ScoreDie } from '../../src/components/ScoreDie';
import StyledButton from '../../src/components/StyledButton';
import { splitClaim } from '../../src/engine/mexican';
import { applyClaim, type CoreGameState } from '../../src/engine/onlineActions';
import { rollDice } from '../../src/engine/onlineRoll';
import { initializeAuth } from '../../src/lib/auth';
import { buildClaimOptions } from '../../src/lib/claimOptions';
import { checkRateLimit, getMyCurrentRoll, resolveBluffSecure, saveHiddenRoll } from '../../src/lib/hiddenRolls';
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
  const router = useRouter();
  
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRoll, setMyRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [gameOverModalVisible, setGameOverModalVisible] = useState(false);

  useEffect(() => {
    const loadGame = async () => {
      // Validate gameId
      if (!gameId || typeof gameId !== 'string') {
        setError('Invalid game id');
        setLoading(false);
        return;
      }

      try {
        // Phase 3: Initialize auth to ensure user has session
        const user = await initializeAuth();
        setMyUserId(user.id);

        // Fetch game from Supabase (RLS now enforces access control)
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
        
        // Phase 3: Load my current roll from hidden rolls table
        const currentRoll = await getMyCurrentRoll(gameId);
        if (currentRoll) {
          setMyRoll(currentRoll);
        }
      } catch (err) {
        console.error('Unexpected error loading game:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  // Real-time subscription for game updates
  useEffect(() => {
    if (!gameId || typeof gameId !== 'string') return;

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          setGame(payload.new as OnlineGame);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Mark the current player as joined
  useEffect(() => {
    if (!game || !myUserId) return;

    const markJoined = async () => {
      const isPlayer1 = myUserId === game.player1_id;
      const field = isPlayer1 ? 'player1_joined' : 'player2_joined';
      const alreadyJoined = isPlayer1 ? game.player1_joined : game.player2_joined;

      // If this field is already true, do nothing
      if (alreadyJoined) {
        return;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update({ [field]: true })
        .eq('id', game.id);

      if (updateError) {
        console.error('Error marking player as joined:', updateError);
      }
      // Real-time subscription will update game state
    };

    markJoined();
    // Only depend on the specific fields we check, not the entire game object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.player1_joined, game?.player2_joined, myUserId]);

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
        }
        // Real-time subscription will update game state
      }
    };

    maybeActivate();
    // Only run when join status or game status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.status, game?.player1_joined, game?.player2_joined]);

  // Detect game over and show modal
  useEffect(() => {
    if (game?.status === 'finished' && game.winner) {
      setGameOverModalVisible(true);
    }
  }, [game?.status, game?.winner]);

  // Leave match handler
  const handleLeaveMatch = async () => {
    if (!game || !myUserId) return;

    Alert.alert(
      'Leave Match',
      'Are you sure you want to forfeit this match? Your opponent will win.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              // Determine winner (the opponent)
              const isPlayer1 = myUserId === game.player1_id;
              const winner = isPlayer1 ? 'player2' : 'player1';

              // Update game as finished with opponent as winner
              const { error: updateError } = await supabase
                .from('games')
                .update({
                  status: 'finished',
                  winner,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', game.id);

              if (updateError) {
                console.error('Error leaving match:', updateError);
                alert('Failed to leave match');
              } else {
                // Navigate back to menu
                router.replace('/');
              }
            } catch (err) {
              console.error('Unexpected error leaving match:', err);
              alert('An error occurred');
            }
          },
        },
      ]
    );
  };

  // Handle rolling dice for the current player
  const handleRoll = async () => {
    if (!game || !isMyTurn || !myUserId || isRolling) return;
    if (myRoll !== null) return; // Already rolled this turn

    try {
      // Phase 3: Check rate limit (spam prevention)
      const allowed = await checkRateLimit(game.id, 500);
      if (!allowed) {
        console.log('⏱️ Rate limit: action too soon');
        return;
      }

      setIsRolling(true);

      // Roll the dice using the same logic as Quick Play
      const { normalized } = rollDice();
      
      // Phase 3: Save roll to secure hidden_rolls table
      // Only the roller can see this via RLS
      await saveHiddenRoll(game.id, normalized);
      
      // Update local state immediately for responsive UI
      setMyRoll(normalized);
      
      // Update game with action timestamp (for rate limiting)
      // NOTE: We no longer store the actual roll in public.games
      const { error: updateError } = await supabase
        .from('games')
        .update({
          last_action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', game.id);

      if (updateError) {
        console.error('Error updating roll timestamp:', updateError);
        setMyRoll(null); // Revert on error
        alert('Failed to save roll');
      }
      // Real-time subscription will update game state
    } catch (err) {
      console.error('Unexpected error during roll:', err);
      setMyRoll(null);
      alert('An error occurred while rolling');
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
    last_action_at: new Date().toISOString(), // For rate limiting
    updated_at: new Date().toISOString(),
  });

  // Handle making a claim
  const handleClaim = async (claimValue: number) => {
    if (!game || !isMyTurn || !myUserId) return;
    if (myRoll === null) return; // Must roll before claiming

    try {
      // Rate limiting - prevent spam
      const canProceed = await checkRateLimit(game.id, 500);
      if (!canProceed) {
        console.log('Rate limit hit for claim');
        return;
      }

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
        // Clear roll after claiming (local state only)
        setMyRoll(null);
        // Real-time subscription will update game state
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
      // Rate limiting - prevent spam
      const canProceed = await checkRateLimit(game.id, 500);
      if (!canProceed) {
        console.log('Rate limit hit for bluff call');
        return;
      }

      // Use server-side RPC to resolve bluff securely
      // Use server-side RPC to resolve bluff securely
      // This prevents tampering and ensures opponent's roll stays hidden
      const claimNumber = parseInt(String(game.current_claim), 10);
      const result = await resolveBluffSecure(game.id, claimNumber);
      
      // RPC returns the bluff outcome
      // Update local UI with new scores from server
      // Real-time subscription will sync the full game state
      
      // Clear local roll state
      setMyRoll(null);
      
      // Show result message to user
      const winnerName = result.winner === 'player1' ? game.player1_username : 
                         result.winner === 'player2' ? game.player2_username : null;
      const message = winnerName 
        ? `${winnerName} wins the game!`
        : `${result.outcome > 0 ? 'Bluff caught' : 'Truth told'}! ${result.penalty} point penalty.`;
      
      alert(message);
      // Real-time subscription will update game state with new scores/turn
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
          {/* 
            IMPORTANT: Dice hiding behavior (UI-level security)
            - Only the local player sees their own dice (myRoll state)
            - Opponents see only the CLAIM text, never the actual roll
            - This is UX-level hiding; DB-level hiding + RLS will be added later
            - The opponent's actual roll is in game.current_roll but we never display it
          */}
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
                onPress={handleLeaveMatch}
                style={[styles.btn, styles.ghostBtn]}
                disabled={game.status === 'finished'}
              />
              <StyledButton
                label="Menu"
                variant="ghost"
                onPress={() => router.push('/')}
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

          {/* GAME OVER MODAL */}
          {game && game.status === 'finished' && game.winner && (
            <OnlineGameOverModal
              visible={gameOverModalVisible}
              didIWin={isPlayer1 ? game.winner === 'player1' : game.winner === 'player2'}
              myScore={myScore}
              opponentScore={friendScore}
              opponentName={friendName}
              onClose={() => {
                setGameOverModalVisible(false);
                router.replace('/');
              }}
            />
          )}
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
