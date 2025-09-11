import express from 'express'
import { ApiError } from '../../utils/error.js'
import { prisma } from '../../config/prisma.js'
import { assert } from '../../utils/assert.js'

const router = express.Router()

router.post('/convert-attempts', async (req, res, next) => {
    try {
        const { userFingerprint } = req.body
        const authenticatedUser = res.locals.user
        
        assert(authenticatedUser, 'User must be authenticated', 401)
        assert(userFingerprint, 'userFingerprint is required')
        
        // Find all anonymous attempts for this fingerprint
        const anonymousAttempts = await prisma.puzzleAttempt.findMany({
            where: {
                userFingerprint,
                userId: null
            }
        })
        
        if (anonymousAttempts.length === 0) {
            return res.json({
                success: true,
                message: 'No anonymous attempts found to convert',
                convertedCount: 0
            })
        }
        
        // Check if user already has attempts for any of these puzzles
        const puzzleIds = anonymousAttempts.map(attempt => attempt.puzzleId)
        const existingUserAttempts = await prisma.puzzleAttempt.findMany({
            where: {
                userId: authenticatedUser.id,
                puzzleId: { in: puzzleIds }
            }
        })
        
        // Group by puzzle to handle conflicts
        const existingAttemptsByPuzzle = existingUserAttempts.reduce((acc, attempt) => {
            acc[attempt.puzzleId] = (acc[attempt.puzzleId] || 0) + 1
            return acc
        }, {} as Record<string, number>)
        
        const anonymousAttemptsByPuzzle = anonymousAttempts.reduce((acc, attempt) => {
            acc[attempt.puzzleId] = (acc[attempt.puzzleId] || []).concat(attempt)
            return acc
        }, {} as Record<string, any[]>)
        
        let convertedCount = 0
        const conversionResults = []
        
        for (const puzzleId of puzzleIds) {
            const existingCount = existingAttemptsByPuzzle[puzzleId] || 0
            const anonymousCount = anonymousAttemptsByPuzzle[puzzleId].length
            const maxAllowed = 5 // Authenticated user limit
            
            const canConvert = Math.max(0, maxAllowed - existingCount)
            const toConvert = Math.min(anonymousCount, canConvert)
            
            if (toConvert > 0) {
                // Convert the oldest anonymous attempts up to the limit
                const attemptsToConvert = anonymousAttemptsByPuzzle[puzzleId]
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                    .slice(0, toConvert)
                
                // Update these attempts to belong to the authenticated user
                await prisma.puzzleAttempt.updateMany({
                    where: {
                        id: { in: attemptsToConvert.map(a => a.id) }
                    },
                    data: {
                        userId: authenticatedUser.id,
                        userFingerprint: null
                    }
                })
                
                convertedCount += toConvert
                conversionResults.push({
                    puzzleId,
                    converted: toConvert,
                    skipped: anonymousCount - toConvert,
                    reason: toConvert < anonymousCount ? 'Would exceed authenticated user limit' : null
                })
            } else {
                conversionResults.push({
                    puzzleId,
                    converted: 0,
                    skipped: anonymousCount,
                    reason: 'User already at or over attempt limit for this puzzle'
                })
            }
        }
        
        // Delete any remaining anonymous attempts that couldn't be converted
        const convertedAttemptIds = anonymousAttempts
            .filter(attempt => 
                conversionResults.find(r => r.puzzleId === attempt.puzzleId && r.converted > 0)
            )
            .slice(0, convertedCount)
            .map(a => a.id)
            
        if (convertedAttemptIds.length < anonymousAttempts.length) {
            await prisma.puzzleAttempt.deleteMany({
                where: {
                    userFingerprint,
                    userId: null,
                    id: { notIn: convertedAttemptIds }
                }
            })
        }
        
        res.json({
            success: true,
            message: `Successfully converted ${convertedCount} attempts`,
            convertedCount,
            details: conversionResults
        })
        
    } catch (error) {
        next(new ApiError(500, 'Failed to convert attempts', error))
    }
})

export default router