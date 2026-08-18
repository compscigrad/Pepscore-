Montserrat, SIL Open Font License 1.1 (see `OFL.txt` in this directory).
Source: https://github.com/google/fonts/tree/main/ofl/montserrat
(Google Fonts canonical mirror of the upstream Montserrat OFL release.)

`Montserrat-Bold.ttf` / `Montserrat-Regular.ttf` are static weight instances
extracted from the upstream variable font (`fonttools varLib.instancer`,
wght=700 / wght=400) so both Pillow and reportlab can load them directly
without variable-font axis support. Used only by the asset-generation
scripts in this directory (`compose_family_photo.py`, `generate_label.py`)
-- not served to the website, which continues to load Montserrat from
Google Fonts as before. Matches the site's own `font-heading` family
(tailwind.config.ts), so generated imagery/labels use the same typeface
as the brand's own web typography, not a substitute.

OFL explicitly permits bundling/embedding in software; this is a
compliant redistribution of an open-license font, not a proprietary
system font (the prior Segoe UI dependency this replaces was not
appropriate to bundle).
