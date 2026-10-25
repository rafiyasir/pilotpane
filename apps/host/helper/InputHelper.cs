// pilotpane-input: puts mouse and keyboard input on the screen with Win32 SendInput.
// Reads one command per line from stdin (see PROTOCOL.md). Compiled by
// scripts/build-helper.mjs with the .NET Framework csc.exe that ships with Windows,
// so it must stay C# 5 (no string interpolation, no "?.").
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;

internal static class InputHelper
{
    private const uint INPUT_MOUSE = 0;
    private const uint INPUT_KEYBOARD = 1;
    private const uint MOUSEEVENTF_MOVE = 0x0001;
    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    private const uint MOUSEEVENTF_WHEEL = 0x0800;
    private const uint MOUSEEVENTF_HWHEEL = 0x1000;
    private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const int WHEEL_DELTA = 120;

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public InputUnion u;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, INPUT[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern uint MapVirtualKey(uint code, uint mapType);

    // Buttons and keys currently held, released when stdin closes.
    private static readonly HashSet<string> HeldButtons = new HashSet<string>();
    private static readonly HashSet<int> HeldKeys = new HashSet<int>();

    private static int Main()
    {
        Console.Out.WriteLine("ready");
        Console.Out.Flush();

        string line;
        while ((line = Console.In.ReadLine()) != null)
        {
            if (line.Length == 0) continue;
            try
            {
                if (!Handle(line)) Console.Error.WriteLine("ignored: " + Truncate(line));
            }
            catch (Exception e)
            {
                Console.Error.WriteLine("error: " + e.Message);
            }
        }

        ReleaseAll();
        return 0;
    }

    private static bool Handle(string line)
    {
        string[] p = line.Split(' ');
        int a, b;
        switch (p[0])
        {
            case "M":
                if (p.Length != 3 || !Num(p[1], 0, 65535, out a) || !Num(p[2], 0, 65535, out b)) return false;
                Mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, a, b, 0);
                return true;
            case "B":
                if (p.Length != 3 || (p[2] != "0" && p[2] != "1")) return false;
                return Button(p[1], p[2] == "1");
            case "W":
                if (p.Length != 3 || !Num(p[1], -100, 100, out a) || !Num(p[2], -100, 100, out b)) return false;
                if (b != 0) Mouse(MOUSEEVENTF_WHEEL, 0, 0, b * WHEEL_DELTA);
                if (a != 0) Mouse(MOUSEEVENTF_HWHEEL, 0, 0, a * WHEEL_DELTA);
                return true;
            case "K":
                if (p.Length != 3 || !Num(p[1], 1, 254, out a) || (p[2] != "0" && p[2] != "1")) return false;
                Key(a, p[2] == "1");
                return true;
            default:
                return false;
        }
    }

    private static bool Num(string s, int min, int max, out int value)
    {
        return int.TryParse(s, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out value)
            && value >= min && value <= max;
    }

    private static string Truncate(string s)
    {
        return s.Length > 40 ? s.Substring(0, 40) : s;
    }

    private static bool Button(string code, bool down)
    {
        uint flag;
        switch (code)
        {
            case "L": flag = down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP; break;
            case "R": flag = down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP; break;
            case "M": flag = down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP; break;
            default: return false;
        }
        if (down) HeldButtons.Add(code); else HeldButtons.Remove(code);
        Mouse(flag, 0, 0, 0);
        return true;
    }

    private static void Mouse(uint flags, int dx, int dy, int data)
    {
        INPUT input = new INPUT();
        input.type = INPUT_MOUSE;
        input.u.mi.dx = dx;
        input.u.mi.dy = dy;
        input.u.mi.mouseData = unchecked((uint)data);
        input.u.mi.dwFlags = flags;
        Send(input);
    }

    private static void Key(int vk, bool down)
    {
        if (down) HeldKeys.Add(vk); else HeldKeys.Remove(vk);
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = (ushort)vk;
        input.u.ki.wScan = (ushort)MapVirtualKey((uint)vk, 0);
        uint flags = IsExtended(vk) ? KEYEVENTF_EXTENDEDKEY : 0;
        if (!down) flags |= KEYEVENTF_KEYUP;
        input.u.ki.dwFlags = flags;
        Send(input);
    }

    // Arrows, Insert/Delete/Home/End/PageUp/PageDown, NumLock, Windows keys, right-hand
    // Ctrl/Alt, Divide and Apps need the extended flag to be read correctly.
    private static bool IsExtended(int vk)
    {
        return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C
            || vk == 0x5D || vk == 0x6F || vk == 0x90 || vk == 0xA3 || vk == 0xA5;
    }

    private static void Send(INPUT input)
    {
        if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) == 0)
            Console.Error.WriteLine("SendInput failed: " + Marshal.GetLastWin32Error());
    }

    private static void ReleaseAll()
    {
        foreach (string code in new List<string>(HeldButtons)) Button(code, false);
        foreach (int vk in new List<int>(HeldKeys)) Key(vk, false);
    }
}
