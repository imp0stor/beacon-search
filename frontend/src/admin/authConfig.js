import { generateToken, getRole, hexToNpub, verifyAuthEvent } from '@strangesignal/nostr-auth';

const ownerNpubs = (process.env.REACT_APP_OWNER_NPUBS || process.env.OWNER_NPUBS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const adminNpubs = (process.env.REACT_APP_ADMIN_NPUBS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const nostrAuthConfig = {
  owners: ownerNpubs,
  admins: adminNpubs,
  jwt: {
    secret: process.env.REACT_APP_JWT_SECRET || process.env.JWT_SECRET || 'beacon-dev-secret-change-me',
    expiresIn: '7d'
  },
  storageKey: 'beacon_nostr_auth_token'
};

export async function authEventToToken(authEvent) {
  if (!verifyAuthEvent(authEvent)) {
    throw new Error('Invalid Nostr auth event');
  }

  const npub = hexToNpub(authEvent.pubkey);
  const role = getRole(npub, nostrAuthConfig);

  if (role === 'user') {
    throw new Error('This Nostr account is not allowed to access admin');
  }

  return generateToken(npub, role, nostrAuthConfig.jwt.secret, nostrAuthConfig.jwt.expiresIn);
}
