const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Sendrey API',
    description: 'Sendrey API documentation'
  },
  host: 'sendrey-server-api.onrender.com',
  // host: 'localhost:4000',
  basePath: '/',
  schemes: ['https'],
  // schemes: ['http']
};

const outputFile = './sendrey-documentation.json';
const routes = ['./app.js']; // po

swaggerAutogen(outputFile, routes, doc);

// node swagger.js
// http://localhost:4000/docs/