"""Builds preview.html from index.html.

The preview looks like the real form but never contacts Google or PayPal,
so volunteers can try it safely. Run after any change to index.html:

    python3 tools/make_preview.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
s = (ROOT / 'index.html').read_text()


def rep(old, new):
    global s
    if old not in s:
        raise SystemExit('make_preview: expected text not found in index.html:\n' + old)
    s = s.replace(old, new, 1)


rep('<title>FCR Fundraiser Gift Form</title>',
    '<title>FCR Gift Form Preview</title>\n  <meta name="robots" content="noindex">')
rep('    [hidden] { display: none !important; }', '''    .preview-bar {
      background: var(--olive); color: #fff; text-align: center;
      font-size: 15px; font-weight: 600; padding: 10px 16px;
    }
    [hidden] { display: none !important; }''')
rep('<header class="hero">',
    '<div class="preview-bar" role="note">Preview only. Submissions aren\'t saved, '
    'and the payment button won\'t charge anything.</div>\n  <header class="hero">')
rep('<script src="config.js"></script>', '''<script>
  // Preview copy of index.html: never contacts Google or PayPal.
  window.FCR_CONFIG = {
    scriptUrl: 'preview',
    paypalUrl: 'https://www.paypal.com/donate/?hosted_button_id=RM5T2WRZLW4S2',
    itemDonations: true
  };
  </script>''')
rep("var staff = params.has('staff');", 'var staff = false;')
rep("      // text/plain avoids a CORS preflight, which Apps Script can't answer.\n"
    "      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })\n"
    "        .then(function (r) { return r.json(); })",
    "      // Preview: pretend the submission succeeded.\n"
    "      new Promise(function (res) { setTimeout(function () { res({ ok: true }); }, 500); })")
rep("            $('paypal-wrap').hidden = false;",
    "            $('paypal-wrap').hidden = false;\n"
    "            $('paypal-link').removeAttribute('href');\n"
    "            $('paypal-link').setAttribute('aria-disabled', 'true');\n"
    "            $('paypal-hint').textContent += ' (In the live form, this button opens the secure payment page.)';")
if 'fetch(' in s:
    raise SystemExit('make_preview: preview still contains fetch()')

(ROOT / 'preview.html').write_text(s)
print('Wrote preview.html')
