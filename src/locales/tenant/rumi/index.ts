// RUMI's own home-page + SEO copy (tenant 1), applied only when this image was built with
// NEXT_PUBLIC_TENANT_COPY_PACK=rumi — build-image.yml's PROD job, the same seam that applies
// public/branding-rumi/. Every string here is the value the shared bundle carried before the
// tenant-neutral sweep, so RUMI prod renders byte-identically in all ten locales.
//
// RUMI genuinely IS a Turkish restaurant in Geneva, Switzerland; that is why the country is
// spelled out rather than interpolated here, and why none of it belongs in the bundle every
// other tenant inherits. See src/lib/tenantCopy.ts and docs/TENANT-COPY.md.
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import nl from './nl.json';
import ru from './ru.json';
import tr from './tr.json';
import zh from './zh.json';

export const rumiCopy = { en, de, tr, it, ar, fr, nl, es, ru, zh };
