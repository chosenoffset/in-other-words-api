import { Router, Request, Response } from "express";
import { isSuperadmin } from "../../services/user.js";
import { User } from "@prisma/client";

const router = Router()

router.get('/clerk/superadmin', async (req: Request, res: Response) => {
    const isUserSuperadmin = await isSuperadmin(res.locals.user as User)
    res.json(isUserSuperadmin)
})

export default router