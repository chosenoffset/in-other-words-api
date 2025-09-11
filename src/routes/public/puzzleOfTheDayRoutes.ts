import express from 'express'
import { getPuzzleOfTheDay, submitPuzzleAnswer } from '../../services/puzzleService.js'

const router = express.Router()

router.get('/', async (req, res) => {
    const puzzleOfTheDay = await getPuzzleOfTheDay()
    res.json(puzzleOfTheDay)
})

router.post('/submit/:id', async (req, res) => {
    const puzzleId = req.params.id
    const { answer } = req.body
        
    const result = await submitPuzzleAnswer(puzzleId, answer)

    res.json({
        success: true,
        data: result
    })
})

router.get('/attempts/:id', async (req, res, next) => {
    try {
        const puzzleId = req.params.id

        // Extract user context (authenticated or anonymous)
        const userContext = extractUserContext(req, res)

        // For anonymous users, generate fingerprint
        if (!userContext.userId && userContext.ipAddress) {
            userContext.userFingerprint = generateAnonymousFingerprint(userContext.ipAddress, puzzleId)
        }

        const attemptStatus = await getAttemptStatus(puzzleId, userContext)

        res.json({
            success: true,
            data: attemptStatus
        })
    } catch (error) {
        next(new ApiError(500, 'Failed to get attempt status', error))
    }
})

export default router