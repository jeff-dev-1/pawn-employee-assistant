import type { ReactNode } from 'react';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

export const metadata = { title: 'PAWN Employee Assistant' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
