import rateLimit from 'express-rate-limit'

export const puzzleSubmissionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        success: false,
        error: 'Too many puzzle submission attempts. Please try again later.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for authenticated superadmin users
    skip: (req, res) => {
        const user = res.locals?.user
        return user && user.role === 'SUPERADMIN'
    }
})

export const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes  
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many API requests. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for authenticated superadmin users
    skip: (req, res) => {
        const user = res.locals?.user
        return user && user.role === 'SUPERADMIN'
    }
})