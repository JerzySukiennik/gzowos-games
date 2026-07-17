import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64urlEncode(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  return Buffer.from(bytes).toString('base64url');
}

export function base64urlDecode(value) {
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid base64url encoding');
  const decoded=new Uint8Array(Buffer.from(value,'base64url'));
  if(base64urlEncode(decoded)!==value)throw new Error('Non-canonical base64url encoding');
  return decoded;
}

export function decodeJsonPart(value) {
  return JSON.parse(decoder.decode(base64urlDecode(value)));
}

export async function generateES256KeyPair({ kid = webcrypto.randomUUID() } = {}) {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, kid };
}

export async function importES256PrivateJwk(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function importES256PublicJwk(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

export async function exportPublicJwk(publicKey, kid) {
  const jwk = await subtle.exportKey('jwk', publicKey);
  return { ...jwk, kid, use: 'sig', alg: 'ES256', key_ops: ['verify'] };
}

export async function createJwks(keys) {
  return { keys: await Promise.all(keys.map(key => exportPublicJwk(key.publicKey, key.kid))) };
}

export async function signES256(payload, { privateKey, kid }, header = {}) {
  if (!privateKey || !kid) throw new Error('An ES256 private key and kid are required');
  const protectedHeader = { typ: 'JWT', alg: 'ES256', kid, ...header };
  if (protectedHeader.alg !== 'ES256') throw new Error('Only ES256 is supported');
  const encodedHeader = base64urlEncode(JSON.stringify(protectedHeader));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(signingInput));
  return `${signingInput}.${base64urlEncode(signature)}`;
}

export async function verifyES256(token, { jwks, now = Math.floor(Date.now() / 1000), issuer, audience } = {}) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Signed launch token must be compact JWS');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if(base64urlDecode(encodedSignature).length!==64)throw new Error('ES256 signature must be 64 bytes');
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);
  if (header.alg !== 'ES256' || !header.kid) throw new Error('Unsupported JWS header');
  const jwk = jwks?.keys?.find(key => key.kid === header.kid && key.alg === 'ES256' && key.use === 'sig');
  if (!jwk) throw new Error('Unknown signing key');
  const key = await importES256PublicJwk(jwk);
  const valid = await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64urlDecode(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) throw new Error('Invalid launch token signature');
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= now || payload.iat > now + 30) throw new Error('Launch token is expired or has invalid timestamps');
  if (payload.exp - payload.iat > 300) throw new Error('Launch token lifetime exceeds five minutes');
  if (issuer && payload.iss !== issuer) throw new Error('Launch token issuer mismatch');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (audience && !audiences.includes(audience)) throw new Error('Launch token audience mismatch');
  if(typeof payload.jti!=='string'||payload.jti.length<16||typeof payload.nonce!=='string'||payload.nonce.length<16)throw new Error('Launch token identifiers are invalid');
  return { header, payload };
}
