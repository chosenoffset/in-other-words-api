import { Router } from "express";
import { Stripe } from "stripe";
import { prisma } from "../../config/prisma.js";
import { upsertStripeSubscriptionFromWebhook, updateUserFromCheckoutSession } from "../../services/stripe/subscriptionManagement.js";
import { assert } from "../../utils/assert.js";
import { TransactionStatus, SubscriptionStatus } from "@prisma/client";

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-08-27.basil"
})

router.post("/stripe", async (req, res) => {
    const sig = req.headers['stripe-signature']

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).send('Missing Stripe signature or webhook secret')
    }

    let event: Stripe.Event

    try {
        event = await stripe.webhooks.constructEventAsync(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (error: any) {
        console.error('Webhook signature verification failed', error)
        return res.status(400).send(` Webhook Error: ${error.message}`)
    }

    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.paused':
        case 'customer.subscription.resumed':
            const subscription = event.data.object as Stripe.Subscription
            const transactionId = subscription.metadata?.transactionId;

            if (transactionId) {
                const transaction = await prisma.transaction.findUnique({
                    where: { id: transactionId },
                    include: { user: true }
                })
                
                if (!transaction) {
                    // TODO: we should log this in the future...
                    console.error('Transaction not found')
                    break
                }

                await prisma.transaction.update({
                    where: { id: transactionId },
                    data: {
                        status: 'COMPLETED'
                    }
                })
            }

            await upsertStripeSubscriptionFromWebhook(subscription)
            break
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await updateUserFromCheckoutSession(session);
            break;
        }
        case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            // Find the subscription and set status to UNPAID, notify user?
            const subscriptionId = invoice.parent?.subscription_details?.subscription;
            let subscription: Stripe.Subscription;
            if (typeof subscriptionId === 'string') {
                subscription = await stripe.subscriptions.retrieve(subscriptionId);
            } else {
                subscription = subscriptionId!;
            }
            await upsertStripeSubscriptionFromWebhook(subscription);

            if (subscription && subscription.id) {
                const transaction = await prisma.transaction.findFirst({
                    where: { subscriptionId: subscription.id }
                });
                assert(transaction, 'Transaction not found', 400);
                
                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { status: TransactionStatus.FAILED }
                });
            }
            break;
        }
        case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;

            const transactionId = invoice.parent?.subscription_details?.metadata?.transactionId;
            assert(transactionId, 'Transaction ID not found in "invoice.payment_succeeded" webhook', 400);
            const transaction = await prisma.transaction.findFirst({
                where: { id: transactionId }
            });
            assert(transaction, 'Transaction not found in "invoice.payment_succeeded" webhook', 400);
            
            // get the subscription from stripe...
            const subscriptionId = invoice.parent?.subscription_details?.subscription;
            let subscription: Stripe.Subscription;
            if (typeof subscriptionId === 'string') {
                subscription = await stripe.subscriptions.retrieve(subscriptionId);
            } else {
                subscription = subscriptionId!;
            }

            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: TransactionStatus.COMPLETED }
            });

            await upsertStripeSubscriptionFromWebhook(subscription);
            break;
        }

        case "customer.deleted": {
            const customer = event.data.object;
            const user = await prisma.user.findFirst({
                where: { stripeCustomerId: customer.id },
            });
            assert(user, 'User not found in "customer.deleted" webhook', 400);
            // Set their subscription to CANCELED
            await prisma.stripeSubscription.update({
                where: { userId: user!.id },
                data: { status: SubscriptionStatus.CANCELED }
            });
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await upsertStripeSubscriptionFromWebhook(subscription);
            break;
        }
        default:
            console.log('Unhandled event type', event.type)
    }

    return res.json({ received: true })
})

export default router