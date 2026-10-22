window.JOURNAL.push({
  number: '027',
  title: 'Release pipeline and download page',
  version: 'dist',
  mergedDate: '2026-10-22',
  technologies: [
    'GitHub Actions',
    'SHA-256 checksums',
    'Ed25519 signatures',
    'Content-Security-Policy',
    'GitHub REST API',
    'Inline SVG',
    'Node test runner',
  ],
  oneLine:
    'Pushing a version tag now builds the installer on GitHub, one local command signs it and writes a download page, and the page shows how many times the app was downloaded.',

  what: {
    summary:
      'Before this, a release meant running the build, the installer and the signing script by hand and copying the results around. Now a tag like `v0.2.0` starts a GitHub workflow that tests, packages and builds the installer on a clean Windows machine and files everything as a draft release with a checksum list. Then `pnpm release:sign` checks the files against that list, signs the update manifest with a key that never leaves the maintainer’s computer, and writes `docs/index.html`, a small download website with a live download counter.',
    partsTouched: [
      {
        path: '.github/workflows/release.yml',
        note: 'Runs on a version tag: checks the tag, tests, packages, builds the installer, writes SHA256SUMS, creates a draft release',
        changed: true,
      },
      {
        path: 'scripts/lib/release.mjs',
        note: 'Pure helpers: read the checksum list, check the tag, fill in the page template, total the downloads',
        changed: true,
      },
      {
        path: 'scripts/lib/release-flow.mjs',
        note: 'The checks behind `release:sign`: compare files with the checksums, sign, render the page',
        changed: true,
      },
      {
        path: 'scripts/lib/sign.mjs',
        note: 'Signing code moved out of `sign-manifest.mjs` so both scripts share it',
        changed: true,
      },
      {
        path: 'scripts/release-sign.mjs',
        note: 'The command the maintainer runs after the build',
        changed: true,
      },
      {
        path: 'scripts/release-ci.mjs',
        note: 'Two small steps for the workflow: check the tag, write the checksum file',
        changed: true,
      },
      {
        path: 'docs/site',
        note: 'The page template, its stylesheet and the script for the theme picker and the live download count',
        changed: true,
      },
      {
        path: 'docs',
        note: 'ADR-012, a "Publishing a release" section, and a security note about the page’s one request',
        changed: true,
      },
      {
        path: 'apps',
        note: 'Untouched: this is release tooling, the app itself did not change',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'GitHub builds the release, but the maintainer signs it on their own machine',
        insteadOf: 'Storing the signing key as a GitHub secret so the workflow can sign too',
        reason:
          'The whole point of the signature (ADR-011) is that someone who takes over the GitHub account still cannot ship an update. A key stored in that same account would remove that protection. The cost is one extra command per release. Recorded as ADR-012.',
      },
      {
        chose: 'A SHA256SUMS file made by the workflow, checked again before signing',
        insteadOf: 'Signing whatever file is downloaded',
        reason:
          'The checksum list ties the signed manifest to exactly the file the workflow built. If the installer is swapped or damaged on the way, `release:sign` refuses and writes nothing.',
      },
      {
        chose: 'Write the version, size and hash into the page when the release is signed',
        insteadOf: 'A page that asks the GitHub API for the latest release every time it loads',
        reason:
          'The page is complete without any script, loads fast and works offline. The only live request left is the optional download counter.',
      },
      {
        chose: 'A live download counter that falls back to the number written at release time',
        insteadOf: 'No counter, or a tracking service',
        reason:
          'GitHub already counts how many times each release file is downloaded, so no tracker is needed. The page makes one request to the GitHub API for it. If that fails, the old number stays and nothing looks broken. The counter counts downloads, not installs.',
      },
      {
        chose: 'A draft release at first',
        insteadOf: 'Publishing straight from the workflow',
        reason:
          'Nothing is public until the manifest is signed and merged, so the download page and the in-app updater can never point at a file that is not ready.',
      },
      {
        chose: 'The workflow uses the `gh` tool that GitHub’s runners already have, and the maintainer’s machine does not need it',
        insteadOf: 'A third-party release action, or making `gh` mandatory on the maintainer’s machine',
        reason:
          'No new packages and no extra setup. `release:sign` can read three files you downloaded by hand with `--dir`.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '024', note: 'the packaged build that the workflow runs with `pnpm package`' },
      { spec: '025', note: 'the installer that the workflow builds and the page offers' },
      { spec: '026', note: 'the signed manifest and the signing code that `release:sign` reuses' },
    ],
    unlocks: [
      { spec: '011', note: 'v0.2 features can now be shipped to people with a tag and one command' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Tag the release',
        explanation:
          'The maintainer tags `main` as `vX.Y.Z` and pushes the tag. That push is what starts the workflow.',
      },
      {
        title: 'The workflow checks the tag first',
        explanation:
          '`release-ci.mjs check-tag` fails at once unless the tag is `v` plus the version in `package.json`. A mismatched tag never builds anything.',
      },
      {
        title: 'Build on a clean machine',
        explanation:
          'It installs, runs `pnpm test`, downloads the Electron binary, runs `pnpm package` and `pnpm installer`, then writes `SHA256SUMS` for the installer and the zip.',
      },
      {
        title: 'Create a draft release',
        explanation:
          '`gh release create --draft` attaches the installer, the zip and the checksum file. Only people with write access can see a draft.',
      },
      {
        title: 'Check and sign on the maintainer’s machine',
        explanation:
          '`pnpm release:sign` gets the three files (with `gh`, or from a folder with `--dir`) and compares each hash with `SHA256SUMS`. If anything differs it stops. Otherwise it signs the manifest with the private key file.',
      },
      {
        title: 'Render the page',
        explanation:
          'The version, size, short hash and download total are filled into `index.template.html`. Every value is escaped, and the render refuses bad input, such as a hash that is not 64 hex characters.',
      },
      {
        title: 'Merge, then publish',
        explanation:
          'The manifest and page go to `main` in a pull request. Then the draft is published, and GitHub Pages serves the page and the manifest.',
      },
      {
        title: 'A visitor opens the page',
        explanation:
          '`site.js` adds the theme picker and asks the GitHub API for the download counts. It adds up the installer and zip downloads and updates the number. If the request fails, the number from release time stays.',
      },
    ],
  },

  code: [
    {
      file: '.github/workflows/release.yml',
      excerpt: `      - name: Check the tag matches package.json
        run: node scripts/release-ci.mjs check-tag "\${{ github.ref_name }}"

      - run: pnpm install --frozen-lockfile
      - run: pnpm test

      # Electron downloads its binary on first run, not at install, so fetch it here for the package step.
      - name: Download the Electron binary
        run: node apps/host/node_modules/electron/install.js

      - run: pnpm package`,
      explanation:
        'The start of the build. The tag check is the very first step, so a wrong tag costs seconds, not a full build. The Electron step is there because of a bug found while testing (see Bugs).',
    },
    {
      file: 'scripts/lib/release-flow.mjs',
      excerpt: `  for (const [name, bytes] of [
    [installerName(version), installer],
    [zipName(version), zip]
  ]) {
    const expected = sums.get(name);
    if (!expected) throw new Error(\`SHA256SUMS has no entry for \${name}\`);
    if (bytes.length === 0) throw new Error(\`\${name} is empty\`);
    if (sha256Hex(bytes) !== expected) {
      throw new Error(
        \`\${name} does not match SHA256SUMS, so it was not signed. Download it again or rebuild the release.\`
      );
    }
  }`,
      explanation:
        'The gate in front of the signature. A missing entry, an empty file and a different hash all throw before anything is signed. The function gets `readAsset` as an argument, so the tests feed it fake files.',
    },
    {
      file: 'scripts/lib/release.mjs',
      excerpt: `export function parseSums(text) {
  const sums = new Map();
  text.split(/\\r?\\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    const match = SUMS_LINE.exec(line);
    if (!match) throw new Error(\`SHA256SUMS line \${index + 1} is not "<sha256>  <file name>"\`);
    sums.set(match[2], match[1].toLowerCase());
  });
  return sums;
}`,
      explanation:
        'Reads the same format as the `sha256sum` tool: a 64 character hash, a space, then a file name. A line that does not fit is an error with its line number, not something to skip.',
    },
    {
      file: 'scripts/lib/release.mjs',
      excerpt: `// The download page script holds the count logic; loading it here keeps one implementation.
const site = createRequire(import.meta.url)('../../docs/site/site.js');

/** Total downloads across published releases (installer and zip only). */
export const sumDownloads = site.sumDownloads;`,
      explanation:
        'The page’s script is a plain browser script, but it also exports its two pure functions when Node loads it. The release script and the tests reuse them, so the number written at release time and the live number are computed the same way.',
    },
    {
      file: 'docs/site/site.js',
      excerpt: `  function sumDownloads(releases) {
    if (!Array.isArray(releases)) return 0;
    var total = 0;
    releases.forEach(function (release) {
      if (!release || release.draft || !Array.isArray(release.assets)) return;
      release.assets.forEach(function (asset) {
        if (!asset || typeof asset.name !== 'string' || !/\\.(exe|zip)$/i.test(asset.name)) return;
        var n = asset.download_count;
        if (typeof n === 'number' && isFinite(n) && n > 0) total += Math.floor(n);
      });
    });
    return total;
  }`,
      explanation:
        'It trusts nothing in the API answer: every level is checked before it is used. Only `.exe` and `.zip` files count, so the checksum file does not inflate the total, and drafts are skipped.',
    },
    {
      file: 'docs/site/index.template.html',
      excerpt: `    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src https://api.github.com; base-uri 'none'; form-action 'none'"
    />`,
      explanation:
        'The page’s promise written as a browser rule. Everything is blocked by default, styles and scripts may only come from the page’s own folder, and the one allowed outside request is the GitHub API. This is also why the page has no inline `style` attributes.',
    },
  ],

  concepts: [
    {
      name: 'Checksums and signatures together',
      level: 'Core',
      explanation:
        'A checksum shows a file was not changed. A signature shows who vouched for it. The workflow publishes checksums, the maintainer checks them, and the signature then covers the exact hash. Neither is enough alone: a checksum next to a swapped file could be swapped too, and a signature is only worth something if it covers the right bytes.',
      resources: [
        { title: 'Node.js docs: crypto.createHash', url: 'https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options' },
        { title: 'Node.js docs: crypto.sign', url: 'https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback' },
        { title: 'IETF RFC 6234: US Secure Hash Algorithms', url: 'https://www.rfc-editor.org/rfc/rfc6234' },
      ],
    },
    {
      name: 'Trust boundary',
      level: 'Core',
      explanation:
        'Some machines are trusted with secrets and some only with building. Here GitHub is trusted to build but not to sign, so a stolen GitHub account cannot produce an update the app accepts. Deciding where the secret lives is the main design choice of this spec.',
      resources: [
        { title: 'IETF RFC 8032: Ed25519', url: 'https://www.rfc-editor.org/rfc/rfc8032' },
      ],
    },
    {
      name: 'Workflows triggered by a tag',
      level: 'Concept',
      explanation:
        'A workflow file runs for a tag only if that file exists in the tagged commit. The workflow runs on a clean machine every time, so anything that worked on your computer only because of an earlier run (like a downloaded binary) shows up as a failure.',
      resources: [
        { title: 'GitHub Docs: workflow syntax, on.push.tags', url: 'https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#onpushbranchestagsbranches-ignoretags-ignore' },
      ],
    },
    {
      name: 'Content-Security-Policy',
      level: 'Concept',
      explanation:
        'A rule the browser enforces about where a page may load things from. A policy in a `<meta>` tag works on GitHub Pages, where you cannot set response headers. Writing the page without inline styles or scripts is what lets the policy stay strict.',
      resources: [
        { title: 'MDN: Content-Security-Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP' },
        { title: 'W3C: Content Security Policy Level 3', url: 'https://www.w3.org/TR/CSP3/' },
      ],
    },
    {
      name: 'Progressive enhancement',
      level: 'Pattern',
      explanation:
        'The page is complete as plain HTML and CSS. The script only adds extras: a theme picker (hidden until the script runs) and a fresher download number. With scripts blocked, offline or rate limited, nothing is broken.',
      resources: [
        { title: 'MDN: Progressive enhancement', url: 'https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement' },
        { title: 'MDN: Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API' },
      ],
    },
    {
      name: 'Themes with CSS custom properties',
      level: 'Concept',
      explanation:
        'Every colour on the page is a variable. A theme is a block that redefines the variables on `<html>`, so switching themes changes one attribute. Colours inside the SVG picture come from CSS classes for the same reason, and the picture changes with the theme.',
      resources: [
        { title: 'MDN: Using CSS custom properties', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties' },
        { title: 'MDN: prefers-reduced-motion', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion' },
      ],
    },
    {
      name: 'One file for browser and Node',
      level: 'Pattern',
      explanation:
        'A script can check whether `module` exists and export its functions only when Node loads it. Node’s `createRequire` lets an ES module load such a file. The page and the release script then share one tested function.',
      resources: [
        { title: 'Node.js docs: module.createRequire', url: 'https://nodejs.org/api/module.html#modulecreaterequirefilename' },
      ],
    },
    {
      name: 'Dependency injection for tests',
      level: 'Pattern',
      explanation:
        '`signRelease` is given `readAsset` and `fetchJson` instead of reading files and calling the network itself. Tests pass fakes, so the tampered installer and offline cases run in milliseconds, with no GitHub and no 150 MB files.',
      resources: [
        { title: 'Node.js docs: test runner', url: 'https://nodejs.org/api/test.html' },
      ],
    },
  ],

  bugs: [
    {
      symptom:
        'The first test tag pushed to GitHub started no workflow run at all. The Actions tab stayed empty.',
      cause:
        'The tag was pushed from a throwaway branch where only `package.json` had been committed. The workflow file was still an uncommitted file on disk, so the tagged commit did not contain `release.yml`, and GitHub only runs workflows that exist in the tagged commit.',
      fix:
        'Committed the spec work on its branch, deleted the test tag and branch, and made the throwaway branch from the spec branch. The test guide now says plainly that the work must be committed before tagging.',
    },
    {
      symptom:
        'The release run failed at `pnpm package` with "Electron is not installed" after the tests had passed.',
      cause:
        'Electron 44 does not download its binary when you install it. It downloads on first run. On a developer machine that had launched the app once, the binary was already there. The clean runner never starts Electron, so the file was missing.',
      fix:
        'Added a workflow step that runs Electron’s own `install.js` before packaging, reworded the error message to name that command, and updated `DEPLOYMENT.md`.',
    },
    {
      symptom:
        'In a screenshot of the finished page the numbers inside the three step circles were almost invisible.',
      cause:
        'A rule meant to colour the grey description text, `.step span`, also matched the number badge, which is a `span` too, and turned its text grey on the amber circle.',
      fix:
        'Narrowed the rule to `.step p span`. Found by looking at the rendered page during the build, before manual testing.',
    },
    {
      symptom:
        'On the test page, the Download button led to a GitHub 404 page.',
      cause:
        'Not a code bug. The release was still a draft in a private repository, and GitHub does not serve draft files at the public address the button uses.',
      fix:
        'No change to the page. The release order is: sign, merge the page and manifest, then publish the release, so the link works as soon as the page goes live. Recorded in the deployment notes.',
    },
  ],

  quiz: [
    {
      question: 'Why does the release workflow build the installer but not sign the manifest?',
      answer:
        'The signing key must stay off GitHub. If someone took over the GitHub account they could swap the installer, but without the key they cannot make a signature the app accepts.',
    },
    {
      question: 'What does `release:sign` do if the downloaded installer has been changed?',
      answer:
        'It compares the file’s SHA-256 with `SHA256SUMS`, finds a difference, stops with "does not match SHA256SUMS, so it was not signed", and writes no manifest and no page.',
    },
    {
      question: 'Why did the first test tag not start a workflow?',
      answer:
        'The workflow file was not in the tagged commit. A tag runs the workflow files that exist at that commit, so uncommitted files are not used.',
    },
    {
      question: 'The page cannot reach GitHub. What does the visitor see for the download count?',
      answer:
        'The number written into the page at release time. The request fails quietly and nothing looks broken. If that number is 0, the line is hidden.',
    },
    {
      question: 'Why does the download count not measure how many people use PilotPane?',
      answer:
        'It counts download requests from GitHub. People download more than once, bots download too, and in-app updates download the same installer. It says nothing about installs, and the app sends nothing back.',
    },
  ],

  commits: [
    'docs: add download page design and privacy note',
    'docs: add spec 027 release pipeline',
    'feat(tooling): add release helpers and shared signing code',
    'feat(site): add download page template and styles',
    'feat(tooling): add release-sign script and workflow helpers',
    'chore(ci): add tag-triggered release workflow',
    'docs: document release flow and add ADR-012',
    'fix(ci): download the Electron binary before packaging',
    'docs: explain the Electron binary download for packaging',
  ],
});
