import { Puzzle, User } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { assert } from '../utils/assert.js'
import { isSuperadmin } from '../utils/auth.js'

export async function getAllPuzzles() {
    const puzzles = await prisma.puzzle.findMany()

    assert(puzzles, 'No puzzles found')
    return puzzles
}

export async function getPuzzleOfTheDay() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // First check for manually scheduled puzzle for today
    let puzzle = await prisma.puzzle.findFirst({
        where: {
            displayDate: today,
            published: true,
            archived: false
        }
    })
    
    if (puzzle) {
        return puzzle
    }
    
    // Fallback to algorithmic selection
    const allPuzzles = await prisma.puzzle.findMany({
        where: {
            published: true,
            archived: false,
            displayOrder: { not: null }
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
        
        assert(puzzle, 'No published puzzles available')
        return puzzle
    }
    
    // Use days since epoch to select puzzle deterministically
    const epochDate = new Date('2024-01-01')
    const daysSinceEpoch = Math.floor((today.getTime() - epochDate.getTime()) / (1000 * 60 * 60 * 24))
    const puzzleIndex = daysSinceEpoch % allPuzzles.length
    
    const fullPuzzleOfTheDay = allPuzzles[puzzleIndex]
    assert(fullPuzzleOfTheDay, 'No puzzle found')

    // Don't return the answer here
    const puzzleOfTheDay = {
        id: fullPuzzleOfTheDay.id,
        question: fullPuzzleOfTheDay.question,
        hints: fullPuzzleOfTheDay.hints,
    }
    return puzzleOfTheDay
}

export async function getPuzzleById(id: string) {
    const puzzle = await prisma.puzzle.findUnique({
        where: { id }
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
        where: { id },
        data: puzzle
    })

    assert(updatedPuzzle, 'Failed to update puzzle')
    return updatedPuzzle
}

export async function deletePuzzle(id: string, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const deletedPuzzle = await prisma.puzzle.delete({
        where: { id }
    })

    assert(deletedPuzzle, 'Failed to delete puzzle')
    return deletedPuzzle
}

export async function softDeletePuzzle(id: string, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    const softDeletedPuzzle = await prisma.puzzle.update({
        where: { id },
        data: { archived: true }
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
            id: { not: id }
        }
    })
    
    assert(!existingPuzzle, 'Another puzzle is already scheduled for this date')
    
    const scheduledPuzzle = await prisma.puzzle.update({
        where: { id },
        data: { displayDate: date }
    })
    
    assert(scheduledPuzzle, 'Failed to schedule puzzle')
    return scheduledPuzzle
}

export async function setDisplayOrder(id: string, displayOrder: number, loggedInUser: User) {
    isSuperadmin(loggedInUser)
    
    const updatedPuzzle = await prisma.puzzle.update({
        where: { id },
        data: { displayOrder }
    })
    
    assert(updatedPuzzle, 'Failed to set display order')
    return updatedPuzzle
}

export async function getScheduledPuzzles(loggedInUser: User) {
    isSuperadmin(loggedInUser)
    
    const scheduledPuzzles = await prisma.puzzle.findMany({
        where: {
            displayDate: { not: null },
            archived: false
        },
        orderBy: {
            displayDate: 'asc'
        }
    })
    
    return scheduledPuzzles
}

export async function submitPuzzleAnswer(puzzleId: string, submittedAnswer: string) {
    assert(submittedAnswer, 'answer is required')
    assert(typeof submittedAnswer === 'string', 'answer must be a string')
    
    const puzzle = await prisma.puzzle.findUnique({
        where: { 
            id: puzzleId,
            published: true,
            archived: false 
        }
    })
    
    assert(puzzle, 'Puzzle not found or not available')
    
    // Normalize answers for comparison (trim whitespace, case insensitive)
    const normalizedSubmitted = submittedAnswer.trim().toLowerCase()
    const normalizedCorrect = puzzle.answer.trim().toLowerCase()
    
    const isCorrect = normalizedSubmitted === normalizedCorrect
    
    return {
        isCorrect,
        puzzleId: puzzle.id,
        submittedAnswer,
        // Don't return the correct answer in the response for security
    }
}
