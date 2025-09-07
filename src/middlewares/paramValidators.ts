import type { Request, Response, NextFunction } from 'express'

export type ParamValidationFn = (value: string) => boolean

export const notEmpty: ParamValidationFn = (value: string) => {
    return typeof value === 'string' && value.trim().length > 0
}

export const isClerkId: ParamValidationFn = (value: string) => {
    return /^user_[a-zA-Z0-9]+$/.test(value)
}

export function paramValidator(name: string, validate: ParamValidationFn, message?: string): (req: Request, res: Response, next: NextFunction, value: string) => void {
    return (req: Request, res: Response, next: NextFunction, value: string) => {
        if (!validate(value)) {
            return res.status(400).jsonp({ message: message ?? `${name} is invalid` })
        }
        next()
    }
}


