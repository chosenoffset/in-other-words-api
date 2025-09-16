/**
 * TypeScript interfaces and types for the player statistics system
 */

export interface GameSessionInput {
  userId: string;
  puzzleId: string;
  startedAt: Date;
  completedAt?: Date;
  guesses: number;
  solved: boolean;
  gaveUp: boolean;
  hintsUsed: number;
  solveTimeMs?: number;
}

export interface PlayerStats {
  totalGames: number;
  gamesWon: number;
  winRate: number; // calculated field: (gamesWon / totalGames) * 100
  currentStreak: number;
  longestStreak: number;
  averageGuesses?: number;
  averageSolveTimeMs?: number;
  fastestSolveMs?: number;
  lastPlayedAt?: Date;
}

export interface PlayerStatsResponse {
  success: boolean;
  data: PlayerStats;
}

// For database operations
export interface GameSessionCreate {
  userId: string;
  puzzleId: string;
  startedAt: Date;
  completedAt?: Date;
  guesses: number;
  solved: boolean;
  gaveUp: boolean;
  hintsUsed: number;
  solveTimeMs?: number;
}

export interface PlayerStatisticsUpdate {
  totalGames: number;
  gamesWon: number;
  currentStreak: number;
  longestStreak: number;
  averageGuesses?: number;
  averageSolveTimeMs?: number;
  fastestSolveMs?: number;
  lastPlayedAt?: Date;
}

// For game metadata passed from frontend
export interface GameMetadata {
  startedAt?: Date;
  guesses: number;
  hintsUsed?: number;
}

// Streak calculation helpers
export interface StreakCalculationResult {
  currentStreak: number;
  longestStreak: number;
}

// Performance metrics
export interface PerformanceMetrics {
  averageGuesses?: number;
  averageSolveTimeMs?: number;
  fastestSolveMs?: number;
}