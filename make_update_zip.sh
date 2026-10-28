#!/usr/bin/env bash
# Make a small zip of just what changed, to drag onto the GitHub repo page (Add file > Upload files).
# Always includes data/ and audio/ (the recorded sounds, v11; skipped when there is no audio folder). Add anything else you changed by naming it (paths relative to the site folder),
# or use --newer-than FILE to include every site file modified after FILE.
#
#   ./make_update_zip.sh [-o OUT.zip] [--prefix FOLDER] [--newer-than FILE] [extra files or folders...]
#
#   --prefix FOLDER   put everything inside FOLDER/ in the zip (the live site is in a folder called
#                     ju-learning-site, so use: --prefix ju-learning-site)
# Paths are preserved. Uses `zip` if installed, otherwise python3's zipfile.
set -euo pipefail
cd "$(dirname "$0")"
OUT="../ju-learning-update-$(date +%Y-%m-%d).zip"; PREFIX=""; NEWER=""; EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    -o) OUT="$2"; shift 2;;
    --prefix) PREFIX="${2%/}"; shift 2;;
    --newer-than) NEWER="$2"; shift 2;;
    -h|--help) sed -n '2,12p' "$0"; exit 0;;
    *) EXTRA+=("$1"); shift;;
  esac
done
LIST=$(mktemp); trap 'rm -f "$LIST"' EXIT
{
  find data -type f
  [ -d audio ] && find audio -type f
  if [ -n "$NEWER" ]; then
    find . -type f -newer "$NEWER" -not -path './tests/*' -not -path './.git/*' -not -name '*.zip' -not -name '*.pyc' -not -path '*/__pycache__/*' | sed 's|^\./||'
  fi
  if [ ${#EXTRA[@]} -gt 0 ]; then
    for p in "${EXTRA[@]}"; do
      [ -e "$p" ] || { echo "make_update_zip.sh: no such file: $p" >&2; exit 1; }
      if [ -d "$p" ]; then find "$p" -type f; else echo "$p"; fi
    done
  fi
} | sed 's|^\./||' | sort -u > "$LIST"
rm -f "$OUT"
if [ -z "$PREFIX" ] && command -v zip >/dev/null 2>&1; then
  zip -q "$OUT" -@ < "$LIST"
else
  python3 - "$OUT" "$PREFIX" "$LIST" <<'PY'
import sys, zipfile
out, prefix, lst = sys.argv[1:4]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in open(lst).read().split("\n"):
        if p:
            z.write(p, (prefix + "/" + p) if prefix else p)
PY
fi
echo "Wrote $OUT"; python3 -c "import zipfile,sys;[print('  '+n) for n in zipfile.ZipFile(sys.argv[1]).namelist()]" "$OUT"
