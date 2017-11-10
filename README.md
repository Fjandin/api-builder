# API Builder for express 4

Dependencies
- Boom
- Joi

Peer dependencies
- Express 4

Install
- `yarn add @fjandin/api-builder`

## Usage example
```
const express = require('express');
const apiBuilder = require('@fjandin/api-builder');

cosnt app = express();

createRoute(app, 'get', 'ping', {
    auth: false,
    controller: function ping() {
        return 'pong';
    }
});

app.use(apiBuilder.errorHandler({logging: console}));

app.listen(1337);
```

more examples + documentation underway...
