// import { NextFunction, Request, Response } from 'express';
// import { DecodedIdToken } from 'firebase-admin/auth';
// import { adminAuth } from '../lib/firebase-admin.ts';
// import { getOrCreateUser } from '../db/repository.ts';

// export interface AuthRequest extends Request {
//   user?: DecodedIdToken;
// }

// export const requireAuth = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
//   }

//   const token = authHeader.split('Bearer ')[1];
//   try {
//     const decodedToken = await adminAuth.verifyIdToken(token);
//     req.user = decodedToken;

//     if (decodedToken.uid && decodedToken.email) {
//       await getOrCreateUser(
//         decodedToken.uid,
//         decodedToken.email,
//         decodedToken.name || decodedToken.email.split('@')[0]
//       );
//     }

//     next();
//   } catch (error) {
//     console.error('Error verifying Firebase ID token:', error);
//     return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
//   }
// };


import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/repository.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing Bearer token',
    });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const userEmail = decodedToken.email?.trim().toLowerCase();

    if (!adminEmail || !userEmail || userEmail !== adminEmail) {
      return res.status(403).json({
        error: 'Forbidden: You are not an authorized administrator.',
      });
    }

    if (!decodedToken.email_verified) {
      return res.status(403).json({
        error: 'Forbidden: Verified email required.',
      });
    }

    req.user = decodedToken;

    await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email!,
      decodedToken.name || decodedToken.email!.split('@')[0]
    );

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired session token',
    });
  }
};
