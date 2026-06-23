'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      disableTransitionOnChange
      // next-themes injects an inline <script> for FOUC prevention; React 19
      // warns about it in dev mode but it is harmless — the script runs via
      // dangerouslySetInnerHTML and suppressHydrationWarning is set internally.
      // scriptProps is the library's escape hatch to attach extra attributes.
      scriptProps={{ suppressHydrationWarning: true }}
    >
      {children}
    </NextThemesProvider>
  );
}
