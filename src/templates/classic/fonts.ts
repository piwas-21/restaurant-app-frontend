// classic template fonts (ADR-006). Extracted verbatim from the root
// layout's hardcoded Inter load — same subset config, so the generated
// @font-face CSS and body className are unchanged.
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const fonts = [inter];
