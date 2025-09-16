import { Prisma, GameSession } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { assert } from '../utils/assert.js'
import { ApiError } from '../utils/error.js'
import {
  GameSessionInput,
  PlayerStats,
  PlayerStatisticsUpdate,
  StreakCalculationResult,
  PerformanceMetrics
} from '../types/statistics.js'

export async function recordGameSession(sessionData: GameSessionInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Build data object without undefined optional properties
    const createData: any = {
      userId: sessionData.userId,
      puzzleId: sessionData.puzzleId,
      startedAt: sessionData.startedAt,
      guesses: sessionData.guesses,
      solved: sessionData.solved,
      gaveUp: sessionData.gaveUp,
      hintsUsed: sessionData.hintsUsed
    }

    // Only add optional properties if they have values
    if (sessionData.completedAt !== undefined) {
      createData.completedAt = sessionData.completedAt
    }
    if (sessionData.solveTimeMs !== undefined) {
      createData.solveTimeMs = sessionData.solveTimeMs
    }

    await tx.gameSession.create({ data: createData })
    await updatePlayerStatistics(sessionData.userId, tx)
  })
}

export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  assert(userId, 'User ID is required')

  const stats = await prisma.playerStatistics.findUnique({
    where: { userId }
  })

  if (!stats) {
    return getEmptyStats()
  }

  const result: PlayerStats = {
    totalGames: stats.totalGames,
    gamesWon: stats.gamesWon,
    winRate: stats.totalGames > 0 ? (stats.gamesWon / stats.totalGames) * 100 : 0,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak
  }

  // Only add optional properties if they have values
  if (stats.averageGuesses !== null) {
    result.averageGuesses = stats.averageGuesses
  }
  if (stats.averageSolveTimeMs !== null) {
    result.averageSolveTimeMs = stats.averageSolveTimeMs
  }
  if (stats.fastestSolveMs !== null) {
    result.fastestSolveMs = stats.fastestSolveMs
  }
  if (stats.lastPlayedAt !== null) {
    result.lastPlayedAt = stats.lastPlayedAt
  }

  return result
}

export async function recalculatePlayerStats(userId: string): Promise<PlayerStats> {
  assert(userId, 'User ID is required')

  await prisma.$transaction(async (tx) => {
    await updatePlayerStatistics(userId, tx)
  })

  return getPlayerStats(userId)
}

async function updatePlayerStatistics(
  userId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  // Get all game sessions for this user, ordered by completion date (newest first)
  const sessions = await tx.gameSession.findMany({
    where: {
      userId,
      completedAt: { not: null } // Only completed sessions
    },
    orderBy: { completedAt: 'desc' }
  })

  // Calculate basic stats
  const totalGames = sessions.length
  const gamesWon = sessions.filter(s => s.solved).length

  // Calculate streaks
  const streakResult = calculateStreaks(sessions)

  // Calculate performance metrics for solved games only
  const performanceMetrics = calculatePerformanceMetrics(sessions)

  // Get the most recent play date
  const lastPlayedAt = sessions.length > 0 ? sessions[0].completedAt : null

  // Prepare update data - only include defined values
  const updateData: any = {
    totalGames,
    gamesWon,
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak
  }

  // Only add optional properties if they have values
  if (performanceMetrics.averageGuesses !== undefined) {
    updateData.averageGuesses = performanceMetrics.averageGuesses
  }
  if (performanceMetrics.averageSolveTimeMs !== undefined) {
    updateData.averageSolveTimeMs = performanceMetrics.averageSolveTimeMs
  }
  if (performanceMetrics.fastestSolveMs !== undefined) {
    updateData.fastestSolveMs = performanceMetrics.fastestSolveMs
  }
  if (lastPlayedAt !== null) {
    updateData.lastPlayedAt = lastPlayedAt
  }

  await tx.playerStatistics.upsert({
    where: { userId },
    create: {
      userId,
      ...updateData
    },
    update: {
      ...updateData,
      updatedAt: new Date()
    }
  })
}

function calculateStreaks(sessions: GameSession[]): StreakCalculationResult {
  if (sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  let currentStreak = 0
  for (const session of sessions) {
    if (session.solved) {
      currentStreak++
    } else {
      break // Stop at first loss/give-up
    }
  }

  let longestStreak = 0
  let tempStreak = 0

  const chronologicalSessions = [...sessions].reverse()

  for (const session of chronologicalSessions) {
    if (session.solved) {
      tempStreak++
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  return { currentStreak, longestStreak }
}

function calculatePerformanceMetrics(sessions: GameSession[]): PerformanceMetrics {
  const solvedSessions = sessions.filter(s => s.solved)

  if (solvedSessions.length === 0) {
    return {}
  }

  const totalGuesses = solvedSessions.reduce((sum, s) => sum + s.guesses, 0)
  const averageGuesses = totalGuesses / solvedSessions.length

  const sessionsWithTime = solvedSessions.filter(s => s.solveTimeMs !== null && s.solveTimeMs !== undefined)

  let averageSolveTimeMs: number | undefined
  let fastestSolveMs: number | undefined

  if (sessionsWithTime.length > 0) {
    const totalSolveTime = sessionsWithTime.reduce((sum, s) => sum + s.solveTimeMs!, 0)
    averageSolveTimeMs = Math.round(totalSolveTime / sessionsWithTime.length)
    fastestSolveMs = Math.min(...sessionsWithTime.map(s => s.solveTimeMs!))
  }

  const result: PerformanceMetrics = {
    averageGuesses: Math.round(averageGuesses * 100) / 100 // Round to 2 decimal places
  }

  // Only add optional properties if they have values
  if (averageSolveTimeMs !== undefined) {
    result.averageSolveTimeMs = averageSolveTimeMs
  }
  if (fastestSolveMs !== undefined) {
    result.fastestSolveMs = fastestSolveMs
  }

  return result
}

function getEmptyStats(): PlayerStats {
  return {
    totalGames: 0,
    gamesWon: 0,
    winRate: 0,
    currentStreak: 0,
    longestStreak: 0
  }
}

export async function getRecentGameSessions(userId: string, limit: number = 10): Promise<GameSession[]> {
  assert(userId, 'User ID is required')

  return prisma.gameSession.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: limit,
    include: {
      puzzle: {
        select: {
          id: true,
          question: true,
          category: true
        }
      }
    }
  })
}