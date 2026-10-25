window.JOURNAL.push({
  number: '030',
  title: 'First releases',
  version: 'dist',
  mergedDate: '2026-10-25',
  technologies: ['Git tags', 'GitHub Actions', 'GitHub Releases', 'GitHub Pages', 'Ed25519 signing', 'Branch rulesets', 'Node child_process'],
  oneLine:
    'PilotPane went from a private repo to five public releases, 0.1.0 to 0.4.1, and a real in-app update was run end to end.',

  what: {
    summary:
      'Specs 024 to 028 built a release pipeline, but nothing had been released with it. This work made the repository public, protected its branches, and then released every version in order. Each release was built by GitHub, signed by hand on the maintainer machine, published, downloaded from the site, installed and tested. Versions 0.1.0 to 0.3.0 came from old commits, so they were tagged on short side branches. Testing the real update from 0.2.0 found a bug: the update script locked the install folder, so the installer could never replace it. The fix is one option in 0.4.0, and a release with no other changes, 0.4.1, proved it.',
    partsTouched: [
      {
        path: 'package.json files',
        note: 'Version bumps: 0.4.0 and 0.4.1 on dev, and 0.2.0 and 0.3.0 on side branches that only the tags point at',
        changed: true
      },
      { path: 'CHANGELOG.md', note: 'One entry for each of 0.1.0, 0.2.0, 0.3.0, 0.4.0 and 0.4.1', changed: true },
      {
        path: 'docs/update/manifest.json and docs/index.html',
        note: 'Written by pnpm release:sign for each version and merged into main. Pages serves them',
        changed: true
      },
      {
        path: 'apps/host/src/main/main.ts',
        note: 'The fix: the update script starts in the temp folder instead of the install folder',
        changed: true
      },
      { path: '.prettierignore', note: 'Skips the two generated site files', changed: true },
      {
        path: 'docs/DEPLOYMENT.md and README.md',
        note: 'The release process as it really worked, a diagram, highlights and the current status',
        changed: true
      },
      {
        path: 'GitHub settings',
        note: 'Public repo, rulesets for main and dev, Pages from main /docs, dev as the default branch',
        changed: true
      },
      { path: 'packages/protocol and apps/viewer', note: 'Untouched', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'Release every version in order and install each one',
        insteadOf: 'Publishing only 0.4.0 and describing the older versions in the changelog',
        reason:
          'It runs the full cycle with real files, and anyone can download any version. It is also the only way to find a bug in the update path, because an update runs the code of the version that is already installed.'
      },
      {
        chose: 'Tag old versions on short side branches that add a version bump',
        insteadOf: 'Tagging the old commits as they were',
        reason:
          'The release workflow checks that the tag equals v plus the version in package.json, and every old commit said 0.1.0. One extra commit per version fixes that, leaves app code alone and does not touch the history of dev or main.'
      },
      {
        chose: 'Copy the build scripts onto the 0.1.0 commit',
        insteadOf: 'Leaving 0.1.0 as source only',
        reason:
          'Version 0.1.0 came before packaging and the installer. Build tools do not change what the app does, so the installer holds exactly the 0.1 app. It has no in-app updates, so users run a newer installer over it.'
      },
      {
        chose: 'Sign each version in order, so the manifest always names the newest',
        insteadOf: 'Signing once at the end',
        reason:
          'The manifest names one version. Signing an older version after a newer one would tell installed apps that the old one is current. Signing in order also tests the signature path at every step.'
      },
      {
        chose: 'Send the site pull requests straight to main, and keep dev as the default branch',
        insteadOf: 'Routing everything through dev',
        reason:
          'Pages serves main, and the site files are release outputs. With dev as default, a contributor pull request lands on dev without knowing the workflow. The cost is that the base must be changed by hand for site pull requests, which went wrong once.'
      },
      {
        chose: 'Release 0.4.1 with no code changes',
        insteadOf: 'Waiting for the next feature',
        reason:
          'The fix lives in the app that does the updating, so a fixed 0.4.0 cannot repair an installed 0.3.0. The only way to prove the fix is a second build that has it, so that 0.4.0 can update to something.'
      },
      {
        chose: 'Protect branches with GitHub rulesets',
        insteadOf: 'Relying on the local git hooks',
        reason:
          'The hooks only protect one machine. Rulesets require a pull request and a passing check on main and dev, block force pushes and deletes, and protect the v* tags that start the release workflow.'
      }
    ]
  },

  when: {
    dependsOn: [
      { spec: '024', note: 'the portable build that the installer wraps' },
      { spec: '025', note: 'the installer that upgrades in place' },
      { spec: '026', note: 'the signed manifest and the in-app updater that this work tested for real' },
      { spec: '027', note: 'the release workflow, the signing command and the download page' },
      { spec: '028', note: 'the scan that made it safe to go public' }
    ],
    unlocks: [{ spec: '018', note: 'new features now ship through the same loop: tag, build, sign, publish, update' }]
  },

  how: {
    steps: [
      {
        title: 'Check, then go public',
        explanation:
          'The history scan, the commit and tag author emails and the pull request refs were checked first. Then the repository was made public, secret scanning and private vulnerability reporting were switched on, and rulesets were added for main, dev and the v* tags.'
      },
      {
        title: 'Prepare main',
        explanation:
          'Main only had the first commit. The version was bumped to 0.4.0 on dev, the changelog got an entry per version, and dev was merged into main with a merge commit. Pages was pointed at main and the /docs folder.'
      },
      {
        title: 'Run the release loop for each version',
        explanation:
          'Push the tag. The workflow checks the tag, runs the tests, builds the installer and zip and makes a draft release. Download the three files, make a branch from origin/main, run pnpm release:sign, commit the two files it writes, open a pull request into main and merge it. Then publish the draft, wait for the page, download the installer, install and test.'
      },
      {
        title: 'Release the old versions from side branches',
        explanation:
          'For 0.1.0 to 0.3.0 a branch starts at the commit where that version ended. A version bump goes on it (and for 0.1.0 the build scripts too), and only the tag is pushed. Every step of the workflow was run locally for 0.1.0 first.'
      },
      {
        title: 'Find the update bug by updating for real',
        explanation:
          'From an installed 0.2.0, Check for updates downloaded 0.3.0, closed the app and came back as 0.2.0. The setup log said a file was in use. The cause was the working folder of the update script. The fix went into 0.4.0.'
      },
      {
        title: 'Prove the fix with 0.4.1',
        explanation:
          'Version 0.4.1 changes nothing. With 0.4.0 installed, Check for updates, Download and Restart to install ended on 0.4.1, and the app stayed on 0.4.1 after a restart.'
      }
    ]
  },

  code: [
    {
      file: '.github/workflows/release.yml',
      excerpt: `on:
  push:
    tags: ['v*']

    - name: Check the tag matches package.json
      run: node scripts/release-ci.mjs check-tag "\${{ github.ref_name }}"`,
      explanation:
        'A tag that starts with v starts the workflow, and the first step stops it unless the tag equals v plus the version in package.json. This is why the old versions needed a version bump commit.'
    },
    {
      file: 'scripts/release-ci.mjs',
      excerpt: `if (command === 'check-tag') {
  const tag = rest[0];
  if (!tag) fail('usage: check-tag <tag>');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const result = checkTagMatchesVersion(tag, version);
  if (!result.ok) fail(result.reason);
  console.log(\`tag \${tag} matches package.json\`);`,
      explanation:
        'The same check can be run on your own machine before you push a tag, so a mismatch does not cost a failed run.'
    },
    {
      file: 'apps/host/src/main/updater/apply.ts',
      excerpt: `const script = \`ping -n 4 127.0.0.1 >nul & "\${o.installerPath}" /S & start "" "\${o.relaunchPath}"\`;
  // With /s, cmd strips the outer quotes and runs the rest as written.
  o.spawn('cmd.exe', ['/d', '/s', '/c', \`"\${script}"\`]);
  o.quit();`,
      explanation:
        'The update is a small command line: wait about three seconds, run the installer silently, start the app again. It runs after the app quits, because a running app blocks the installer.'
    },
    {
      file: 'apps/host/src/main/main.ts',
      excerpt: `spawn(command, args, {
  // Not the install folder: a process whose current folder is inside it stops the installer from swapping it.
  cwd: app.getPath('temp'),
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  windowsVerbatimArguments: true
}).unref();`,
      explanation:
        'The whole fix. Without cwd, the script inherited the install folder as its current folder and kept it in use.'
    },
    {
      file: 'apps/installer/Setup.cs',
      excerpt: `bool hadOld = Directory.Exists(dir);
try
{
    if (hadOld) MoveWithRetry(dir, backup);
    Directory.Move(staging, dir);
}`,
      explanation:
        'The installer upgrades by renaming the old folder out of the way and the new one into place. Renaming fails while any process still has that folder as its current folder, even if no file in it is open.'
    },
    {
      file: '.prettierignore',
      excerpt: `docs/journal/index.html
docs/index.html
docs/update/manifest.json`,
      explanation:
        'The two files that release:sign writes are skipped by the format check. Reformatting them every release would be wrong, and the manifest is signed.'
    }
  ],

  concepts: [
    {
      name: 'Git tags',
      level: 'Core',
      explanation:
        'A tag is a permanent name for one commit, such as v0.2.0. It does not have to sit on a branch: you can push only the tag, and GitHub keeps the commit it points at. An annotated tag also stores who made it, when and a message. Here a pushed tag is what starts a release.',
      resources: [{ title: 'Pro Git: Tagging', url: 'https://git-scm.com/book/en/v2/Git-Basics-Tagging' }]
    },
    {
      name: 'Current working directory',
      level: 'Core',
      explanation:
        'Every process has a current folder, and a child process starts in its parent folder unless you say otherwise. On Windows, a folder that is some process current folder cannot be renamed or deleted. That is what blocked the installer: the helper script it ran from was started inside the install folder. Node lets you choose the folder with the cwd option.',
      resources: [{ title: 'Node.js: child_process.spawn', url: 'https://nodejs.org/api/child_process.html' }]
    },
    {
      name: 'Workflow triggers',
      level: 'Concept',
      explanation:
        'A GitHub Actions workflow says when it runs. The push event with a tags filter runs it when a matching tag is pushed. The pattern v* is a glob, so it matches v0.4.1 and also anything else that starts with v. The workflow file is read from the tagged commit.',
      resources: [
        {
          title: 'GitHub Docs: Events that trigger workflows',
          url: 'https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows'
        }
      ]
    },
    {
      name: 'Semantic versioning',
      level: 'Concept',
      explanation:
        'Versions look like MAJOR.MINOR.PATCH. Before 1.0.0 a minor bump may change anything. A patch bump such as 0.4.1 signals a small fix, and here it carried no code change at all, only the proof that updating works.',
      resources: [{ title: 'Semantic Versioning 2.0.0', url: 'https://semver.org/' }]
    },
    {
      name: 'Branch rulesets',
      level: 'Concept',
      explanation:
        'A ruleset is a rule that GitHub enforces on branches or tags: require a pull request, require a status check, block force pushes, block deletions. Unlike a local git hook, it protects the repo no matter whose machine pushes.',
      resources: [
        {
          title: 'GitHub Docs: About rulesets',
          url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets'
        }
      ]
    },
    {
      name: 'Merge methods',
      level: 'Pattern',
      explanation:
        'Rebase and merge replays the commits one by one, which keeps dev in a straight line. A merge commit keeps a visible join, which suits the step where dev is released into main. This repo uses the first for dev and the second for main.',
      resources: [
        {
          title: 'GitHub Docs: About merge methods',
          url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github'
        }
      ]
    },
    {
      name: 'GitHub Pages publishing source',
      level: 'Concept',
      explanation:
        'Pages can serve one folder of one branch. Here that is main and /docs, so the download page and the update manifest only change when main changes. A pull request into any other branch does not change the site.',
      resources: [
        {
          title: 'GitHub Docs: Configuring a publishing source',
          url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site'
        }
      ]
    }
  ],

  bugs: [
    {
      symptom: 'The site pull request for 0.1.0 passed its checks and merged, but the download page returned 404.',
      cause:
        'The pull request had been opened against dev, which is the default branch. Pages serves main, and main had no docs/index.html.',
      fix: 'A dev to main pull request brought the files over. Site pull requests now say base main on purpose, and DEPLOYMENT.md explains it.'
    },
    {
      symptom: 'The format check failed on the site pull request, naming docs/index.html and docs/update/manifest.json.',
      cause:
        'The release script writes both files in its own format, and Prettier checks every tracked file.',
      fix: 'Both paths went into .prettierignore. Reformatting a signed manifest on every release would be wrong.'
    },
    {
      symptom:
        'Before the 0.1.0 tag was pushed, running the workflow check locally failed with: Cannot find module docs/site/site.js.',
      cause: 'The release scripts copied onto the old commit need that file, and the old commit did not have it.',
      fix: 'That file was copied too, and every workflow step was run locally before the tag was pushed.'
    },
    {
      symptom:
        'Clicking Restart to install closed the app, a console window flashed, and the old version came back. Checking again offered the same update.',
      cause:
        'The update script started with the install folder as its current folder. The installer swaps folders by renaming, which fails while a process has that folder as its current folder. It retried for ten seconds and gave up. The setup log said: The process cannot access the file because it is being used by another process.',
      fix: 'Start the script in the temp folder with the cwd option. Version 0.4.0 has the fix. Installed copies of 0.2.0 and 0.3.0 cannot update themselves, so they run the new installer once by hand. Version 0.4.1 proved the fix.'
    },
    {
      symptom: 'The download counter on the page rose faster than the real downloads during testing.',
      cause:
        'GitHub counts requests to the release file, and checking the link with curl -I probably counted too.',
      fix: 'Check a release through the API (releases/latest) instead of the file link.'
    }
  ],

  quiz: [
    {
      question: 'Why did the old versions need a version bump commit before they could be tagged?',
      answer:
        'The workflow stops unless the tag equals v plus the version in package.json, and every old commit still said 0.1.0.'
    },
    {
      question: 'Why can an installed 0.3.0 not be fixed by publishing 0.4.0?',
      answer:
        'An update runs the code of the version that is already installed. The broken update script lives in 0.3.0, so only a manual install gets it to 0.4.0, and the fix helps from there on.'
    },
    {
      question: 'What would go wrong if you signed 0.2.0 after 0.4.0?',
      answer:
        'The manifest names one version, the newest you signed. Installed apps would be told that 0.2.0 is the current version, and the download page would offer the old installer.'
    },
    {
      question: 'Why does the site pull request go to main when dev is the default branch?',
      answer:
        'Pages serves main, and the site files are release outputs. Dev is the default so that contributor pull requests target it. The cost is changing the base by hand for site pull requests.'
    },
    {
      question: 'Why release 0.4.1 when nothing in the app changed?',
      answer:
        'The fix is in the app that does the updating. A second build that has it is the only way to show that 0.4.0 can update to something.'
    }
  ],

  commits: [
    'docs: add how it works, highlights and current status to readme',
    'chore(release): bump version to 0.4.0',
    'docs: write changelog for 0.1.0 to 0.4.0 and update status',
    'docs: note that 0.1.0 ships an installer without in-app updates',
    'chore(site): publish 0.1.0',
    'chore: skip generated release files in prettier',
    'fix(host): run the update script outside the install folder',
    'docs: note the updater fix in the changelog',
    'chore(release): bump version to 0.4.1',
    'docs: add the 0.4.1 changelog entry',
    'docs: write down the release process and what the first releases taught',
    'docs: update the readme status to 0.4.1'
  ]
});
