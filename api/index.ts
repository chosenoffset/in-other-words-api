// import "./instrument"
import express from 'express'
import cors from 'cors'
import { ApiError } from '../src/utils/error.js'
import type { ErrorRequestHandler } from 'express'
import puzzleRoutes from '../src/utils/routes/superAdmin/puzzleRoutes.js'
import 'dotenv/config'
import { clerkMiddleware } from '@clerk/express'
import { paramValidator, notEmpty, isClerkId } from '../src/middlewares/paramValidators.js'
import authenticateUserMiddleware from '../src/middlewares/getUserMiddleware.js'
import assertSuperadminMiddleware from '../src/middlewares/assertSuperadminMiddleware.js'

const port = 3005
const app = express()
const router = express.Router()

app.use(clerkMiddleware())

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'clerk-session-id', ]
}
app.use(cors(corsOptions))

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

// Authenticated routes
const appRouter = express.Router()
appRouter.use(authenticateUserMiddleware)

// Superadmin routes
const superadminRouter = express.Router()
superadminRouter.use(authenticateUserMiddleware)
superadminRouter.use(assertSuperadminMiddleware)

superadminRouter.use('/api/superadmin', puzzleRoutes)

router.use(publicRouter)
router.use(appRouter)
router.use(superadminRouter)
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
