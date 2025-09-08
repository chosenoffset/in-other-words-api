import { createUserFromClerkId } from "../../services/user.js";
import { Router, Request, Response } from "express";

const router = Router()

router.post('/', async (req: Request, res: Response) => {
    const user = await createUserFromClerkId(res.locals.clerkUser)
    return res.jsonp(user)
})

export default router