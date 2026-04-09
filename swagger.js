const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Sendrey API',
    description: 'Sendrey API documentation'
  },
  host: 'sendrey-server-api.onrender.com',
  basePath: '/api/v1'
};

const outputFile = './sendrey-documentation.json';
const routes = ['./app.js']; // po

swaggerAutogen(outputFile, routes, doc);

// node swagger.js
// http://localhost:4000/docs/