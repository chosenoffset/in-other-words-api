import { Router } from "express";
import { getTransactionById } from "../../services/transaction.js";
import { User } from "@prisma/client";

const router = Router()

router.get('/:id', async (req, res) => {
    const transaction = await getTransactionById(res.locals.user as User, req.params.id)
    res.json(transaction)
})

export default router