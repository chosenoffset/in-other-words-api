import { assert } from "../../utils/assert.js"
import { prisma } from "../../config/prisma.js"
import { Stripe } from "stripe"
import { SubscriptionStatus, TransactionStatus, TransactionType, User } from "@prisma/client";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { priceList } from "../../utils/stripeConsts.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-08-27.basil"
})

export async function createStripeSubscription(loggedInUser: User) {
    const subscription = await prisma.stripeSubscription.findFirst({
        where: { userId: loggedInUser.id, status: SubscriptionStatus.ACTIVE },
    })

    assert(!subscription, 'Subscription already exists', 400);
    
    const transaction = await prisma.transaction.create({
        data: {
            userId: loggedInUser.id,
            amount: priceList.subscription.price,
            currency: priceList.subscription.currency,
            type: TransactionType.SUBSCRIPTION,
            status: TransactionStatus.PENDING,
        },
    })
    assert(transaction, 'Failed to create transaction', 400);

    const line_items = [
        {
            price: priceList.subscription.id,
            quantity: 1,
        },
    ]

    const successUrl = `${process.env.FRONTEND_URL}/checkout-success?transactionId=${transaction.id}`
    const cancelUrl = `${process.env.FRONTEND_URL}/checkout-cancel?transactionId=${transaction.id}`
    const metadata = {
        transactionId: transaction.id,
    }

    const customerEmail = loggedInUser.stripeCustomerId
        ? undefined
        : (await clerkClient.users.getUser(loggedInUser.clerkId))?.emailAddresses?.[0]?.emailAddress

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        subscription_data: {
            metadata,
        },
        ...(loggedInUser.stripeCustomerId ? { customer: loggedInUser.stripeCustomerId } : {}),
        ...(customerEmail ? { customer_email: customerEmail } : {}),
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    assert(session, 'Failed to create checkout session', 400);
    assert(session.url, 'Checkout session URL is required', 400);

    await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
            checkoutSessionId: session.id,
        },
    })

    return { redirectUrl: session.url };
}

export async function createBillingPortalSession(loggedInUser: User) {
    const portalSession = await stripe.billingPortal.sessions.create({
        customer: loggedInUser.stripeCustomerId!,
        return_url: `${process.env.APP_URL}/account`,
    });
    assert(portalSession, 'Failed to create billing portal session', 500);
    return { redirectUrl: portalSession.url };
}

export async function upsertStripeSubscriptionFromWebhook(subscription: Stripe.Subscription) {
    assert(subscription, 'Subscription is required', 400);

    const transactionId = subscription.metadata?.transactionId;
    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId! },
    });
    assert(transaction, 'Transaction not found in upsertStripeSubscriptionFromWebhook', 400);

    // we find this by the transaction because sometimes the user doesn't have a stripe customer id yet
    const user = await prisma.user.findFirst({
        where: { id: transaction.userId },
    });
    assert(user, 'User not found in upsertStripeSubscriptionFromWebhook', 400);

    const item = subscription.items?.data?.[0] as Stripe.SubscriptionItem | undefined;
    assert(item, 'No subscription item found on subscription object', 400);

    // Determine interval
    let interval: 'MONTHLY' | 'YEARLY' = 'MONTHLY';
    if (item.price && item.price.recurring && item.price.recurring.interval === 'year') {
        interval = 'YEARLY';
    }

    await prisma.stripeSubscription.upsert({
        where: { userId: user.id },
        update: {
            status: subscription.status.toUpperCase() as SubscriptionStatus,
            quantity: item.quantity ?? 1,
            stripeSubscriptionItemId: item.id,
            billingInterval: interval,
        },
        create: {
            userId: user.id,
            stripeSubscriptionId: subscription.id,
            status: subscription.status.toUpperCase() as SubscriptionStatus,
            quantity: item.quantity ?? 1,
            stripeSubscriptionItemId: item.id,
            billingInterval: interval,
        },
    });
}

export async function updateUserFromCheckoutSession(session: Stripe.Checkout.Session) {
    const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id

    assert(customerId, 'Customer ID is missing', 400);
    assert(session.metadata, 'Session metadata is missing', 400);
    const transactionId = session.metadata.transactionId;
    assert(
        transactionId,
        `Missing session.metadata.transactionId! metadata = ${JSON.stringify(session.metadata)}`,
        400,
        () => {
            console.error('=====Missing session.metadata.transactionId! metadata =', session.metadata);
        }
    );

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
    });
    assert(transaction, 'Transaction not found', 400);

    const updatedUser = await prisma.user.update({
        where: { id: transaction.userId },
        data: {
            stripeCustomerId: customerId,
        },
    });

    assert(updatedUser, 'Failed to update user', 500);
    
    return { userId: updatedUser.id, userStripeCustomerId: updatedUser.stripeCustomerId };
}