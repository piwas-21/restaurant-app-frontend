/**
 * Which way the document reads, per locale.
 *
 * This exists because `app/layout.tsx` hardcoded `<html lang="en">` and carried **no `dir`
 * attribute at all**, while `i18n.ts` swapped strings and nothing else. Picking Arabic therefore
 * translated every word and left the document reading left-to-right — and told a screen reader the
 * page was English, so Arabic was announced with an English voice.
 *
 * `lang` is the half with no downside: it fixes speech synthesis, font selection and hyphenation
 * without moving a pixel. `dir` genuinely moves the layout, and the CSS is not yet written for it
 * (116 of 233 modules still use physical `margin-left`/`text-align: left` rather than logical
 * properties — BUGS-IMPROVEMENTS-PLAN E8 slices 2-3). Measured on the running app before shipping:
 * the chrome mirrors correctly, because this codebase leans on flex/grid with `gap` rather than
 * absolute offsets. The known residue is directional — icons that point at a side, and
 * `text-overflow` clipping the wrong end of a Latin name.
 */

/**
 * Right-to-left scripts among the ten locales the app ships. Only Arabic today; kept as a set
 * because Hebrew, Persian and Urdu are the obvious next additions and a set makes that one line.
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

export type TextDirection = 'ltr' | 'rtl';

/**
 * Base language of a possibly-regioned tag (`ar-EG` → `ar`), lowercased. i18next hands back
 * whatever the detector found, which may be either form.
 */
export function baseLanguage(language: string): string {
  return (language || 'en').split('-')[0].toLowerCase();
}

export function directionFor(language: string): TextDirection {
  return RTL_LANGUAGES.has(baseLanguage(language)) ? 'rtl' : 'ltr';
}
