import { ZodError } from 'zod';
import { config } from '../config.js';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function notFound(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
}

// Every failure leaves the API in one shape: { error: { code, message, fields? } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', fields },
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'That record already exists.' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (config.env !== 'test') console.error(err);
  return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side.' } });
}
