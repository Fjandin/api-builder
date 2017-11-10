const Boom = require('boom');
const Joi = require('joi');
const settings = require('./settings');

module.exports = function createRoute(router, method, path, o = {}) {
    const middlewares = [];

    // Validate options
    const result = Joi.validate({...o, method, path}, {
        method: Joi.string().required().valid('all', 'options', 'get', 'post', 'patch', 'delete'),
        path: Joi.string().required(),
        auth: Joi.alternatives().try(Joi.object(), Joi.boolean()).required().allow(null),
        validate: Joi.object({
            headers: Joi.object(),
            query: Joi.object(),
            params: Joi.object(),
            body: Joi.object(),

        }),
        response: Joi.alternatives().try(Joi.object(), Joi.array()),
        controller: Joi.func().required(),
        preload: Joi.func()
    });

    if (result.error) {
        throw result.error;
    }
    const options = result.value;

    if (!['AsyncFunction', 'Function'].includes(options.controller.constructor.name)) {
        throw new Error('Controller method must be a AsyncFunction or Function');
    }

    if (options.preload && !['AsyncFunction', 'Function'].includes(options.preload.constructor.name)) {
        throw new Error('Preload method must be a AsyncFunction or Function');
    }

    // Pre middleware
    if (options.preMiddleware) {
        middlewares.push(...options.preMiddleware);
    }

    // Validation
    if (options.validate) {
        options.validate.headers && middlewares.push(validateMiddleware.bind(null, 'headers', options.validate.headers));
        options.validate.query && middlewares.push(validateMiddleware.bind(null, 'query', options.validate.query));
        options.validate.params && middlewares.push(validateMiddleware.bind(null, 'params', options.validate.params));
        options.validate.body && middlewares.push(validateMiddleware.bind(null, 'body', options.validate.body));
    }

    // Preload data
    if (options.preload) {
        middlewares.push(preloadData.bind(null, options.preload));
    }

    // Authentication / Authorization
    if (options.auth) {
        middlewares.push(authenticate);
        if (options.auth !== true) {
            middlewares.push(authorize.bind(null, options.auth));
        }
    }

    // Controller / response validate
    middlewares.push(controllerMiddleware.bind(null, options.controller, options.response));

    // Post middleware
    if (options.postMiddleware) {
        middlewares.push(...options.postMiddleware);
    }

    // Inject route
    router[method](path, middlewares);

    return router;
};

function authenticate(req, res, next) {
    const authenticateMiddleware = settings.get().authenticateMiddleware;
    if (!authenticateMiddleware) {
        return next();
    }
    return authenticateMiddleware(req, res, next);
}

function authorize(auth, req, res, next) {
    const authorizeMiddleware = settings.get().authorizeMiddleware;
    if (!authorizeMiddleware) {
        return next();
    }
    return authorizeMiddleware(req, res, next);
}

async function preloadData(method, req, res, next) {
    res.locals.data = await method(req);
    next();
}

async function controllerMiddleware(controller, schema, req, res, next) {
    let response;
    try {
        switch (controller.constructor.name) {
            case 'Function':
                response = controller(req, res);
                break;
            case 'AsyncFunction':
                response = await controller(req, res);
                break;
        }

        if (res.headersSent) {
            next();
            return;
        }
        if (response === null) {
            res.status(204).end();
            next();
            return;
        }
        if (schema) {
            Joi.validate(response, schema, {allowUnknown: true, stripUnknown: false}, (error, value) => {
                if (error) {
                    return next(error);
                }
                res.status(200).json(value);
                return next();
            });
        } else {
            res.status(200).json(response);
            next();
        }
    } catch (e) {
        if (e.isJoi) {
            next(new Boom('Bad response', {statusCode: 500, data: e.details}));
            return;
        }
        next(e);
    }
}

function validateMiddleware(reqProp, schema, req, res, next) {
    try {
        Joi.validate(req[reqProp], schema, {allowUnknown: true, stripUnknown: false}, (error, value) => {
            if (error) {
                next(error);
                return;
            }
            req[reqProp] = value;
        });
    } catch (error) {
        next(error);
        return;
    }
}
