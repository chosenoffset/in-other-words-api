import { Request, Response, NextFunction } from "express"
import { getAuth } from "@clerk/express"
import { prisma } from "../../src/config/prisma.js"
import { assert } from "../../src/utils/assert.js"

const anonymousRoutes = [
    '/api/user/verify',
    '/api/user/verify/send',
    '/api/login',
    '/api/auth',
    '/api/search/dehashed',
    '/api/user',
    '/api/test'
]

export default async function authenticateUserMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip middleware for anonymous routes
  if (anonymousRoutes.includes(req.path)) {
    return next()
  }

  // Get auth object from Clerk
  const auth = getAuth(req);
  assert(auth.userId, 'Unauthorized', 401)

  const user = await prisma.user.findFirst({
    where: {
      clerkId: auth.userId!
    }
  })

  res.locals.user = user;
  res.locals.clerkUser = auth;

  next();
}