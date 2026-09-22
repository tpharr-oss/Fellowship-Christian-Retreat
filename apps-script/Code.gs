/**
 * Fellowship Christian Retreat at Crow's Neck — Fundraiser intake endpoint.
 *
 * Receives submissions from the landing page (index.html) and writes each one
 * into the next empty row of the "FCR Fundraiser Tracker" sheet, matching the
 * template columns A–O. Column L (Total Payment) is left alone so the sheet's
 * own formula keeps computing the total.
 *
 * Setup: see README.md. Deploy as a Web app (Execute as: Me, Access: Anyone).
 * Optional: set a Script Property named STAFF_KEY. When set, only submissions
 * that include the matching key can record Payment Status and Check / Ref #.
 *
 * Items donated to the auction go to a separate "Donated Auction Items" tab,
 * which is created automatically the first time one is submitted.
 */

var SHEET_NAME = 'FCR Fundraiser Tracker';
var FIRST_DATA_ROW = 6;   // Row 5 holds the headers
var LAST_DATA_ROW = 500;  // Template formulas / validation run through row 500

var PAYMENT_METHODS = ['Cash', 'Check', 'Online Payment', 'Credit Card', 'Other'];
var PAYMENT_STATUSES = ['Paid', 'Pending', 'Partial'];
var MAX_TEXT = 500;

var ITEMS_SHEET_NAME = 'Donated Auction Items';
var ITEMS_HEADERS = ['Date', 'Donor Name', 'Email', 'Phone', 'Address', 'Item Type',
  'Item Description', 'Estimated Value', 'Suggested Starting Bid', 'Notes', 'Item Status'];
var ITEM_TYPES = ['Gift basket', 'Gift card', 'Art', 'Experience or service', 'Other'];
var MAX_ITEMS = 10;

function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(body);

    // Honeypot: real people never fill the hidden "website" field.
    if (data.website) return json_({ ok: true });

    var props = PropertiesService.getScriptProperties();
    var staffKey = props.getProperty('STAFF_KEY');
    var isStaff = !!data.staff && (!staffKey || data.staffKey === staffKey);
    if (data.staff && !isStaff) {
      return json_({ ok: false, error: 'Staff key is incorrect.' });
    }

    var now = new Date();
    var items = buildItemRows_(data, isStaff, now);
    var hasMoney = moneyTotal_(data) > 0;
    if (!hasMoney && !items.length) {
      throw new Error('Enter at least one amount or an auction item you are donating.');
    }
    var row = hasMoney ? buildRow_(data, isStaff, now) : null;

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      // SHEET_ID is only needed when the script was created at script.google.com
      // instead of from the sheet's Extensions menu.
      var sheetId = props.getProperty('SHEET_ID');
      var book = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
      if (!book) throw new Error('Spreadsheet not found. Set the SHEET_ID script property.');
      if (row) {
        var sheet = book.getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
        var r = nextEmptyRow_(sheet);
        sheet.getRange(r, 1, 1, 11).setValues([row.slice(0, 11)]);  // A–K
        sheet.getRange(r, 13, 1, 3).setValues([row.slice(11)]);      // M–O
      }
      if (items.length) {
        var itemsSheet = itemsSheet_(book);
        var start = itemsSheet.getLastRow() + 1;
        itemsSheet.getRange(start, 1, items.length, ITEMS_HEADERS.length).setValues(items);
      }
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'FCR fundraiser intake' });
}

/**
 * Turns a submission into the 14 values for columns A–K and M–O.
 * Throws with a readable message when the submission is invalid.
 */
