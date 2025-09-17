// import "./instrument"
import express from 'express'
import cors from 'cors'
import { ApiError } from '../src/utils/error.js'
import type { ErrorRequestHandler } from 'express'
import puzzleRoutes from '../src/routes/superAdmin/puzzleRoutes.js'
import 'dotenv/config'
import { clerkMiddleware } from '@clerk/express'
import { paramValidator, notEmpty, isClerkId } from '../src/middlewares/paramValidators.js'
import authenticateUserMiddleware from '../src/middlewares/getUserMiddleware.js'
import assertSuperadminMiddleware from '../src/middlewares/assertSuperadminMiddleware.js'
import registerRoutes from '../src/routes/app/register.js'
import userRoutes from '../src/routes/app/user.js'
import attemptConversionRoutes from '../src/routes/app/attemptConversionRoutes.js'
import statisticsRoutes from '../src/routes/app/statisticsRoutes.js'
import puzzleOfTheDayRoutes from '../src/routes/public/puzzleOfTheDayRoutes.js'
import stripeWebhookRouter from '../src/routes/webhooks/stripe.js'
import bodyParser from 'body-parser'
import stripeRoutes from '../src/routes/app/stripeRoutes.js'
import transactionRoutes from '../src/routes/app/transactionRoutes.js'

const port = 3005
const app = express()
const router = express.Router()

app.use(express.json())
app.use(clerkMiddleware())

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'clerk-session-id', ]
}
app.use(cors(corsOptions))

app.use('/api/webhooks/stripe', bodyParser.raw({ type: 'application/json' }))
app.use('/api/webhooks', stripeWebhookRouter)

// Global param validation for common route params
app.param('id', paramValidator('id', notEmpty, 'ID is required'))
app.param('clerkId', paramValidator('clerkId', isClerkId, 'clerkId is invalid'))

app.listen(port, () => {
    console.log(`API listening on PORT ${port} `)
})

router.get('/api/test', async (req, res) => {
    res.jsonp({data: 'Hello World!'})
})

// Public routes
const publicRouter = express.Router()
publicRouter.use('/puzzle-of-the-day', puzzleOfTheDayRoutes)

// Authenticated routes
const appRouter = express.Router()
appRouter.use(authenticateUserMiddleware)
appRouter.use('/users', userRoutes)
appRouter.use('/register', registerRoutes)
appRouter.use('/attempts', attemptConversionRoutes)
appRouter.use('/stats', statisticsRoutes)
appRouter.use('/stripe', stripeRoutes)
appRouter.use('/transactions', transactionRoutes)

// Superadmin routes
const superadminRouter = express.Router()
superadminRouter.use(authenticateUserMiddleware)
superadminRouter.use(assertSuperadminMiddleware)

superadminRouter.use('/puzzles', puzzleRoutes)

router.use('/api/public', publicRouter)
router.use('/api/app', appRouter)
router.use('/api/superadmin', superadminRouter)
app.use('/', router)

// ERROR HANDLER
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (!(err instanceof ApiError)) {
        err = new ApiError(err?.status ?? 500, err.message, err.stack, err.line)
    }

    console.log(err)
    console.log("ERROR HANDLER")
    res.status(err.status).send({
        'endpoint': req.route?.path,
        'body': req.body,
        'status': err.status,
        'message': err.message,
        'stack': err.stack,
        'line': err.line,
    })
}
app.use(errorHandler)
