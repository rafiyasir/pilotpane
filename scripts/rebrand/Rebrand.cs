// Build tool: gives the packaged PilotPane.exe its own name, version info and icon.
//
//   Rebrand.exe <exe> <icon.ico> <version>
//
// Electron's exe carries "Electron" and "GitHub, Inc." in its version resource, and Windows shows that text in
// the firewall prompt and Task Manager. This rewrites the version resource and the icon resources with the Win32
// UpdateResource API. Compiled on the fly by scripts/package.mjs with the csc.exe that ships with Windows (C# 5).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

static class Rebrand
{
    static readonly IntPtr RtIcon = (IntPtr)3;
    static readonly IntPtr RtGroupIcon = (IntPtr)14;
    static readonly IntPtr RtVersion = (IntPtr)16;
    const ushort Lang = 1033;
    const uint LoadLibraryAsDataFile = 2;

    delegate bool EnumNameProc(IntPtr module, IntPtr type, IntPtr name, IntPtr param);
    delegate bool EnumLangProc(IntPtr module, IntPtr type, IntPtr name, ushort lang, IntPtr param);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr LoadLibraryEx(string file, IntPtr zero, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool EnumResourceNames(IntPtr module, IntPtr type, EnumNameProc proc, IntPtr param);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumLangProc proc, IntPtr param);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort lang, byte[] data, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool EndUpdateResource(IntPtr update, bool discard);

    // A resource name is either a small integer id or a pointer to a string.
    class ResName
    {
        public IntPtr Id;
        public string Text;
        public ushort Lang;
    }

    static int Main(string[] args)
    {
        if (args.Length != 3)
        {
            Console.Error.WriteLine("usage: Rebrand <exe> <icon.ico> <version>");
            return 2;
        }
        try
        {
            Run(args[0], args[1], args[2]);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("rebrand failed: " + ex.Message);
            return 1;
        }
    }

    static void Run(string exe, string icoPath, string version)
    {
        byte[] ico = File.ReadAllBytes(icoPath);
        byte[] versionBlob = BuildVersionInfo(version);

        // Old resources are listed first, then removed, so nothing from Electron is left behind.
        List<ResName> oldVersion = List(exe, RtVersion);
        List<ResName> oldGroups = List(exe, RtGroupIcon);
        List<ResName> oldIcons = List(exe, RtIcon);

        IntPtr h = BeginUpdateResource(exe, false);
        if (h == IntPtr.Zero) throw new InvalidOperationException("cannot open " + exe + " for update (error " + Marshal.GetLastWin32Error() + ")");
        bool ok = false;
        try
        {
            foreach (ResName n in oldVersion) Update(h, RtVersion, n, n.Lang, null);
            foreach (ResName n in oldGroups) Update(h, RtGroupIcon, n, n.Lang, null);
            foreach (ResName n in oldIcons) Update(h, RtIcon, n, n.Lang, null);

            Update(h, RtVersion, new ResName { Id = (IntPtr)1 }, Lang, versionBlob);
            AddIcons(h, ico);
            ok = true;
        }
        finally
        {
            if (!EndUpdateResource(h, !ok) && ok) throw new InvalidOperationException("could not save " + exe);
        }

        FileVersionInfo info = FileVersionInfo.GetVersionInfo(exe);
        if (info.ProductName != "PilotPane") throw new InvalidOperationException("version info was not applied");
        Console.WriteLine("rebranded " + Path.GetFileName(exe) + ": " + info.FileDescription + " " + info.ProductVersion);
    }

    static void Update(IntPtr h, IntPtr type, ResName name, ushort lang, byte[] data)
    {
        IntPtr nameArg = name.Text == null ? name.Id : Marshal.StringToHGlobalUni(name.Text);
        if (!UpdateResource(h, type, nameArg, lang, data, data == null ? 0u : (uint)data.Length))
            throw new InvalidOperationException("UpdateResource failed (error " + Marshal.GetLastWin32Error() + ")");
    }

    static List<ResName> List(string exe, IntPtr type)
    {
        List<ResName> result = new List<ResName>();
        IntPtr module = LoadLibraryEx(exe, IntPtr.Zero, LoadLibraryAsDataFile);
        if (module == IntPtr.Zero) throw new InvalidOperationException("cannot read " + exe);
        try
        {
            EnumResourceNames(module, type, delegate (IntPtr m, IntPtr t, IntPtr name, IntPtr p)
            {
                string text = ((long)name >> 16) == 0 ? null : Marshal.PtrToStringUni(name);
                IntPtr id = text == null ? name : IntPtr.Zero;
                // The name pointer is only valid in this callback, so look the languages up here.
                IntPtr nameArg = name;
                EnumResourceLanguages(m, t, nameArg, delegate (IntPtr m2, IntPtr t2, IntPtr n2, ushort lang, IntPtr p2)
                {
                    result.Add(new ResName { Id = id, Text = text, Lang = lang });
                    return true;
                }, IntPtr.Zero);
                return true;
            }, IntPtr.Zero);
        }
        finally
        {
            FreeLibrary(module);
        }
        return result;
    }

