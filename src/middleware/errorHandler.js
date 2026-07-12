const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      message: 'Validation Error',
      errors
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      message: `${field} already exists`
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID format'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }

  // 500(예상치 못한 오류)은 내부 메시지를 클라이언트에 노출하지 않는다 (#694).
  // err.status 가 명시된 4xx 는 의도된 사용자 메시지로 보고 그대로 전달.
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';
  const message =
    status >= 500 && !isDev
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    message,
    ...(isDev && { stack: err.stack })
  });
};

module.exports = errorHandler;