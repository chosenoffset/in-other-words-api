import { Router, Request, Response } from "express";
import { isSuperadmin } from "../../services/user.js";
import { User } from "@prisma/client";
import { getUserWithSubscription } from "../../services/user.js";

const router = Router()

router.get('/clerk/superadmin', async (req: Request, res: Response) => {
    const isUserSuperadmin = await isSuperadmin(res.locals.user as User)
    res.json(isUserSuperadmin)
})

router.get('/', async (req: Request, res: Response) => {
    const user = await getUserWithSubscription(res.locals.user as User)
    res.json(user)
})

export default router