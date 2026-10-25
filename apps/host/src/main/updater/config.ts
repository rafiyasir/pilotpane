/** Where updates come from. Both values are public. The private key is never in the repo. */

/** The signed manifest, served by GitHub Pages from `docs/` on `main`. */
export const DEFAULT_MANIFEST_URL = 'https://rafiyasir.github.io/pilotpane/update/manifest.json';

/**
 * Ed25519 public key (PEM) that update manifests must be signed with.
 * To rotate it, run `node scripts/sign-manifest.mjs keygen <folder>` and paste the new public key here.
 */
export const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4TNW1SiX2+r4XXosz067SPa/Ia2QYERPuDXi8xk9cJU=
-----END PUBLIC KEY-----
`;
