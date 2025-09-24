import {Prisma, Puzzle, User} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {assert} from '../utils/assert.js'
import {isSuperadmin} from '../utils/auth.js'
import {GUESS_LIMITS, UserContext} from "../utils/fingerprint.js";
import {ApiError} from "../utils/error.js";
import {recordGameSession} from "./statisticsService.js";

export async function getAllPuzzles() {
    const puzzles = await prisma.puzzle.findMany()

    assert(puzzles, 'No puzzles found')
    return puzzles
}

export async function getPuzzleOfTheDay() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let puzzle = await prisma.puzzle.findFirst({
        where: {
            displayDate: today,
            published: true,
            archived: false
        }
    })

    if (puzzle === null) {
        const allPuzzles = await prisma.puzzle.findMany({
            where: {
                published: true,
                archived: false,
                displayOrder: {not: null}
            },
            orderBy: {
                displayOrder: 'asc'
            }
        })

        if (allPuzzles.length === 0) {
            // Final fallback to any published puzzle
            puzzle = await prisma.puzzle.findFirst({
                where: {
                    published: true,
                    archived: false
                },
                orderBy: {
                    createdAt: 'asc'
                }
            })
        } else {
            const epochDate = new Date('2024-01-01')
            const daysSinceEpoch = Math.floor((today.getTime() - epochDate.getTime()) / (1000 * 60 * 60 * 24))
            const puzzleIndex = daysSinceEpoch % allPuzzles.length

            if (allPuzzles[puzzleIndex] !== undefined) {
                puzzle = allPuzzles[puzzleIndex]
            }
        }
    }

    assert(puzzle, 'No puzzles found.')

    return {
        id: puzzle.id,
        question: puzzle.question,
        num_hints: puzzle.hints.length,
        category: puzzle.category,
    }
}

export async function getPuzzleById(id: string) {
    const puzzle = await prisma.puzzle.findUnique({
        where: {id}
    })

    assert(puzzle, 'Puzzle not found')
    return puzzle
}

export async function createPuzzle(puzzle: Puzzle, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const newPuzzle = await prisma.puzzle.create({
        data: puzzle
    })

    assert(newPuzzle, 'Failed to create puzzle')
    return newPuzzle
}

export async function updatePuzzle(id: string, puzzle: Puzzle, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const updatedPuzzle = await prisma.puzzle.update({
        where: {id},
        data: puzzle
    })

    assert(updatedPuzzle, 'Failed to update puzzle')
    return updatedPuzzle
}

export async function deletePuzzle(id: string, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const deletedPuzzle = await prisma.puzzle.delete({
        where: {id}
    })

    assert(deletedPuzzle, 'Failed to delete puzzle')
    return deletedPuzzle
}

export async function softDeletePuzzle(id: string, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const softDeletedPuzzle = await prisma.puzzle.update({
        where: {id},
        data: {archived: true}
    })

    assert(softDeletedPuzzle, 'Failed to soft delete puzzle')
    return softDeletedPuzzle
}

export async function schedulePuzzleForDate(id: string, date: Date, loggedInUser: User) {
    isSuperadmin(loggedInUser)

    // Ensure no other puzzle is scheduled for this date
    const existingPuzzle = await prisma.puzzle.findFirst({
        where: {
            displayDate: date,
            archived: false,
            id: {not: id}
        }
    })

    assert(!existingPuzzle, 'Another puzzle is already scheduled for this date')

    const scheduledPuzzle = await prisma.puzzle.update({
        where: {id},
        data: {displayDate: date}
    })

    assert(scheduledPuzzle, 'Failed to schedule puzzle')
    return scheduledPuzzle
}

export async function setDisplayOrder(id: string, displayOrder: number, loggedInUser: User) {
    isSuperadmin(loggedInUser)

    const updatedPuzzle = await prisma.puzzle.update({
        where: {id},
        data: {displayOrder}
    })

    assert(updatedPuzzle, 'Failed to set display order')
    return updatedPuzzle
}

export async function getScheduledPuzzles(loggedInUser: User) {
    isSuperadmin(loggedInUser)

    return prisma.puzzle.findMany({
        where: {
            displayDate: {not: null},
            archived: false
        },
        orderBy: {
            displayDate: 'asc'
        }
    })
}

export async function getHintForPuzzle(puzzleId: string, hintIndex: number): Promise<string> {
    const puzzle = await prisma.puzzle.findUnique({
        where: {
            id: puzzleId
        }
    })

    assert(puzzle, 'Puzzle not found or not available')

    const hint = puzzle.hints[hintIndex]

    assert(hint, "No hint for given index!")

    return hint
}

export async function getAllHintsForPuzzle(puzzleId: string): Promise<string[]> {
    const puzzle = await prisma.puzzle.findUnique({
        where: {
            id: puzzleId
        }
    })

    assert(puzzle, 'Puzzle not found or not available')

    return puzzle.hints
}

