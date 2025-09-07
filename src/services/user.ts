import { prisma } from '../config/prisma.js'
import { assert } from '../utils/assert.js'

export async function createUserFromClerkId(clerkId: string) {
    const existingUser = await prisma.user.findFirst({
        where: {
            clerkId: clerkId
        }
    })
    
    if (existingUser) {
        return existingUser
    }
    
    const newUser = await prisma.user.create({
        data: {
            clerkId: clerkId,
            role: 'USER',
        }
    })
    assert(newUser, 'Failed to create user')

    return newUser
}