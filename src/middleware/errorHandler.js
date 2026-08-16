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

  // multer 자체 오류 (#842) — 용량 초과 등이 status 없이 올라와 500 으로 은닉되던 것.
  // 용량 초과는 사용자가 직접 고칠 수 있는 문제라 상한을 함께 알려준다.
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limitMb = Math.floor((parseInt(process.env.MAX_FILE_SIZE) || 30 * 1024 * 1024) / (1024 * 1024));
      return res.status(413).json({
        message: `파일이 너무 큽니다. 업로드 상한은 ${limitMb}MB 입니다.`
      });
    }
    return res.status(400).json({ message: `업로드 오류: ${err.message}` });
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