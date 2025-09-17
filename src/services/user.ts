import { prisma } from '../config/prisma.js'
import { assert } from '../utils/assert.js'
import { User, UserRole } from '@prisma/client'
import { SessionAuthObject } from '@clerk/express'
import { ApiError } from '../utils/error.js'

export async function createUserFromClerkId(clerkUser: SessionAuthObject) {
    if (!clerkUser || !clerkUser.userId) {
        throw new ApiError(401, 'Unauthorized')
    }
    
    const existingUser = await prisma.user.findFirst({
        where: {
            clerkId: clerkUser.userId
        }
    })
    
    if (existingUser) {
        return existingUser
    }
    
    const newUser = await prisma.user.create({
        data: {
            clerkId: clerkUser.userId,
            role: 'USER',
        }
    })
    assert(newUser, 'Failed to create user')

    return newUser
}

export async function isSuperadmin(user: User) {
    return user.role === UserRole.SUPERADMIN
}

export async function getUserWithSubscription(user: User) {
    const userWithSubscription = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            stripeSubscription: true
        }
    })
    assert(userWithSubscription, 'User not found', 404)
    return userWithSubscription
}