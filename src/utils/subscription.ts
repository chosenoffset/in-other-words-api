import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.stripeSubscription.findUnique({
        where: { userId },
        select: { status: true }
    })
    return subscription?.status === SubscriptionStatus.ACTIVE
}