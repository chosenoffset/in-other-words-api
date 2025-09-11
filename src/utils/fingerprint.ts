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

export function extractUserContext(req: Request, res: Response): UserContext {
    const userId = res.locals?.user?.id
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    const userAgent = req.headers['user-agent'] || 'unknown'
    
    const context: UserContext = {
        userId,
        ipAddress,
        userAgent
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