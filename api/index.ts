// import "./instrument"
import express from 'express'
import cors from 'cors'
import { ApiError } from '../src/utils/error.js'
import type { ErrorRequestHandler } from 'express'
import superadminRoutes from '../src/utils/routes/superAdmin/puzzleRoutes.js'

const port = 3005
const app = express()
const router = express.Router()

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'clerk-session-id', ]
}
app.use(cors(corsOptions))

app.listen(port, () => {
    console.log(`API listening on PORT ${port} `)
})

router.get('/api/test', async (req, res) => {
    res.jsonp({data: 'Hello World!'})
})

// Routes for superadmins
const superadminRouter = express.Router()
// TODO: write superadmin middleware
// superadminRouter.use(assertSuperAdminMiddleware)

superadminRouter.use('/api/superadmin', superadminRoutes)

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
