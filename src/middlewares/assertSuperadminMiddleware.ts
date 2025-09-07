import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { ApiError } from '../utils/error.js'

const assertSuperadminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (res.locals.user.role !== UserRole.SUPERADMIN) {
    throw new ApiError(401, 'Unauthorized')
  }
  
  next()
}

export default assertSuperadminMiddleware
