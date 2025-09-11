import crypto from 'crypto'
import { Request, Response } from 'express'

export interface UserContext {
    userId?: string
    userFingerprint?: string
    ipAddress?: string
    userAgent?: string
}

export function generateAnonymousFingerprint(ipAddress: string, puzzleId: string): string {
    const dailySalt = getDailySalt()
    const data = `${ipAddress}:${puzzleId}:${dailySalt}`
    
    return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex')
        .substring(0, 32)
}

export function extractUserContext(req: Request, res: Response, puzzleId: string): UserContext {
    const userId = res.locals?.user?.id
    let ipAddress = ""
    const userAgent = req.headers['user-agent'] || 'unknown'

    if (req.ip !== undefined) {
        ipAddress = req.ip
    } else {
        const headerAddress = req.headers['x-forwarded-for']
        if (headerAddress !== undefined) {
            if (typeof headerAddress === 'string') {
                ipAddress = headerAddress
            } else {
                const arrayIP = headerAddress[0]
                if (arrayIP !== undefined) {
                    ipAddress = arrayIP
                } else {
                    throw new Error('Unable to determine IP address')
                }
            }
        }
    }
    
    const context: UserContext = {
        userId,
        ipAddress,
        userAgent
    }

    // For anonymous users, generate fingerprint
    if (!context.userId && context.ipAddress) {
        context.userFingerprint = generateAnonymousFingerprint(context.ipAddress, puzzleId)
    }
    
    return context
}

function getDailySalt(): string {
    const today = new Date().toISOString().split('T')[0]
    const baseSalt = process.env.FINGERPRINT_SALT || 'default-salt-change-in-production'
    
    return crypto
        .createHash('sha256')
        .update(`${baseSalt}:${today}`)
        .digest('hex')
        .substring(0, 16)
}

export const GUESS_LIMITS = {
    ANONYMOUS: 3,
    AUTHENTICATED: 5
} as const