exports.CustomError = class CustomError extends Error {
    /**
     * generates a custom Error
     * @param {string} type Errortype
     * @param {string} message default Error Message
     * @param {string} [stack] stacktrace 
     */
    constructor(type, message, stack) {
        super(message);
        this.name = type;
        this.stack = stack;
    }
};