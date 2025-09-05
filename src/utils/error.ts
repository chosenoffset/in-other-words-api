export class ApiError extends Error {
    status: number;
    message: string;
    stack?: string;
    line?: string

    constructor(status: number, message?: string, stack?: string, line?: string) {
        super(message);
        this.message = message || 'Something went wrong';
        this.status = status || 500;
        if (stack !== undefined) this.stack = stack; 
        if (line !== undefined) this.line = line;

    }
}