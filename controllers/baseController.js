class BaseController {
  constructor(service) {
    this.service = service;
  }

  success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  error(res, message = 'Error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  created(res, data, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, 400, errors);
  }
}

module.exports = BaseController;