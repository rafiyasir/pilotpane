// The checks and renders behind `pnpm release:sign`. Nothing here touches the disk or the network directly:
// the caller passes in readAsset (a released file by name) and fetchJson, so tests can use fakes.
import { renderDownloadPage, parseSums, sumDownloads } from './release.mjs';
import { buildSignedManifest, sha256Hex } from './sign.mjs';

export const installerName = (version) => `PilotPane-Setup-${version}.exe`;
export const zipName = (version) => `PilotPane-${version}-win-x64.zip`;
export const releaseBaseUrl = (repo, version) => `https://github.com/${repo}/releases/download/v${version}/`;

/**
 * Checks the released files against SHA256SUMS, signs the manifest and renders the download page.
 * Refuses (throws) if a file is missing from SHA256SUMS or its hash differs, so a swapped installer is never signed.
 * Returns { manifestText, manifest, pageHtml, downloads }.
 */
export async function signRelease({ version, repo, notes, privateKeyPem, template, readAsset, fetchJson }) {
  const sums = parseSums((await readAsset('SHA256SUMS')).toString('utf8'));
  const installer = await readAsset(installerName(version));
  const zip = await readAsset(zipName(version));

  for (const [name, bytes] of [
    [installerName(version), installer],
    [zipName(version), zip]
  ]) {
    const expected = sums.get(name);
    if (!expected) throw new Error(`SHA256SUMS has no entry for ${name}`);
    if (bytes.length === 0) throw new Error(`${name} is empty`);
    if (sha256Hex(bytes) !== expected) {
      throw new Error(
        `${name} does not match SHA256SUMS, so it was not signed. Download it again or rebuild the release.`
      );
    }
  }

  const base = releaseBaseUrl(repo, version);
  const { text, manifest } = await buildSignedManifest({
    installer,
    version,
    url: base + installerName(version),
    notes,
    privateKeyPem
  });

  // The count is only a nicety on the page: if GitHub does not answer, the page starts at 0 and hides the line.
  let downloads = 0;
  try {
    downloads = sumDownloads(await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`));
  } catch {
    downloads = 0;
  }

  const pageHtml = renderDownloadPage(template, {
    repo,
    version,
    size: manifest.size,
    sha256: manifest.sha256,
    installerUrl: base + installerName(version),
    zipUrl: base + zipName(version),
    downloads
  });
  return { manifestText: text, manifest, pageHtml, downloads };
}
