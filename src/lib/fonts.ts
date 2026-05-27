import { JetBrains_Mono, Plus_Jakarta_Sans, Syne } from 'next/font/google';

/** Texto general de la UI */
export const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-family-sans',
  display: 'swap',
  weight: ['400', '600', '700'],
  preload: true,
});

/** Títulos y encabezados */
export const fontDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-family-display',
  display: 'swap',
  weight: ['600', '700'],
  preload: true,
});

/** Números, códigos, tablas tabulares */
export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-family-mono',
  display: 'swap',
  weight: ['400', '600'],
  preload: false,
});
