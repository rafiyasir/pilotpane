// PilotPane setup: installs the embedded portable build for the current user, and removes it again.
//
//   Setup.exe              install, then start PilotPane
//   Setup.exe /S           install silently, do not start it
//   Uninstall.exe /uninstall [/S]   remove it (/S skips the question)
//
// Built by scripts/build-installer.mjs with the csc.exe that ships with Windows, so it is C# 5:
// no string interpolation and no ?. operator. The zip from `pnpm package` is embedded as "payload.zip"
// and the version as "version.txt". The uninstaller is this same source built without the payload. No window of its own: only native message boxes for questions and errors.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class Setup
{
    const string AppName = "PilotPane";
    const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\PilotPane";
    const string IconRelPath = @"resources\app\dist\assets\icon.ico";

    static bool silent;

    static string InstallDir
    {
        get
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"Programs\PilotPane");
        }
    }

    static string ShortcutPath
    {
        get
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                "PilotPane.lnk");
        }
    }

    [STAThread]
    static int Main(string[] args)
    {
        bool uninstall = false;
        bool fromTemp = false;
        foreach (string arg in args)
        {
            string a = arg.ToLowerInvariant();
            if (a == "/s") silent = true;
            else if (a == "/uninstall") uninstall = true;
            else if (a == "/fromtemp") fromTemp = true;
        }

        try
        {
            return uninstall ? Uninstall(fromTemp) : Install();
        }
        catch (Exception ex)
        {
            Fail("Something went wrong, and nothing was changed that we know of.\n\n" + ex.Message);
            return 1;
        }
    }

    // ---- install ----

    static int Install()
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
    }

    static string ReadResourceText(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (s == null) throw new InvalidOperationException("This setup file is damaged (missing " + name + ").");
            using (StreamReader r = new StreamReader(s, Encoding.UTF8)) return r.ReadToEnd().Trim();
        }
    }

    // The zip holds one top-level folder (PilotPane-<ver>-win-x64); its contents become the install folder.
    static void ExtractPayload(string dest)
    {
        string destFull = Path.GetFullPath(dest);
        Directory.CreateDirectory(destFull);
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
        {
            if (s == null) throw new InvalidOperationException("This setup file is damaged (missing payload).");
            using (ZipArchive zip = new ZipArchive(s, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in zip.Entries)
                {
                    string rel = entry.FullName.Replace('/', '\\');
                    int slash = rel.IndexOf('\\');
                    if (slash < 0) continue;
                    rel = rel.Substring(slash + 1);
                    if (rel.Length == 0) continue;

                    string target = Path.GetFullPath(Path.Combine(destFull, rel));
                    if (!target.StartsWith(destFull + "\\", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Unsafe path in the package: " + entry.FullName);

                    if (entry.Name.Length == 0)
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    entry.ExtractToFile(target, true);
                }
            }
        }
    }

    // The uninstaller is the same program compiled without the payload, so it stays small.
    static void WriteUninstaller(string path)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("uninstall.exe"))
        {
            if (s == null) throw new InvalidOperationException("This setup file is damaged (missing uninstaller).");
            using (FileStream f = File.Create(path)) s.CopyTo(f);
        }
    }

    static void CreateShortcut(string dir)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null) return;
        object shell = Activator.CreateInstance(shellType);
        object link = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell,
            new object[] { ShortcutPath });
        Type linkType = link.GetType();
        Set(linkType, link, "TargetPath", Path.Combine(dir, "PilotPane.exe"));
        Set(linkType, link, "WorkingDirectory", dir);
        Set(linkType, link, "IconLocation", Path.Combine(dir, IconRelPath));
        Set(linkType, link, "Description", "Use this laptop as a remote screen");
        linkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
    }

    static void Set(Type type, object target, string property, object value)
    {
        type.InvokeMember(property, BindingFlags.SetProperty, null, target, new object[] { value });
    }

    static void WriteUninstallEntry(string dir)
    {
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallKey))
        {
            key.SetValue("DisplayName", AppName);
            key.SetValue("DisplayVersion", ReadResourceText("version.txt"));
            key.SetValue("Publisher", "Rafi Uzzaman");
            key.SetValue("InstallLocation", dir);
            key.SetValue("DisplayIcon", Path.Combine(dir, IconRelPath));
            key.SetValue("UninstallString", "\"" + Path.Combine(dir, "Uninstall.exe") + "\" /uninstall");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            key.SetValue("EstimatedSize", (int)(DirSize(new DirectoryInfo(dir)) / 1024), RegistryValueKind.DWord);
        }
    }

    static long DirSize(DirectoryInfo d)
    {
        long total = 0;
        foreach (FileInfo f in d.GetFiles()) total += f.Length;
        foreach (DirectoryInfo sub in d.GetDirectories()) total += DirSize(sub);
        return total;
    }

    // ---- uninstall ----

    static int Uninstall(bool fromTemp)
    {
        string dir = InstallDir;
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(UninstallKey))
        {
            if (key != null)
            {
                string saved = key.GetValue("InstallLocation") as string;
                if (!string.IsNullOrEmpty(saved)) dir = saved;
            }
        }

        if (!fromTemp)
        {
            if (!silent && MessageBox.Show("Remove PilotPane from this computer?", AppName,
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return 1;

            // This exe lives inside the folder being removed, so run a copy from the temp folder.
            string self = Assembly.GetExecutingAssembly().Location;
            string copy = Path.Combine(Path.GetTempPath(), "PilotPane-Uninstall-" + Process.GetCurrentProcess().Id + ".exe");
            File.Copy(self, copy, true);
            Process.Start(new ProcessStartInfo(copy, "/uninstall /fromtemp" + (silent ? " /S" : "")) { WorkingDirectory = Path.GetTempPath() });
            return 0;
        }

        if (!CloseRunningApp(dir)) { ScheduleSelfDelete(); return 2; }
        DeleteDir(dir);
        if (File.Exists(ShortcutPath)) File.Delete(ShortcutPath);
        Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
        ScheduleSelfDelete();
        return 0;
    }

    static void ScheduleSelfDelete()
    {
        string self = Assembly.GetExecutingAssembly().Location;
        ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c ping -n 3 127.0.0.1 >nul & del \"" + self + "\"");
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        Process.Start(psi);
    }

    // ---- shared ----

    // True when no PilotPane from this folder is running afterwards. If it is running, the user is asked
    // once, and then every PilotPane process from this folder is closed. Silent mode never closes it.
    static bool CloseRunningApp(string dir)
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
    }

    // Every process that runs from inside dir: PilotPane.exe and its helper windows, and pilotpane-input.exe.
    // A running exe in the folder blocks renaming or deleting it.
    static List<Process> RunningFrom(string dir)
    {
        List<Process> found = new List<Process>();
        if (!Directory.Exists(dir)) return found;
        string prefix = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
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
    }

    // Just-closed programs, virus scanners and Explorer can hold a folder for a moment, so try for a few seconds.
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
    }

    static void DeleteDir(string path)
    {
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                if (Directory.Exists(path)) Directory.Delete(path, true);
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
    }

    static void Fail(string message)
    {
        if (silent) File.AppendAllText(Path.Combine(Path.GetTempPath(), "PilotPane-setup.log"), message + "\r\n");
        else MessageBox.Show(message, AppName + " setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
