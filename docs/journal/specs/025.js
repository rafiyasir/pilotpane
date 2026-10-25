window.JOURNAL.push({
  number: '025',
  title: 'Windows installer',
  version: 'dist',
  mergedDate: '2026-10-22',
  technologies: ['C# 5 and csc.exe', 'Win32 UpdateResource', 'Windows registry', 'zip', 'Node child_process'],
  oneLine:
    'PilotPane now installs from one file, with no admin prompt, a Start menu shortcut, an uninstaller and its own name in Windows.',

  what: {
    summary:
      'Until now PilotPane was a folder you had to unzip and start by hand. `pnpm installer` now builds `PilotPane-Setup-<version>.exe`: one file that installs for the current user, adds a Start menu shortcut and an entry in Installed apps, upgrades in place, and removes everything again. A second tool gives `PilotPane.exe` its own name, publisher and icon, so Windows prompts no longer say Electron.',
    partsTouched: [
      { path: 'apps/installer/Setup.cs', note: 'The setup and uninstaller program, one C# file', changed: true },
      {
        path: 'scripts/build-installer.mjs',
        note: 'Compiles the setup with the zip, version and uninstaller embedded',
        changed: true,
      },
      {
        path: 'scripts/rebrand/Rebrand.cs',
        note: 'Rewrites the exe version info and icon with UpdateResource',
        changed: true,
      },
      { path: 'scripts/package.mjs', note: 'Runs the rebrand step after copying Electron', changed: true },
      {
        path: 'scripts/lib/csc.mjs',
        note: 'The compiler lookup, shared with the input helper build',
        changed: true,
      },
      {
        path: 'docs',
        note: 'ADR-010, the Installer section in DEPLOYMENT.md, a firewall wording fix',
        changed: true,
      },
      {
        path: 'apps/host/src',
        note: 'Untouched: the installer only wraps the portable folder from spec 024',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Our own C# setup program, compiled with the csc.exe that ships with Windows',
        insteadOf: 'Inno Setup, NSIS, WiX or electron-builder',
        reason:
          'Each of those is a separate tool or a package to install. The C# compiler already builds the input helper (ADR-003), so nothing new is trusted. Recorded as ADR-010.',
      },
      {
        chose: 'A per-user install into `%LOCALAPPDATA%\\Programs\\PilotPane`',
        insteadOf: 'Program Files',
        reason: 'No UAC prompt, no admin rights, and PilotPane runs in the user’s own session anyway.',
      },
      {
        chose: 'An uninstaller built from the same source, without the payload',
        insteadOf: 'Copying the whole setup to Uninstall.exe',
        reason: 'The first version did that and the uninstaller was 158 MB. Compiling twice makes it 22 KB.',
      },
      {
        chose: 'Unpack beside the old version, then swap folders',
        insteadOf: 'Overwriting files in place',
        reason:
          'A failed upgrade puts the old folder back, so a working app is never replaced by half of a new one.',
      },
      {
        chose: 'No window of our own, only native message boxes',
        insteadOf: 'A designed installer UI',
        reason:
          'DESIGN.md has no installer screens, and the rule is not to invent UI. A designed one can come later.',
      },
      {
        chose: 'Fix the “Electron” name by editing the exe’s resources',
        insteadOf: 'An icon-editing package such as rcedit',
        reason:
          'The Win32 UpdateResource call does the job from a small C# tool, so the dependency policy still holds.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '024', note: 'The portable folder and zip that the setup embeds, and the icon.ico for the shortcut' },
      { spec: '010', note: 'The C# and csc.exe approach, and the helper exe that must be closed before an upgrade' },
    ],
    unlocks: [
      { spec: '026', note: 'In-app updates can run the same install steps silently' },
      { spec: '027', note: 'The release pipeline publishes this one file for download' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Package, then rebrand',
        explanation:
          '`pnpm installer` runs the portable package first. That step now compiles `Rebrand.cs` and runs it on `PilotPane.exe`, which replaces the Electron version info and icon.',
      },
      {
        title: 'Compile the uninstaller, then the setup',
        explanation:
          'The same `Setup.cs` is compiled twice. The first build has no payload and becomes the uninstaller. The second embeds the zip, the version and that uninstaller as resources.',
      },
      {
        title: 'Install',
        explanation:
          'The setup checks whether PilotPane runs from the install folder, unpacks the zip into `PilotPane.new`, swaps folders, writes `Uninstall.exe`, creates the shortcut and the registry entry, and starts the app.',
      },
      {
        title: 'Uninstall',
        explanation:
          'The uninstaller lives inside the folder it must delete, so it starts a copy of itself from the temp folder and exits. The copy removes the folder, shortcut and registry entry, then deletes itself.',
      },
      {
        title: 'Silent mode',
        explanation:
          '`/S` installs without a window and without starting the app. Errors go to a log in the temp folder. It never closes a running app and exits with code 2 instead.',
      },
    ],
  },

  code: [
    {
      file: 'apps/installer/Setup.cs',
      excerpt: `    static int Install()
    {
        string dir = InstallDir;
        if (!CloseRunningApp(dir)) return 2;

        string staging = dir + ".new";
        string backup = dir + ".old";
        DeleteDir(staging);
        DeleteDir(backup);
        Directory.CreateDirectory(Path.GetDirectoryName(dir));

        ExtractPayload(staging);

        bool hadOld = Directory.Exists(dir);
        try
        {
            if (hadOld) MoveWithRetry(dir, backup);
            Directory.Move(staging, dir);
        }
        catch
        {
            // Put the old version back so a failed upgrade still leaves a working app.
            if (hadOld && !Directory.Exists(dir) && Directory.Exists(backup)) Directory.Move(backup, dir);
            DeleteDir(staging);
            throw;
        }
        DeleteDir(backup);

        WriteUninstaller(Path.Combine(dir, "Uninstall.exe"));
        CreateShortcut(dir);
        WriteUninstallEntry(dir);

        if (!silent) Process.Start(new ProcessStartInfo(Path.Combine(dir, "PilotPane.exe")) { WorkingDirectory = dir });
        return 0;
    }`,
      explanation: 'Install builds the new version beside the old one (`.new`), swaps the folders, and puts the old one back if the swap fails. Then it adds the uninstaller, the shortcut and the Installed apps entry.',
    },
    {
      file: 'apps/installer/Setup.cs',
      excerpt: `    static bool CloseRunningApp(string dir)
    {
        List<Process> running = RunningFrom(dir);
        if (running.Count == 0) return true;
        if (silent) return false;

        DialogResult r = MessageBox.Show(
            "PilotPane is running. Close it and continue?",
            AppName, MessageBoxButtons.OKCancel, MessageBoxIcon.Information);
        if (r != DialogResult.OK) return false;

        foreach (Process p in running)
        {
            try { p.Kill(); }
            catch { /* already gone */ }
        }
        foreach (Process p in running)
        {
            try { p.WaitForExit(5000); }
            catch { /* already gone */ }
        }
        if (RunningFrom(dir).Count == 0) return true;

        Fail("PilotPane could not be closed. Quit it from its tray icon and try again.");
        return false;
    }`,
      explanation: 'One question, then every PilotPane process from the install folder is closed. If something survives, one clear error, never a loop.',
    },
    {
      file: 'apps/installer/Setup.cs',
      excerpt: `    // Every process that runs from inside dir: PilotPane.exe and its helper windows, and pilotpane-input.exe.
    // A running exe in the folder blocks renaming or deleting it.
    static List<Process> RunningFrom(string dir)
    {
        List<Process> found = new List<Process>();
        if (!Directory.Exists(dir)) return found;
        string prefix = Path.GetFullPath(dir).TrimEnd('\\\\') + "\\\\";
        foreach (Process p in Process.GetProcesses())
        {
            try
            {
                string path = p.MainModule.FileName;
                // The uninstaller that started this run may still be exiting. It is not the app.
                if (string.Equals(Path.GetFileName(path), "Uninstall.exe", StringComparison.OrdinalIgnoreCase)) continue;
                if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) found.Add(p);
            }
            catch
            {
                // Cannot read another user's or protected process: not ours to worry about.
            }
        }
        return found;
    }`,
      explanation: 'A running exe blocks renaming its folder, so this looks at every process by its exe path, not by name. The uninstaller that started the run is skipped.',
    },
    {
      file: 'apps/installer/Setup.cs',
      excerpt: `    // Just-closed programs, virus scanners and Explorer can hold a folder for a moment, so try for a few seconds.
    static void MoveWithRetry(string from, string to)
    {
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                Directory.Move(from, to);
                return;
            }
            catch (IOException)
            {
                if (attempt >= 20) throw;
            }
            catch (UnauthorizedAccessException)
            {
                if (attempt >= 20) throw;
            }
            Thread.Sleep(500);
        }
    }`,
      explanation: 'A program that was just closed, a virus scanner or Explorer can hold a folder for a moment. Retry for up to 10 seconds, then give up with the real error.',
    },
    {
      file: 'scripts/rebrand/Rebrand.cs',
      excerpt: `    static byte[] Block(string key, byte[] value, int valueLength, int type, List<byte[]> children)
    {
        MemoryStream ms = new MemoryStream();
        BinaryWriter w = new BinaryWriter(ms);
        w.Write((ushort)0);
        w.Write((ushort)valueLength);
        w.Write((ushort)type);
        w.Write(Encoding.Unicode.GetBytes(key + "\\0"));
        Pad(ms);
        if (value != null)
        {
            w.Write(value);
            Pad(ms);
        }
        if (children != null)
        {
            foreach (byte[] child in children)
            {
                Pad(ms);
                w.Write(child);
            }
        }
        byte[] bytes = ms.ToArray();
        bytes[0] = (byte)(bytes.Length & 0xFF);
        bytes[1] = (byte)(bytes.Length >> 8);
        return bytes;
    }`,
      explanation: 'One block of the Windows version resource: sizes, a type, a key, padding to 4 bytes, a value and child blocks. The length is only known at the end, so it is patched into the first two bytes.',
    },
    {
      file: 'scripts/package.mjs',
      excerpt: `// Electron's exe says "Electron" and "GitHub, Inc." in its version info, and Windows shows that in the firewall
// prompt. scripts/rebrand/Rebrand.cs rewrites the version info and icon. Without a compiler this is only a warning.
async function brandExe(stageDir, version) {
  const csc = findCsc();
  if (!csc) {
    console.warn('warning: csc.exe not found, so the exe keeps the name "Electron" in Windows prompts.');
    return;
  }
  const tool = join(outRoot, 'rebrand.exe');
  await mkdir(outRoot, { recursive: true });
  const compiled = spawnSync(csc, ['/nologo', '/optimize+', \`/out:\${tool}\`, join(root, 'scripts/rebrand/Rebrand.cs')], {
    encoding: 'utf8'
  });
  if (compiled.status !== 0) throw new Error(\`rebrand tool failed to compile:\\n\${compiled.stdout}\${compiled.stderr}\`);
  try {
    const icon = join(root, 'apps/host/assets/icon.ico');
    const run = spawnSync(tool, [join(stageDir, 'PilotPane.exe'), icon, version], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error('could not set the name and icon on PilotPane.exe');
  } finally {
    await rm(tool, { force: true });
  }
}`,
      explanation: 'The packaging step compiles the rebrand tool with the Windows C# compiler, runs it on `PilotPane.exe`, and deletes it. Without a compiler it only warns.',
    },
    {
      file: 'scripts/build-installer.mjs',
      excerpt: `// The uninstaller is the same source without the payload, embedded in the setup.
const uninstaller = join(outRoot, 'installer-uninstall.exe');
const output = join(outRoot, \`PilotPane-Setup-\${version}.exe\`);
try {
  compile(uninstaller, []);
  compile(output, [
    \`/resource:\${zip},payload.zip\`,
    \`/resource:\${versionFile},version.txt\`,
    \`/resource:\${uninstaller},uninstall.exe\`
  ]);
} finally {
  await unlink(versionFile);
  await rm(uninstaller, { force: true });
}`,
      explanation: 'The uninstaller is the same source compiled without the payload (22 KB). The setup embeds it, so the installed copy does not carry a second 150 MB file.',
    },
  ],

  concepts: [
    {
      name: 'Windows version resource',
      level: 'Core',
      explanation:
        'An exe carries a VS_VERSION_INFO block with strings such as the file description and company. The firewall prompt, Task Manager and the Properties dialog read it. The block is a tree of length-prefixed records aligned to 4 bytes.',
      resources: [
        {
          title: 'Microsoft Learn: VS_VERSIONINFO resource',
          url: 'https://learn.microsoft.com/en-us/windows/win32/menurc/vs-versioninfo',
        },
        {
          title: 'Microsoft Learn: Version information',
          url: 'https://learn.microsoft.com/en-us/windows/win32/menurc/version-information',
        },
      ],
    },
    {
      name: 'Editing exe resources',
      level: 'Core',
      explanation:
        'BeginUpdateResource, UpdateResource and EndUpdateResource change icons and version info in a finished exe. Old resources are listed and removed first so nothing from Electron is left behind. Editing breaks Electron’s signature, so the publisher is now ours.',
      resources: [
        {
          title: 'Microsoft Learn: UpdateResource function',
          url: 'https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-updateresourcew',
        },
        {
          title: 'Microsoft Learn: Icon resources',
          url: 'https://learn.microsoft.com/en-us/windows/win32/menurc/about-icons',
        },
      ],
    },
    {
      name: 'Uninstall registry entry',
      level: 'Concept',
      explanation:
        'Settings > Installed apps lists what is under the Uninstall registry key. A per-user app writes to HKEY_CURRENT_USER, so no admin rights are needed.',
      resources: [
        {
          title: 'Microsoft Learn: Uninstall registry key',
          url: 'https://learn.microsoft.com/en-us/windows/win32/msi/uninstall-registry-key',
        },
        {
          title: 'Microsoft Learn: RegistryKey class',
          url: 'https://learn.microsoft.com/en-us/dotnet/api/microsoft.win32.registrykey',
        },
      ],
    },
    {
      name: 'Embedded resources and zip in .NET',
      level: 'Concept',
      explanation:
        'The compiler `/resource` option embeds a file in the exe, and `GetManifestResourceStream` reads it back. `ZipArchive` unpacks it. Each path is checked to stay inside the target folder.',
      resources: [
        {
          title: 'Microsoft Learn: Assembly.GetManifestResourceStream',
          url: 'https://learn.microsoft.com/en-us/dotnet/api/system.reflection.assembly.getmanifestresourcestream',
        },
        {
          title: 'Microsoft Learn: ZipArchive',
          url: 'https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.ziparchive',
        },
        {
          title: 'Microsoft Learn: C# compiler -resource option',
          url: 'https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/resources',
        },
      ],
    },
    {
      name: 'Swap with rollback',
      level: 'Pattern',
      explanation:
        'Prepare the new version on the side, rename the old one away, rename the new one in, and rename the old one back if any step fails. A rename is quick, so the window for a broken state is tiny.',
      resources: [],
    },
  ],

  bugs: [
    {
      symptom:
        'With PilotPane running, the installer asked to quit it. Clicking OK showed the same box again and again, and Cancel seemed to do nothing. Uninstall behaved the same.',
      cause:
        'The code asked the user to quit the app, then checked again. PilotPane keeps several background processes, so the check kept finding some. Cancel quietly exited with no message.',
      fix: 'Ask once, then close every PilotPane process from the install folder ourselves. If one survives, show a single error. Silent mode never closes the app.',
    },
    {
      symptom:
        'After clicking OK on the close box, the installer said “Access to the path ... PilotPane is denied”. Running it again worked.',
      cause:
        'Only PilotPane.exe was closed. The input helper pilotpane-input.exe was still running for a moment, and Windows will not rename a folder that contains a running exe.',
      fix: 'Close every process whose exe is inside the folder, whatever its name, and retry the folder rename and delete for up to 10 seconds.',
    },
    {
      symptom: 'Uninstalling after closing the app still showed “PilotPane is running”, and it needed a second try.',
      cause:
        'The uninstaller runs a copy of itself from the temp folder. That copy saw the first Uninstall.exe, still exiting inside the install folder, and counted it as the app.',
      fix: 'The running-app check ignores Uninstall.exe.',
    },
    {
      symptom: 'The firewall prompt said “Electron” with publisher “GitHub, Inc.” and the Electron icon.',
      cause:
        'Spec 024 only renamed electron.exe. The name, publisher and icon live inside the exe’s resources and still said Electron.',
      fix: 'A small C# tool rewrites the version info and icon during packaging. After that the prompt showed our publisher and icon, but the name still said Electron on the test machine. Windows keeps a per-user cache of app names (MuiCache), and an earlier run of the old build had stored “Electron” for that path. A new user has no such entry. The stale entry was deleted on the test machine.',
    },
  ],

  quiz: [
    {
      question: 'Why does the uninstaller copy itself to the temp folder before deleting anything?',
      answer:
        'Windows cannot delete a running exe or the folder it sits in. The copy runs from the temp folder, deletes the install folder, then removes itself.',
    },
    {
      question: 'Why does the check for a running app look at exe paths instead of the name PilotPane.exe?',
      answer:
        'The input helper has a different name, but while it runs inside the folder it blocks renaming or deleting that folder.',
    },
    {
      question: 'What stays safe if an upgrade fails halfway?',
      answer:
        'The new version is unpacked beside the old one. If the swap fails, the old folder is renamed back, so the previous version still works.',
    },
    {
      question: 'Why is the uninstaller only 22 KB while the setup is 150 MB?',
      answer: 'The same source is compiled twice. The uninstaller has no zip payload, and the setup embeds the uninstaller.',
    },
    {
      question: 'Why did the firewall still say Electron after the exe was fixed?',
      answer: 'Windows had cached the old name for that install path in MuiCache. The exe itself already said PilotPane.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
