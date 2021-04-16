exports.CustomError = class CustomError extends Error {
    constructor(type, message, stack) {
        super(message);
        this.name = type;
        this.stack = stack
    }
}