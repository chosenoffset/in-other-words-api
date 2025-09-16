import express, {Router} from 'express'
import {getAttemptStatus, getPuzzleOfTheDay, submitPuzzleAnswer, giveUpPuzzle} from '../../services/puzzleService.js'
import {extractUserContext, UserContext} from "../../utils/fingerprint.js";
import optionalAuthMiddleware from '../../middlewares/optionalAuthMiddleware.js'

const router: Router = express.Router()

// Apply optional authentication to all routes
router.use(optionalAuthMiddleware)

router.get('/', async (_, res): Promise<void> => {
    const puzzleOfTheDay = await getPuzzleOfTheDay()
    res.json(puzzleOfTheDay)
})

router.post('/submit/:id', async (req, res): Promise<void> => {
    const puzzleId: string = req.params.id
    const {answer} = req.body

    const userContext: UserContext = extractUserContext(req, res, puzzleId)
    const result = await submitPuzzleAnswer(puzzleId, answer, userContext)

    res.json({
        success: true,
        data: result
    })
})

router.get('/attempts/:id', async (req, res): Promise<void> => {
    const puzzleId: string = req.params.id

    const userContext: UserContext = extractUserContext(req, res, puzzleId)
    const attemptStatus = await getAttemptStatus(puzzleId, userContext)

    res.json({
        success: true,
        data: attemptStatus
    })
})

router.post('/give-up/:id', async (req, res): Promise<void> => {
    const puzzleId: string = req.params.id

    const userContext: UserContext = extractUserContext(req, res, puzzleId)

    if (!userContext.userId) {
        res.status(401).json({
            success: false,
            message: 'Give up is only available for authenticated users'
        })
        return
    }

    const result = await giveUpPuzzle(puzzleId, userContext)

    res.json({
        success: true,
        data: result
    })
})

export default router