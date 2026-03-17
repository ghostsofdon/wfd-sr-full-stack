import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors,
    });
    return;
  }

  const status = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_SERVER_ERROR';
  const message = err.message ?? 'An unexpected error occurred';

  // Never expose stack traces to clients
  console.error(`[${new Date().toISOString()}] ${code}: ${message}`, {
    stack: err.stack,
    details: err.details,
  });

  res.status(status).json({
    error: message,
    code,
    ...(err.details ? { details: err.details } : {}),
  });
}

/** Factory for typed HTTP errors */
export function createError(message: string, statusCode: number, code: string, details?: unknown): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}
