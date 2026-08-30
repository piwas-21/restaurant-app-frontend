#!/usr/bin/env bash
# Copy a tenant's branding asset set from <source-dir> over the platform defaults in
# public/branding/, for .github/workflows/build-tenant-image.yml.
#
# WHY a script and not two inline blocks: the workflow applies branding from two sources
# (`branding_url`, an https .tar.gz, and `branding_dir`, a path committed in this repo) and
# both must apply the SAME contract. They were duplicated, and the duplication is exactly how
# the install-icon leak below could reappear on one path only.
#
# THE CONTRACT
#   icon.svg        favicon + manifest vector icon
#   icon-192.png    manifest install icon, purpose "any"
#   icon-512.png    manifest install icon, purpose "any"
#   icon-maskable-512.png  manifest install icon, purpose "maskable" (20% inset)
#   hero.png        home hero background
#   placeholder.png menu item with no photo
#
# There is deliberately NO logo.png: since SOFRA-ONBOARDING-PLAN O6 the logo is runtime data
# (RestaurantInfo.logoUrl, uploaded in tenant admin). A baked one would silently win.
#
# THE ICON-SET RULE (why this script can fail the build)
#   src/app/manifest.ts asks for the three PNGs above. Before this rule they were not copied,
#   so a tenant that supplied its own icon.svg got its own favicon and the PLATFORM onion on
#   the phone home screen — another restaurant's mark on a paying tenant's device.
#   Copying the PNGs fixes the supplied case. The partial case (icon.svg supplied, PNGs not)
#   is FAILED LOUDLY rather than filled in:
#     - rendering them here would guess at design decisions the platform set encodes (the
#       #FCF6E6 plate, the 20% maskable inset) and would ship a wrong-looking icon SILENTLY,
#       which is the same class of bug as the leak;
#     - a tenant that supplies NO icon at all is a different, intended case: it inherits the
#       whole platform set consistently, and that stays allowed.
#   The failure is cheap: branding archives are assembled by the founder / control plane, so
#   the fix is to add three files, and the error says how to produce them.
set -euo pipefail

src="${1:?usage: apply-tenant-branding.sh <source-dir>}"
label="${2:-$src}"

[[ -d "$src" ]] || { echo "branding source not found: $src" >&2; exit 1; }

ICONS_PNG="icon-192.png icon-512.png icon-maskable-512.png"
ALL="icon.svg $ICONS_PNG hero.png placeholder.png"

applied=0
for f in $ALL; do
  if [[ -f "$src/$f" ]]; then
    cp "$src/$f" "public/branding/$f"
    echo "branding override applied: $f"
    applied=1
  fi
done

# Say so rather than dropping it silently: archives built to the pre-O6 spec still carry a logo.
for f in logo.png logo-dark.png; do
  if [[ -f "$src/$f" ]]; then
    echo "IGNORING $f - the logo is uploaded in tenant admin since O6, not baked"
  fi
done

if [[ "$applied" -eq 0 ]]; then
  echo "branding source $label contained none of: $ALL" >&2
  exit 1
fi

# The icon set travels together or not at all (see THE ICON-SET RULE above).
if [[ -f "$src/icon.svg" ]]; then
  missing=""
  for f in $ICONS_PNG; do
    [[ -f "$src/$f" ]] || missing="$missing $f"
  done
  if [[ -n "$missing" ]]; then
    echo "branding source $label supplies icon.svg but is MISSING:$missing" >&2
    echo "The web app manifest (src/app/manifest.ts) installs those three PNGs on the home" >&2
    echo "screen. Shipping without them would put the SofraPiwas onion on this tenant's" >&2
    echo "phone while their favicon is their own, so this build fails instead." >&2
    echo "Produce them from this icon.svg at 192/512 px (recipe in" >&2
    echo "public/branding/README.md), or omit icon.svg to inherit the whole" >&2
    echo "platform icon set consistently." >&2
    exit 1
  fi
fi
