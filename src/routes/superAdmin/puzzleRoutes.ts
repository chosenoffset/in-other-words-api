import express from 'express'
import { getAllPuzzles, getPuzzleById, createPuzzle, updatePuzzle, deletePuzzle, softDeletePuzzle, schedulePuzzleForDate, setDisplayOrder, getScheduledPuzzles } from '../../services/puzzleService.js'
import { Request, Response } from 'express'

const router = express.Router()

router.get('/puzzles', async (req: Request, res: Response) => {
    const puzzles = await getAllPuzzles()
    res.jsonp(puzzles)
})

router.get('/puzzles/:id', async (req: Request<{ id: string }>, res: Response) => {
    const puzzle = await getPuzzleById(req.params.id)
    res.jsonp(puzzle)
})

router.post('/puzzles', async (req: Request, res: Response) => {
    const puzzle = await createPuzzle(req.body, res.locals.user)
    res.jsonp(puzzle)
})

router.put('/puzzles/:id', async (req: Request<{ id: string }>, res: Response) => {
    const puzzle = await updatePuzzle(req.params.id, req.body, res.locals.user)
    res.jsonp(puzzle)
})

router.delete('/puzzles/:id', async (req: Request<{ id: string }>, res: Response) => {
    const puzzle = await softDeletePuzzle(req.params.id, res.locals.user)
    res.jsonp(puzzle)
})

router.delete('/puzzles/hard-delete/:id', async (req: Request<{ id: string }>, res: Response) => {
    const puzzle = await deletePuzzle(req.params.id, res.locals.user)
    res.jsonp(puzzle)
})

// Scheduling endpoints
router.get('/puzzles/scheduled', async (req: Request, res: Response) => {
    const scheduledPuzzles = await getScheduledPuzzles(res.locals.user)
    res.jsonp({
        success: true,
        data: scheduledPuzzles
    })
})

router.post('/puzzles/:id/schedule', async (req: Request<{ id: string }>, res: Response) => {
    const { date } = req.body
    const scheduleDate = new Date(date)
    scheduleDate.setHours(0, 0, 0, 0)
    
    const puzzle = await schedulePuzzleForDate(req.params.id, scheduleDate, res.locals.user)
    res.jsonp({
        success: true,
        data: puzzle
    })
})

router.put('/puzzles/:id/display-order', async (req: Request<{ id: string }>, res: Response) => {
    const { displayOrder } = req.body
    const puzzle = await setDisplayOrder(req.params.id, displayOrder, res.locals.user)
    res.jsonp({
        success: true,
        data: puzzle
    })
})

export default router