function buildRow_(data, isStaff, now) {
  var name = clean_(data.name);
  var email = clean_(data.email);
  if (!name) throw new Error('Name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required.');
  }

  var donation = money_(data.donation, 'Donation');
  var tickets = money_(data.tickets, 'Tickets');
  var sponsorship = money_(data.sponsorship, 'Sponsorship');
  var auction = money_(data.auction, 'Auction');
  if (donation + tickets + sponsorship + auction <= 0) {
    throw new Error('Enter at least one amount.');
  }

  // PayPal isn't in the sheet's dropdown, so it's recorded as Online Payment
  // with "PayPal" added to the notes.
  var isPayPal = data.paymentMethod === 'PayPal';
  var method = isPayPal ? 'Online Payment'
    : PAYMENT_METHODS.indexOf(data.paymentMethod) >= 0 ? data.paymentMethod : 'Other';

  var date = now;
  var status = 'Pending';
  var ref = '';
  if (isStaff) {
    if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      var p = data.date.split('-');
      date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    if (PAYMENT_STATUSES.indexOf(data.paymentStatus) >= 0) status = data.paymentStatus;
    ref = clean_(data.reference);
  }

  var notes = clean_(data.notes);
  if (isPayPal) notes = notes ? 'PayPal - ' + notes : 'PayPal';
  if (!isStaff) notes = notes ? 'Online form: ' + notes : 'Online form';

  return [
    date,                          // A Date
    name,                          // B Name
    clean_(data.address),          // C Address
    clean_(data.phone),            // D Phone
    email,                         // E Email
    donation,                      // F Donation Amount
    tickets,                       // G Tickets Amount
    sponsorship,                   // H Sponsorship Amount
    auction,                       // I Auction Amount
    clean_(data.auctionItem),      // J Auction Item / Details
    notes,                         // K Other / Notes
    method,                        // M Payment Method
    ref,                           // N Check / Ref #
    status                         // O Payment Status
  ];
}

/** Sum of the four amounts. Throws if any amount isn't a valid number. */
function moneyTotal_(data) {
  return money_(data.donation, 'Donation') + money_(data.tickets, 'Tickets') +
    money_(data.sponsorship, 'Sponsorship') + money_(data.auction, 'Auction');
}

/** One row per donated auction item, for the Donated Auction Items tab. */
function buildItemRows_(data, isStaff, now) {
  var list = Array.isArray(data.items) ? data.items : [];
  if (!list.length) return [];
  if (list.length > MAX_ITEMS) throw new Error('Please list up to ' + MAX_ITEMS + ' items per submission.');

  var name = clean_(data.name);
  var email = clean_(data.email);
  if (!name) throw new Error('Name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required.');
  }
  var date = now;
  if (isStaff && data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    var p = data.date.split('-');
    date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  var notes = clean_(data.notes);
  if (!isStaff) notes = notes ? 'Online form: ' + notes : 'Online form';

  return list.map(function (it, i) {
    it = it || {};
    var description = clean_(it.description);
    if (!description) throw new Error('Describe donated item ' + (i + 1) + '.');
    var value = money_(it.value, 'Estimated value for item ' + (i + 1));
    if (value <= 0) throw new Error('Enter an estimated value for donated item ' + (i + 1) + '.');
    var bid = money_(it.startingBid, 'Starting bid for item ' + (i + 1));
    return [
      date, name, clean_(data.address), clean_(data.phone), email,
      ITEM_TYPES.indexOf(it.type) >= 0 ? it.type : 'Other',
      description, value, bid || '', notes, 'Not yet received'
    ];
  });
}

/** The Donated Auction Items tab, created with headers on first use. */
function itemsSheet_(book) {
  var sheet = book.getSheetByName(ITEMS_SHEET_NAME);
  if (sheet) return sheet;
  sheet = book.insertSheet(ITEMS_SHEET_NAME);
  sheet.getRange(1, 1, 1, ITEMS_HEADERS.length).setValues([ITEMS_HEADERS])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#355E3B');
  sheet.setFrozenRows(1);
  sheet.getRange('A2:A').setNumberFormat('m/d/yyyy');
  sheet.getRange('H2:I').setNumberFormat('$#,##0.00');
  sheet.getRange('K2:K').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not yet received', 'Received', 'Auctioned'], true).build());
  sheet.setColumnWidth(7, 320);
  return sheet;
}

/** First row at or below FIRST_DATA_ROW with nothing in Date or Name. */
function nextEmptyRow_(sheet) {
  var count = LAST_DATA_ROW - FIRST_DATA_ROW + 1;
  var values = sheet.getRange(FIRST_DATA_ROW, 1, count, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === '' && values[i][1] === '') return FIRST_DATA_ROW + i;
  }
  throw new Error('The tracker is full. Please contact the event team.');
}

/** Trims, caps length, and blocks spreadsheet formula injection. */
function clean_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_TEXT);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function money_(v, label) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(String(v).replace(/[$,\s]/g, ''));
  if (!isFinite(n) || n < 0) throw new Error(label + ' amount is not valid.');
  return Math.round(n * 100) / 100;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
