import { Response } from 'express';
import { ApiResponse } from '@storebox/shared';

export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data } satisfies ApiResponse<T>);

export const fail = (res: Response, message: string, status = 500) =>
  res.status(status).json({ success: false, error: message } satisfies ApiResponse);

// Wrapper async — capture toutes les erreurs et les passe à next()
export const wrap = (
  fn: (req: any, res: Response, next: any) => Promise<unknown>
) => (req: any, res: Response, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);
