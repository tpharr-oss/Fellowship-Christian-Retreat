# FCR Fundraiser Gift Form

A one-page intake form for the Fellowship Christian Retreat at Crow's Neck annual
fundraising event. Each submission is added as a new row in the
**FCR Fundraiser Tracker** Google Sheet, which uses the same columns as the
template in `template/`.

| File | What it is |
|---|---|
| `index.html` | The landing page and form |
| `config.js` | Where you paste the Google Apps Script URL |
| `apps-script/Code.gs` | The script that writes submissions into the sheet |
| `preview.html` | A preview copy that never saves anything. Rebuild it with `python3 tools/make_preview.py` |
| `template/…v6.xlsx` | The original tracker template |

## How a submission maps to the sheet

| Column | Filled from |
|---|---|
| A Date | Date submitted (staff can choose a date) |
| B Name, D Phone, E Email | Form fields |
| C Address | Street, City, State, and ZIP combined, e.g. `123 Main St, Iuka, MS 38852` |
| F–I Donation / Tickets / Sponsorship / Auction | The four amount boxes (blank = 0) |
| J Auction Item / Details | Shown only when an Auction amount is entered |
| K Other / Notes | Notes. Public entries start with "Online form" so you can tell them apart. |
| L Total Payment | **Not written.** The sheet's own formula keeps calculating it. |
| M Payment Method | Cash, Check, Online Payment, Credit Card, or Other (the template's dropdown values). PayPal is recorded as **Online Payment**, with "PayPal" added to Notes. |
| N Check / Ref # | Staff mode only |
| O Payment Status | Public entries are always **Pending**. Staff choose Paid, Pending, or Partial. |

**Donated auction items** (gift baskets, gift cards, art, and so on) go to a separate tab named
**Donated Auction Items**, one row per item. The script creates that tab the first time
someone donates an item. It has these columns: Date, Donor Name, Email, Phone, Address, Item Type,
Item Description, Estimated Value, Suggested Starting Bid, Notes, and Item Status. Item Status
starts as "Not yet received", and you can change it to Received or Auctioned. A submission that only
donates an item doesn't add a row to the main tracker, because no money is involved.

The form's **Auction item I won** box is for *paying* for an item someone won. That money goes in the
tracker's Auction Amount column as before.

Each submission goes into the first row between 6 and 500 where both Date and Name are empty.
The template's sample rows are skipped. You can delete them at any time.

## Two modes

- **Public:** `https://your-site/` is for donors and supporters.
- **Staff:** `https://your-site/?staff` shows Date received, Payment status,
  Check / Ref #, and a Staff key. Use it to record checks and cash at the event, or to
  mark payments Paid.

Anyone could type `?staff` onto the address, so set a **staff key** (step 3 below).
The script rejects staff entries that don't include the key, which means the public
can't mark their own gift Paid.
Each browser remembers the key after its first successful staff entry.

## Setup (about 10 minutes)

1. **Put the tracker in Google Sheets.** Upload
   `template/Fellowship_Retreat_Simple_Fundraiser_Tracker_FCRC_v6.xlsx` to Google Drive,
   open it, and choose **File → Save as Google Sheets**. Keep the tab named
   `FCR Fundraiser Tracker`.
2. **Add the script.** In that Google Sheet, go to **Extensions → Apps Script**.
   Delete the starter code, paste in all of `apps-script/Code.gs`, and save.
3. **Set the staff key (recommended).** In Apps Script, open **Project Settings (gear icon) →
   Script Properties → Add property**. Name: `STAFF_KEY`. Value: a passphrase for your
   volunteers.
4. **Deploy.** Go to **Deploy → New deployment**, choose type **Web app**, and set:
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click Deploy and approve the permissions. Copy the **Web app URL** (it ends in `/exec`).
5. **Connect the page.** Paste that URL into `config.js` (and your PayPal link, if you're using PayPal):
   ```js
   window.FCR_CONFIG = { scriptUrl: 'https://script.google.com/macros/s/…/exec' };
   ```
6. **Publish the page.** In GitHub, open this repo's **Settings → Pages**. Set the source to
   the branch that has these files and the folder to `/ (root)`. The form will be live at the
   Pages URL. Share `…/?staff` only with volunteers.

**Can't find the Extensions menu (for example, on a phone)?** Create the script at
**script.google.com → New project** instead and paste in `Code.gs`. Then add a second
Script Property: `SHEET_ID`, set to the long ID in the sheet's address, between `/d/`
and `/edit`. Everything else is the same.

**If you change `Code.gs` later:** go to **Deploy → Manage deployments → Edit (pencil) →
Version: New version → Deploy**. The URL stays the same.

## PayPal

Put the retreat's PayPal link in `config.js` as `paypalUrl`. When it's set, **PayPal**
appears as a payment choice. After a PayPal submission is recorded, the thank-you
screen shows a **Pay with PayPal** button.

- With a **PayPal.Me** link (`https://paypal.me/YourName`), the button opens PayPal
  with the total already filled in.
- With any other PayPal link (for example, a Donate button link), the button opens that
  page and tells the person what amount to enter.

The form can't tell whether the person actually finished paying on PayPal. PayPal rows
come in as **Pending**. Check the PayPal account, then mark the row **Paid** and put
the PayPal transaction ID in Check / Ref #.

## Notes

- This form doesn't take payments. It records what someone is giving and how they
  plan to pay. Card or online payments still go through whatever system the retreat
  already uses. Staff can then mark the row **Paid** and add the reference number.
- The form collects names, addresses, phone numbers, and emails. Share the Google Sheet only
  with the people who need it.
- There's also basic spam protection: a hidden field that bots fill in. Submissions with it
  filled are thrown away.
- Text that begins with `=`, `+`, `-`, or `@` gets an apostrophe added, so the sheet won't
  treat it as a formula.
