import { createUserFromClerkId } from "../../../services/user.js";
import { Router, Request, Response } from "express";

const router = Router()

router.post('/:clerkId', async (req: Request, res: Response) => {
    const user = await createUserFromClerkId(req.params.clerkId!)
    return res.jsonp(user)
})

export default router