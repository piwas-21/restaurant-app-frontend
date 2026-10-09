const FINGERPRINT = /^[0-9a-f]{64}$/;

/** Derive a non-reversible, per-visit participant binding for sessionStorage recovery records. */
export async function fingerprintGuestParticipant(token: string): Promise<string | null> {
  if (!token) return null;
  return fingerprintText(token);
}

export async function fingerprintText(value: string): Promise<string | null> {
  const secureCrypto = globalThis.crypto;
  if (!secureCrypto?.subtle || typeof TextEncoder === 'undefined') return null;
  let digest: ArrayBuffer | null = null;
  try {
    const bytes = new TextEncoder().encode(value);
    digest = await secureCrypto.subtle.digest('SHA-256', bytes);
  } catch (_error) {
    // WebCrypto failure prevents guest payment authorization and therefore fails closed.
  }
  if (!digest) return null;
  const fingerprint = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  return FINGERPRINT.test(fingerprint) ? fingerprint : null;
}