export async function submitPuzzleAnswer(puzzleId: string, submittedAnswer: string, userContext: UserContext) {
    assert(submittedAnswer, 'answer is required')

    const puzzle = await prisma.puzzle.findUnique({
        where: {
            id: puzzleId,
            published: true,
            archived: false
        }
    })

    assert(puzzle, 'Puzzle not found or not available')

    // Check existing attempts and limits
    const {remainingGuesses} = await getAttemptStatus(puzzleId, userContext)
    const maxGuesses = userContext.userId ? GUESS_LIMITS.AUTHENTICATED : GUESS_LIMITS.ANONYMOUS

    if (remainingGuesses <= 0) {
        throw new ApiError(400, `No guesses remaining. You have used all ${maxGuesses} guesses for this puzzle.`)
    }

    // Normalize answers for comparison (trim whitespace, case-insensitive)
    const normalizedSubmitted = submittedAnswer.trim().toLowerCase()
    const normalizedCorrect = puzzle.answer.trim().toLowerCase()
    const isCorrect = normalizedSubmitted === normalizedCorrect

    // Record the attempt
    await prisma.puzzleAttempt.create({
        data: {
            puzzleId,
            userId: userContext.userId || null,
            userFingerprint: userContext.userFingerprint || null,
            submittedAnswer: normalizedSubmitted,
            isCorrect,
            ipAddress: userContext.ipAddress || null,
            userAgent: userContext.userAgent || null
        }
    })

    const updatedRemainingGuesses = remainingGuesses - 1

    // Record game session for authenticated users after every attempt
    if (userContext.userId) {
        try {
            // Get all attempts for this user+puzzle to calculate session data
            const allAttempts = await prisma.puzzleAttempt.findMany({
                where: {
                    puzzleId,
                    userId: userContext.userId
                },
                orderBy: {
                    createdAt: 'asc'
                }
            })

            const firstAttempt = allAttempts[0]
            const totalGuesses = allAttempts.length

            // Only record completed sessions (solved or no guesses left)
            const isSessionComplete = isCorrect || updatedRemainingGuesses <= 0

            if (isSessionComplete && firstAttempt) {
                const baseSessionData = {
                    userId: userContext.userId,
                    puzzleId,
                    startedAt: firstAttempt.createdAt,
                    completedAt: new Date(),
                    guesses: totalGuesses,
                    solved: isCorrect,
                    gaveUp: false, // User didn't explicitly give up, they either solved it or ran out of guesses
                    hintsUsed: 0, // We don't track hints yet, but leaving this for future implementation
                }

                // Only add solveTimeMs if the puzzle was solved
                if (isCorrect) {
                    await recordGameSession({
                        ...baseSessionData,
                        solveTimeMs: Date.now() - firstAttempt.createdAt.getTime()
                    })
                } else {
                    await recordGameSession(baseSessionData)
                }
            }
        } catch (statsError) {
            // Log error but don't fail the puzzle submission
            console.error('Failed to record game statistics:', statsError)
        }
    }

    return {
        isCorrect,
        puzzleId: puzzle.id,
        submittedAnswer,
        remainingGuesses: updatedRemainingGuesses,
        maxGuesses,
        // Don't return the correct answer in the response for security
    }
}

export async function getAttemptStatus(puzzleId: string, userContext: UserContext) {
    const whereClause: Prisma.PuzzleAttemptWhereInput = userContext.userId
        ? {puzzleId, userId: userContext.userId}
        : {puzzleId, userFingerprint: userContext.userFingerprint!}

    const attemptCount = await prisma.puzzleAttempt.count({
        where: whereClause
    })

    const maxGuesses = userContext.userId ? GUESS_LIMITS.AUTHENTICATED : GUESS_LIMITS.ANONYMOUS
    const remainingGuesses = Math.max(0, maxGuesses - attemptCount)

    return {
        attemptCount,
        remainingGuesses,
        maxGuesses
    }
}

export async function giveUpPuzzle(puzzleId: string, userContext: UserContext) {
    assert(puzzleId, 'Puzzle ID is required')
    assert(userContext.userId, 'Give up is only available for authenticated users')

    const puzzle = await prisma.puzzle.findUnique({
        where: {
            id: puzzleId,
            published: true,
            archived: false
        }
    })

    assert(puzzle, 'Puzzle not found or not available')

    // Check if user has already solved this puzzle
    const existingSolvedAttempt = await prisma.puzzleAttempt.findFirst({
        where: {
            puzzleId,
            userId: userContext.userId,
            isCorrect: true
        }
    })

    if (existingSolvedAttempt) {
        throw new ApiError(400, 'You have already solved this puzzle')
    }

    // Record game session for giving up
    try {
        // Get all attempts for this user+puzzle to calculate session data
        const allAttempts = await prisma.puzzleAttempt.findMany({
            where: {
                puzzleId,
                userId: userContext.userId
            },
            orderBy: {
                createdAt: 'asc'
            }
        })

        const firstAttempt = allAttempts[0]
        const totalGuesses = allAttempts.length
        const startTime = firstAttempt ? firstAttempt.createdAt : new Date()

        await recordGameSession({
            userId: userContext.userId,
            puzzleId,
            startedAt: startTime,
            completedAt: new Date(),
            guesses: totalGuesses,
            solved: false,
            gaveUp: true,
            hintsUsed: 0
            // Don't include solveTimeMs since they gave up
        })
    } catch (statsError) {
        // Log error but don't fail the give up action
        console.error('Failed to record give up statistics:', statsError)
    }

    return {
        success: true,
        puzzleId,
        gaveUp: true,
        message: 'You have given up on this puzzle'
    }
}
