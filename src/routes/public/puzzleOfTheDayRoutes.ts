import express from 'express'
import { getPuzzleOfTheDay, submitPuzzleAnswer } from '../../services/puzzleService.js'
import { ApiError } from '../../utils/error.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
    try {
        const puzzle = await getPuzzleOfTheDay()
        res.json({
            success: true,
            data: {
                id: puzzle.id,
                question: puzzle.question,
                hints: puzzle.hints,
                // Note: answer is not included in public response
            }
        })
    } catch (error) {
        next(new ApiError(500, 'Failed to get puzzle of the day', error))
    }
})

router.post('/submit/:id', async (req, res, next) => {
    try {
        const puzzleId = req.params.id
        const { answer } = req.body
        
        if (!answer || typeof answer !== 'string') {
            throw new ApiError(400, 'Answer is required and must be a string')
        }
        
        const result = await submitPuzzleAnswer(puzzleId, answer)
        
        res.json({
            success: true,
            data: result
        })
    } catch (error) {
        next(new ApiError(500, 'Failed to submit puzzle answer', error))
    }
})

export default router