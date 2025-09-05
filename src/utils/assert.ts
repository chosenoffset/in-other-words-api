import { ApiError } from "./error.js"

export const assert = (data: any, message = 'Required data is missing', status = 400, callback?: () => void) => {
    if (data === undefined || data === null) {
        if (callback) {
            callback()
        }
        else {
            throw new ApiError(status, message)
        }
    }
}