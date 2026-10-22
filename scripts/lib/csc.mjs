// Finds the csc.exe (C# compiler) that ships with Windows' .NET Framework. Returns null if absent.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function findCsc() {
  const windir = process.env.WINDIR ?? 'C:\Windows';
  return (
    ['Framework64', 'Framework']
      .map((f) => join(windir, 'Microsoft.NET', f, 'v4.0.30319', 'csc.exe'))
      .find((p) => existsSync(p)) ?? null
  );
}
