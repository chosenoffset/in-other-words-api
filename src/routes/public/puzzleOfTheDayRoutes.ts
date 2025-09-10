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

export default router