import {NextFunction, Request, Response} from "express"
import {getAuth} from "@clerk/express"
import {prisma} from "../config/prisma.js"

export default async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Get auth object from Clerk
        const auth = getAuth(req);

        console.log("Entered optional auth")
        console.log('Auth is: ', auth)

        // If no userId, continue without setting user
        if (!auth.userId) {
            return next();
        }

        // Find user in database
        const user = await prisma.user.findFirst({
            where: {
                clerkId: auth.userId
            }
        })

        // Set user and clerk data in locals if found
        if (user) {
            res.locals.user = user;
            res.locals.clerkUser = auth;
        }
    } catch (error) {
        // If any error occurs, just continue without authentication
        console.warn('Optional auth middleware error:', error);
    }

    next();
}