const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next(); // Don't forget to call next()
};

module.exports = {
  requestLogger
};