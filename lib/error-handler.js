const Boom = require('boom');
const Joi = require('joi');

function createErrorHandler(o = {}) {
    // Validate options
    const result = Joi.validate(o, {
        errorResponseTransform: Joi.func(),
        logger: Joi.object({
            info: Joi.func().required(),
            warn: Joi.func().required(),
            error: Joi.func().required()
        }).options({allowUnknown: true}).default(console)
    });

    if (result.error) {
        throw result.error;
    }
    const options = result.value;
    const logger = options.logger;

    return function errorHandler(err, req, res, next) {
        let error = err;

        // Check CSRF
        if (err.code === 'EBADCSRFTOKEN') {
            error = Boom.unauthorized();
        }

        // Make sure what we get is a proper error
        if (Object.prototype.toString.call(error) !== '[object Error]') {
            logger.warn('Got non error in errorHandler', {error});
            error = Boom.badImplementation('Non error');
        }

        // wrap Joi error
        if (error.isJoi) {
            error = Boom.badRequest(error.message, error.details);
        }

        // Make sure we always end with a Boom error instance
        if (!Boom.isBoom(error)) {
            error = Boom.boomify(error);
        }

        // Get status code
        const statusCode = error.output.statusCode;
        let payload;

        // Log 500 as error
        if (statusCode === 500) {
            payload = error.output.payload;
            logger.error('ERROR', statusCode, req.method, req.url, error.message, {data: error.data, stacktrace: error.stack});
        // Log 5xx as warn
        } else if (statusCode > 501 || !statusCode) {
            payload = error.output.payload;
            logger.warn('ERROR', statusCode, req.method, req.url, error.message, {data: error.data});
        } else {
            payload = {...error.output.payload, details: error.data || undefined};
            logger.info('ERROR', statusCode, req.method, req.url, error.message);
        }

        if (!res.headersSent) {
            if (options.errorResponseTransform) {
                payload = options.errorResponseTransform(payload);
            }
            res.status(statusCode).json(payload);
        }

        next(err);
    };
}

module.exports = createErrorHandler;
