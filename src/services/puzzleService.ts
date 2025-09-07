import { Puzzle, User } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { assert } from '../utils/assert.js'
import { isSuperadmin } from '../utils/auth.js'

export async function getAllPuzzles() {
    const puzzles = await prisma.puzzle.findMany()

    assert(puzzles, 'No puzzles found')
    return puzzles
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
