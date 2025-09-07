import { User, UserRole } from "@prisma/client";
import { assert } from "./assert.js";

export function isSuperadmin(loggedInUser: User) {
    assert(loggedInUser.role === UserRole.SUPERADMIN, 'Forbidden', 403)
}

export function isAdmin(loggedInUser: User) {
    assert(loggedInUser.role === UserRole.ADMIN, 'Forbidden', 403)
}

export function isUser(loggedInUser: User) {
    assert(loggedInUser.role === UserRole.USER, 'Forbidden', 403)
}

