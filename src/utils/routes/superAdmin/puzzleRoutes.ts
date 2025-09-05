import express from 'express'
import { getAllPuzzles, getPuzzleById, createPuzzle, updatePuzzle, deletePuzzle, softDeletePuzzle } from '../../../services/puzzleService.js'
import { Request, Response } from 'express'

const router = express.Router()

router.get('/api/superadmin/puzzles', async (req: Request, res: Response) => {
    const puzzles = await getAllPuzzles()
    res.jsonp(puzzles)
})

router.get('/api/superadmin/puzzles/:id', async (req: Request, res: Response) => {
    if (!req.params.id) {
        res.status(400).jsonp({ message: 'Puzzle ID is required' })
        return
    }
    const puzzle = await getPuzzleById(req.params.id)
    res.jsonp(puzzle)
})

router.post('/api/superadmin/puzzles', async (req: Request, res: Response) => {
    const puzzle = await createPuzzle(req.body)
    res.jsonp(puzzle)
})

router.put('/api/superadmin/puzzles/:id', async (req: Request, res: Response) => {
    if (!req.params.id) {
        res.status(400).jsonp({ message: 'Puzzle ID is required' })
        return
    }
    const puzzle = await updatePuzzle(req.params.id, req.body)
    res.jsonp(puzzle)
})

router.delete('/api/superadmin/puzzles/:id', async (req: Request, res: Response) => {
    if (!req.params.id) {
        res.status(400).jsonp({ message: 'Puzzle ID is required' })
        return
    }
    const puzzle = await softDeletePuzzle(req.params.id)
    res.jsonp(puzzle)
})

router.delete('/api/superadmin/puzzles/hard-delete/:id', async (req: Request, res: Response) => {
    if (!req.params.id) {
        res.status(400).jsonp({ message: 'Puzzle ID is required' })
        return
    }
    const puzzle = await deletePuzzle(req.params.id)
    res.jsonp(puzzle)
})

export default router