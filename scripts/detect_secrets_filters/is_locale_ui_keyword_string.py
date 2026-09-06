"""detect-secrets custom filter: KeywordDetector hits inside UI translation bundles.

Frontend #440: .secrets.baseline was 99% "password" UI strings. The KeywordDetector fires on
the WORD "password" in src/locales/*.json (form labels, placeholders, validation copy), and
the baseline stores an absolute line_number per entry — so any locale edit rewrote ~249
baseline rows and failed the commit until the rewrite was re-staged.

This filter excludes exactly one (detector, path) pair — KeywordDetector candidates inside
the locale bundles — instead of excluding the FILES. A file-level exclude would silence
every detector there (see the comment in .pre-commit-config.yaml for why that is wrong);
here every other plugin (entropy, AWS, JWT, ...) stays fully active on locale files, so a
real credential pasted as a translation value is still caught by its own detector class.

Known, accepted blind spot (the issue's argument, kept honest here): a LOW-entropy secret
sitting under a keyword-named key in a locale file is exactly the shape this filter drops.
That is not a shape translation files produce by accident, and it is the only detector
whose positives in a translation bundle cannot be true positives.

Registered from .secrets.baseline via filters_used:

    {
      "path": "file://scripts/detect_secrets_filters/is_locale_ui_keyword_string.py::is_locale_ui_keyword_string"
    }

detect-secrets injects only the parameters a filter declares by name, and only runs
secret-level filters that accept `context` — hence the otherwise-unused parameter.
"""
import re

# Locale bundles are JSON files directly under src/locales/.
_LOCALE_BUNDLE = re.compile(r'(^|/)src/locales/[^/]+\.json$')

# The detector class that fires on the KEYWORD ("password", "secret", ...) rather than on
# any property of the candidate value itself. Matched by class name so this module needs
# no detect-secrets import (an import here would run at filter-load time and turn any
# packaging change into a silently disabled filter).
_KEYWORD_DETECTOR = 'KeywordDetector'


def is_locale_ui_keyword_string(filename: str, plugin: object, context: object) -> bool:
    """Return True to exclude a candidate; only KeywordDetector hits in locale bundles."""
    if not _LOCALE_BUNDLE.search(filename):
        return False

    return type(plugin).__name__ == _KEYWORD_DETECTOR