    // Writes each image of the .ico as an RT_ICON and a matching group (id 1) that the exe uses as its icon.
    static void AddIcons(IntPtr h, byte[] ico)
    {
        int count = BitConverter.ToUInt16(ico, 4);
        if (count == 0 || BitConverter.ToUInt16(ico, 2) != 1) throw new InvalidDataException("not an .ico file");

        MemoryStream group = new MemoryStream();
        BinaryWriter g = new BinaryWriter(group);
        g.Write((ushort)0);
        g.Write((ushort)1);
        g.Write((ushort)count);
        for (int i = 0; i < count; i++)
        {
            int e = 6 + i * 16;
            int size = BitConverter.ToInt32(ico, e + 8);
            int offset = BitConverter.ToInt32(ico, e + 12);
            byte[] image = new byte[size];
            Array.Copy(ico, offset, image, 0, size);
            ushort id = (ushort)(i + 1);
            Update(h, RtIcon, new ResName { Id = (IntPtr)id }, Lang, image);

            g.Write(ico, e, 12); // width, height, colors, reserved, planes, bit count, bytes in resource
            g.Write(id);
        }
        Update(h, RtGroupIcon, new ResName { Id = (IntPtr)1 }, Lang, group.ToArray());
    }

    // ---- VS_VERSIONINFO ----

    static byte[] BuildVersionInfo(string version)
    {
        string[] parts = version.Split('.');
        ushort major = ushort.Parse(parts[0]);
        ushort minor = parts.Length > 1 ? ushort.Parse(parts[1]) : (ushort)0;
        ushort patch = parts.Length > 2 ? ushort.Parse(parts[2]) : (ushort)0;
        uint ms = ((uint)major << 16) | minor;
        uint ls = (uint)patch << 16;

        MemoryStream fixedInfo = new MemoryStream();
        BinaryWriter f = new BinaryWriter(fixedInfo);
        f.Write(0xFEEF04BDu);
        f.Write(0x00010000u);
        f.Write(ms); f.Write(ls);
        f.Write(ms); f.Write(ls);
        f.Write(0x3Fu);
        f.Write(0u);
        f.Write(0x00040004u); // VOS_NT_WINDOWS32
        f.Write(1u);          // VFT_APP
        f.Write(0u);
        f.Write(0u); f.Write(0u);

        string full = major + "." + minor + "." + patch + ".0";
        List<byte[]> strings = new List<byte[]>();
        AddString(strings, "CompanyName", "Rafi Uzzaman");
        AddString(strings, "FileDescription", "PilotPane");
        AddString(strings, "FileVersion", full);
        AddString(strings, "InternalName", "PilotPane");
        AddString(strings, "LegalCopyright", "MIT License");
        AddString(strings, "OriginalFilename", "PilotPane.exe");
        AddString(strings, "ProductName", "PilotPane");
        AddString(strings, "ProductVersion", version);

        byte[] table = Block("040904B0", null, 0, 1, strings);
        byte[] stringInfo = Block("StringFileInfo", null, 0, 1, new List<byte[]> { table });
        byte[] translation = Block("Translation", new byte[] { 0x09, 0x04, 0xB0, 0x04 }, 4, 0, null);
        byte[] varInfo = Block("VarFileInfo", null, 0, 1, new List<byte[]> { translation });

        return Block("VS_VERSION_INFO", fixedInfo.ToArray(), 52, 0, new List<byte[]> { stringInfo, varInfo });
    }

    static void AddString(List<byte[]> list, string key, string value)
    {
        byte[] data = Encoding.Unicode.GetBytes(value + "\0");
        list.Add(Block(key, data, data.Length / 2, 1, null));
    }

    // One version-resource block: length, value length, type, key, padding, value, then children, each 4-byte aligned.
    static byte[] Block(string key, byte[] value, int valueLength, int type, List<byte[]> children)
    {
        MemoryStream ms = new MemoryStream();
        BinaryWriter w = new BinaryWriter(ms);
        w.Write((ushort)0);
        w.Write((ushort)valueLength);
        w.Write((ushort)type);
        w.Write(Encoding.Unicode.GetBytes(key + "\0"));
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
    }

    static void Pad(MemoryStream ms)
    {
        while (ms.Length % 4 != 0) ms.WriteByte(0);
    }
}
