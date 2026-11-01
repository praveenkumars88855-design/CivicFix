export function errorMiddleware(error, _request, response, _next) {
  if (error.name === 'MulterError') {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return response.status(status).json({ message: error.message });
  }

  if (error.name === 'ValidationError') {
    return response.status(400).json({ message: error.message });
  }

  if (error.name === 'CastError') {
    return response.status(400).json({ message: 'The supplied identifier is invalid' });
  }

  if (error.code === 11000) {
    return response.status(409).json({ message: 'An account with that email already exists' });
  }

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return response.status(status).json({
    message: status >= 500 ? 'An unexpected server error occurred' : error.message,
  });
}
