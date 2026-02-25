import { Request, Response, NextFunction } from 'express';

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Placeholder auth: allow when explicit admin marker is present.
  // Future: replace with JWT/session role verification.
  const roleHeader = (req.headers['x-admin-role'] || req.headers['x-role']) as string | undefined;
  const role = (roleHeader || '').toLowerCase();

  if (role === 'admin') {
    return next();
  }

  return res.status(403).json({ error: 'Admin access required' });
}
