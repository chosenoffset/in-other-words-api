import { Router, Request, Response } from "express";
import { createStripeSubscription, createBillingPortalSession } from "../../services/stripe/subscriptionManagement.js";

const router = Router()

router.post('/create-subscription', async (req: Request, res: Response) => {
    const response = await createStripeSubscription(res.locals.user)
    
    return res.json({ redirectUrl: response.redirectUrl })
})

router.post('/billing-portal', async (req: Request, res: Response) => {
    const response = await createBillingPortalSession(res.locals.user)
    return res.json({ redirectUrl: response.redirectUrl })
})

export default router