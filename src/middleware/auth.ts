import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import type { AccountStatus, AdminPermission, UserRole } from '../types.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    fullName: string;
    role: UserRole;
    status: AccountStatus;
    permissions: AdminPermission[];
    avatarUrl: string | null;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email || `${decodedToken.uid}@user.local`;
    const dbUser = await getOrCreateUser(decodedToken.uid, email, decodedToken.name);

    if (dbUser.status === 'suspended' && dbUser.role !== 'admin') {
      return res.status(403).json({
        error: 'This student account has been suspended by an administrator.',
      });
    }

    req.dbUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      email: dbUser.email,
      fullName: dbUser.fullName,
      role: (dbUser.role as UserRole) || 'student',
      status: (dbUser.status as AccountStatus) || 'active',
      permissions: dbUser.permissionsJson || [],
      avatarUrl: dbUser.avatarUrl || null,
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export function requireAdmin(permission?: AdminPermission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.dbUser;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Administrator role required.' });
    }
    if (
      permission &&
      !user.permissions.includes(permission) &&
      !user.permissions.includes('manage_security')
    ) {
      return res.status(403).json({
        error: `Forbidden: Missing required permission (${permission}).`,
      });
    }
    next();
  };
}

export function requireStudentOnly(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.dbUser;
  if (!user || user.role !== 'student') {
    return res.status(403).json({
      error: 'Forbidden: Administrator accounts operate inside the Admin Console.',
    });
  }
  next();
}
