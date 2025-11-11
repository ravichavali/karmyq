import crypto from 'crypto';

/**
 * Generate RSA keypair for instance identity
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * Sign data with private key
 */
export function signData(data: string, privateKey: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify signature with public key
 */
export function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Create canonical representation of activity for signing
 */
export function canonicalizeActivity(activity: any): string {
  // Sort keys alphabetically and stringify
  const sortedKeys = Object.keys(activity).sort();
  const canonical: any = {};
  for (const key of sortedKeys) {
    canonical[key] = activity[key];
  }
  return JSON.stringify(canonical);
}
