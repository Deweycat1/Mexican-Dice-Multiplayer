import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface RollStatsData {
  rolls: Record<string, number>;
}

interface SurvivalBestData {
  best: number;
}

interface SurvivalAverageData {
  average: number;
}

interface WinStatsData {
  playerWins: number;
  cpuWins: number;
}

interface ClaimStatsData {
  claims: Record<string, number>;
}

interface RollStat {
  roll: string;
  label: string;
  count: number;
  percentage: number;
}

interface ClaimStat {
  claim: string;
  label: string;
  count: number;
  percentage: number;
}

type StatView = 'menu' | 'rolls' | 'wins' | 'claims';

export default function StatsScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<StatView>('menu');
  
  // Roll stats
  const [rollStats, setRollStats] = useState<RollStat[]>([]);
  const [totalRolls, setTotalRolls] = useState<number>(0);
  
  // Win/Survival stats
  const [globalBest, setGlobalBest] = useState<number | null>(null);
  const [averageStreak, setAverageStreak] = useState<number | null>(null);
  const [playerWins, setPlayerWins] = useState<number>(0);
  const [cpuWins, setCpuWins] = useState<number>(0);
  
  // Claim stats
  const [claimStats, setClaimStats] = useState<ClaimStat[]>([]);
  const [totalClaims, setTotalClaims] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        
        // Fetch all APIs in parallel
        const [survivalBestRes, survivalAvgRes, rollsRes, winsRes, claimsRes] = await Promise.all([
          fetch(`${baseUrl}/api/survival-best`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/survival-average`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/roll-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/win-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${baseUrl}/api/claim-stats`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        ]);

        if (!survivalBestRes.ok) throw new Error('Failed to fetch survival best');
        if (!survivalAvgRes.ok) throw new Error('Failed to fetch survival average');
        if (!rollsRes.ok) throw new Error('Failed to fetch roll stats');
        if (!winsRes.ok) throw new Error('Failed to fetch win stats');
        if (!claimsRes.ok) throw new Error('Failed to fetch claim stats');

        const survivalBestData: SurvivalBestData = await survivalBestRes.json();
        const survivalAvgData: SurvivalAverageData = await survivalAvgRes.json();
        const rollsData: RollStatsData = await rollsRes.json();
        const winsData: WinStatsData = await winsRes.json();
        const claimsData: ClaimStatsData = await claimsRes.json();

        // Set survival stats
        setGlobalBest(survivalBestData.best ?? 0);
        setAverageStreak(survivalAvgData.average ?? 0);

        // Set win stats
        setPlayerWins(winsData.playerWins ?? 0);
        setCpuWins(winsData.cpuWins ?? 0);

        // Process roll statistics
        const rolls = rollsData.rolls || {};
        const totalR = Object.values(rolls).reduce((sum, count) => sum + count, 0);
        setTotalRolls(totalR);
        const rollsArray: RollStat[] = Object.entries(rolls)
          .map(([roll, count]) => ({
            roll,
            label: getRollLabel(roll),
            count,
            percentage: totalR > 0 ? (count / totalR) * 100 : 0,
          }))
          .sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));
        setRollStats(rollsArray);

        // Process claim statistics
        const claims = claimsData.claims || {};
        const totalC = Object.values(claims).reduce((sum, count) => sum + count, 0);
        setTotalClaims(totalC);
        const claimsArray: ClaimStat[] = Object.entries(claims)
          .map(([claim, count]) => ({
            claim,
            label: getRollLabel(claim),
            count,
            percentage: totalC > 0 ? (count / totalC) * 100 : 0,
          }))
          .sort((a, b) => parseInt(a.claim, 10) - parseInt(b.claim, 10));
        setClaimStats(claimsArray);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getRollLabel = (roll: string): string => {
    switch (roll) {
      case '21':
        return '21 (Mexican 🌮)';
      case '31':
        return '31 (Reverse)';
      case '41':
        return '41 (Social)';
      default:
        return roll;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FA958" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Stats</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Make sure the Upstash KV database is connected to your Vercel project.
          </Text>
          <Pressable
            onPress={() => {
              setError(null);
              setIsLoading(true);
              // Re-trigger the effect by updating a key
              const fetchStats = async () => {
                setIsLoading(true);
                setError(null);

                try {
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  
                  const [survivalResponse, rollsResponse] = await Promise.all([
                    fetch(`${baseUrl}/api/survival-best`, {
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' },
                    }),
                    fetch(`${baseUrl}/api/roll-stats`, {
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' },
                    }),
                  ]);

                  if (!survivalResponse.ok) {
                    throw new Error(`Survival API: ${survivalResponse.status}`);
                  }
                  
                  if (!rollsResponse.ok) {
                    throw new Error(`Roll stats API: ${rollsResponse.status}`);
                  }

                  const survivalData: SurvivalBestData = await survivalResponse.json();
                  const rollsData: RollStatsData = await rollsResponse.json();

                  setGlobalBest(survivalData.best ?? 0);

                  const rolls = rollsData.rolls || {};
                  const total = Object.values(rolls).reduce((sum, count) => sum + count, 0);
                  setTotalRolls(total);

                  const statsArray: RollStat[] = Object.entries(rolls)
                    .map(([roll, count]) => ({
                      roll,
                      label: getRollLabel(roll),
                      count,
                      percentage: total > 0 ? (count / total) * 100 : 0,
                    }))
                    .sort((a, b) => parseInt(a.roll, 10) - parseInt(b.roll, 10));

                  setRollStats(statsArray);
                } catch (err) {
                  console.error('Error fetching stats:', err);
                  setError(err instanceof Error ? err.message : 'Failed to load statistics');
                } finally {
                  setIsLoading(false);
                }
              };
              fetchStats();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  // Menu view
  const renderMenu = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Global Statistics</Text>
      
      <View style={styles.menuContainer}>
        <Pressable
          onPress={() => setCurrentView('rolls')}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuButtonIcon}>🎲</Text>
          <Text style={styles.menuButtonTitle}>Roll Distribution</Text>
          <Text style={styles.menuButtonDesc}>View stats for all dice rolls</Text>
        </Pressable>

        <Pressable
          onPress={() => setCurrentView('wins')}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuButtonIcon}>🏆</Text>
          <Text style={styles.menuButtonTitle}>Win & Survival Stats</Text>
          <Text style={styles.menuButtonDesc}>Quick Play wins and Survival streaks</Text>
        </Pressable>

        <Pressable
          onPress={() => setCurrentView('claims')}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuButtonIcon}>🗣️</Text>
          <Text style={styles.menuButtonTitle}>Claim Distribution</Text>
          <Text style={styles.menuButtonDesc}>See which claims are made most</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Text style={styles.backButtonText}>Back to Menu</Text>
      </Pressable>
    </View>
  );

  // Roll Distribution view
  const renderRolls = () => (
    <View style={styles.container}>
      <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Roll Distribution</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎲 Total Rolls Tracked</Text>
          <Text style={styles.bigNumber}>{totalRolls.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Breakdown by Roll</Text>
          {rollStats.length === 0 ? (
            <Text style={styles.noDataText}>No rolls recorded yet</Text>
          ) : (
            <View style={styles.statsTable}>
              {rollStats.map((stat) => (
                <View key={stat.roll} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stat.count}</Text>
                    <Text style={styles.statPercent}>({stat.percentage.toFixed(2)}%)</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Win & Survival Stats view
  const renderWins = () => {
    const totalGames = playerWins + cpuWins;
    const playerWinRate = totalGames > 0 ? (playerWins / totalGames) * 100 : 0;
    const cpuWinRate = totalGames > 0 ? (cpuWins / totalGames) * 100 : 0;

    return (
      <View style={styles.container}>
        <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
          <Text style={styles.backButtonTopText}>← Back</Text>
        </Pressable>
        
        <Text style={styles.title}>Win & Survival Stats</Text>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎮 Quick Play - Total Games</Text>
            <Text style={styles.bigNumber}>{totalGames.toLocaleString()}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆 Quick Play Wins</Text>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>You</Text>
                <View style={styles.statValues}>
                  <Text style={styles.statCount}>{playerWins}</Text>
                  <Text style={styles.statPercent}>({playerWinRate.toFixed(1)}%)</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>The Rival</Text>
                <View style={styles.statValues}>
                  <Text style={styles.statCount}>{cpuWins}</Text>
                  <Text style={styles.statPercent}>({cpuWinRate.toFixed(1)}%)</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔥 Survival Mode</Text>
            <View style={styles.statsTable}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Global Best Streak</Text>
                <Text style={styles.statCountLarge}>{globalBest}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average Streak</Text>
                <Text style={styles.statCountLarge}>{averageStreak?.toFixed(2) ?? '0.00'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Claim Distribution view
  const renderClaims = () => (
    <View style={styles.container}>
      <Pressable onPress={() => setCurrentView('menu')} style={styles.backButtonTop}>
        <Text style={styles.backButtonTopText}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Claim Distribution</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🗣️ Total Claims Made</Text>
          <Text style={styles.bigNumber}>{totalClaims.toLocaleString()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Breakdown by Claim</Text>
          {claimStats.length === 0 ? (
            <Text style={styles.noDataText}>No claims recorded yet</Text>
          ) : (
            <View style={styles.statsTable}>
              {claimStats.map((stat) => (
                <View key={stat.claim} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <View style={styles.statValues}>
                    <Text style={styles.statCount}>{stat.count}</Text>
                    <Text style={styles.statPercent}>({stat.percentage.toFixed(2)}%)</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0FA958" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Stats</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Make sure the Upstash KV database is connected to your Vercel project.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  // Render based on current view
  switch (currentView) {
    case 'rolls':
      return renderRolls();
    case 'wins':
      return renderWins();
    case 'claims':
      return renderClaims();
    default:
      return renderMenu();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B3A26',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#115E38',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 12,
    textAlign: 'center',
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0FA958',
    textAlign: 'center',
  },
  statsTable: {
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(230, 255, 230, 0.1)',
  },
  statLabel: {
    fontSize: 16,
    color: '#E6FFE6',
    fontWeight: '600',
    flex: 1,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statCount: {
    fontSize: 16,
    color: '#0FA958',
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  statPercent: {
    fontSize: 14,
    color: '#CCCCCC',
    minWidth: 70,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#C21807',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#E6FFE6',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#E6FFE6',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0FA958',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  menuButton: {
    backgroundColor: '#115E38',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  menuButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  menuButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  menuButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6FFE6',
    marginBottom: 8,
    textAlign: 'center',
  },
  menuButtonDesc: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  backButtonTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonTopText: {
    fontSize: 16,
    color: '#0FA958',
    fontWeight: '600',
  },
  statCountLarge: {
    fontSize: 24,
    color: '#0FA958',
    fontWeight: '700',
  },
});
