import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const msg = err?.message || (err ? JSON.stringify(err) : 'Unknown error');
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, msg);
  console.error('Full error:', err);
  res.status(500).json({ success: false, error: msg });
}
