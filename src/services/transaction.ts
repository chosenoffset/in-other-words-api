import { prisma } from "../config/prisma.js";
import { TransactionStatus, TransactionType, User } from "@prisma/client";

export async function getTransactionById(loggedInUser: User, id: string) {
    return await prisma.transaction.findUnique({
        where: { id, userId: loggedInUser.id }
    })
}
