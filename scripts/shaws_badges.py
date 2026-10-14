#!/usr/bin/env python3
"""Weekly Shaw's DIGITAL COUPON badge pass (optional; run from the refresh routine on the box, needs `tesseract`).
Reads each Shaw's flyer tile image (Flipp cutout), rotates it 270 degrees (the badge text is vertical), OCRs it, and records
ONLY positive reads of "DIGITAL" or "COUPON". A miss means nothing: on 2026-10-14 the pass found 22 of the ~40 known coupon
tiles (recall ~55%) with no false positives in 22 hits, so it only ever ADDS a 'Digital coupon / For U' label; it never removes one.
Usage: python3 scripts/shaws_badges.py [data/deals.json] -> data/badge_reads.json"""
import json, sys, os, subprocess, tempfile, urllib.request, concurrent.futures as cf, datetime
from PIL import Image, ImageOps
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
deals = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'data', 'deals.json')))['deals']
todo = [d for d in deals if d.get('store') == "Shaw's" and d.get('image_url') and d.get('flipp_item_id')]
def read(d):
    try:
        with tempfile.TemporaryDirectory() as t:
            p = os.path.join(t, 'a.jpg'); q = os.path.join(t, 'b.png')
            open(p, 'wb').write(urllib.request.urlopen(d['image_url'], timeout=20).read())
            im = Image.open(p).convert('L')
            ImageOps.autocontrast(im.rotate(270, expand=True)).resize((im.size[1] * 3, im.size[0] * 3)).save(q)
            txt = subprocess.run(['tesseract', q, '-', '--psm', '6'], capture_output=True, text=True, timeout=60).stdout.upper()
        return d, ('DIGITAL' in txt or 'COUPON' in txt), None
    except Exception as e:
        return d, False, str(e)
with cf.ThreadPoolExecutor(4) as ex: res = list(ex.map(read, todo))
items = {str(d['flipp_item_id']): {'coupon': True, 'image': d['image_url'], 'basis': 'OCR read "DIGITAL COUPON" on the flyer tile'} for d, hit, _ in res if hit}
out = {'_note': __doc__.strip().splitlines()[0], 'method': 'tesseract psm 6, tile rotated 270, autocontrast, 3x', 'fetched_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'scanned': len(todo), 'errors': sum(1 for _, _, e in res if e), 'items': items}
json.dump(out, open(os.path.join(R, 'data', 'badge_reads.json'), 'w'), indent=1)
print(f"badge pass: {len(items)} coupon tiles of {len(todo)} Shaw's tiles ({out['errors']} errors)")
