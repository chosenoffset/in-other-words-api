import { ApiError } from "./error.js"

export const assert: <T>(
    data: T,
    message?: string,
    status?: number,
    callback?: () => void
) => asserts data is NonNullable<T> = (
    data,
    message = 'Required data is missing',
    status = 400,
    callback
) => {
    if (data === undefined || data === null) {
        if (callback) {
            callback()
        }
        throw new ApiError(status, message)
    }
}