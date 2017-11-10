const SETTINGS = {};

module.exports.setAuthenticateMiddleware = (authenticateMiddleware) => {
    SETTINGS.authenticateMiddleware = authenticateMiddleware;
};

module.exports.setAuthorizeMiddleware = (authorizeMiddleware) => {
    SETTINGS.authorizeMiddleware = authorizeMiddleware;
};

module.exports.get = () => SETTINGS;
