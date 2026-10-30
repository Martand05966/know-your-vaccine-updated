/**
 * Know Your Vaccine - Google Sheets backend (Apps Script Web App).
 *
 * The page POSTs a JSON snapshot (Content-Type text/plain, so no CORS preflight) on every
 * meaningful action. This script:
 *   1. UPSERTS one row per session_id in the "responses" tab (latest state of all answers), and
 *   2. APPENDS one row per action to the "events" tab (full click/answer history).
 *
 * Setup (one time):
 *   1. Create a Google Sheet. Extensions > Apps Script. Paste this file as Code.gs.
 *   2. Set KEY below to a random string, and put the same value in the SHEETS_KEY repo secret.
 *   3. Run setup() once from the editor (creates both tabs with headers, asks for permission).
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   5. Copy the /exec URL into the SHEETS_WEBHOOK_URL repo secret (or config/site.json for local tests).
 *   After editing this script: Deploy > Manage deployments > edit > Version: New version (the URL stays the same).
 */
var KEY = '';               // must match SHEETS_KEY; leave empty to disable the check
var RESPONSES = 'responses';
var EVENTS = 'events';

var RESPONSE_COLS = [
  'first_seen', 'last_updated', 'session_id', 'lead_id', 'family_of', 'status', 'last_event',
  'for_whom', 'age_group', 'gender', 'conditions',
  'name', 'phone', 'consent',
  'recommended_must', 'recommended_maybe', 'plan_value',
  'option_clicks', 'notify_requests', 'book_clicks', 'callback_requested', 'feedback', 'doctor_click',
  'device', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'wbraid', 'gbraid', 'fbc', 'fbp', 'page_url', 'referrer', 'user_agent', 'elapsed_ms', 'spam_flag'
];
var EVENT_COLS = ['timestamp', 'session_id', 'lead_id', 'event', 'event_detail', 'status',
  'for_whom', 'age_group', 'gender', 'conditions', 'device', 'utm_source', 'utm_campaign'];

var ALLOWED_EVENTS = ['about_completed', 'health_completed', 'lead_submitted', 'contact_skipped', 'family_plan_viewed',
  'option_click', 'notify_me', 'book_click', 'callback_request', 'feedback', 'doctor_click', 'not_eligible'];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[RESPONSES, RESPONSE_COLS], [EVENTS, EVENT_COLS]].forEach(function (t) {
    var sh = ss.getSheetByName(t[0]) || ss.insertSheet(t[0]);
    sh.getRange(1, 1, 1, t[1].length).setValues([t[1]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // Phone as plain text so leading digits / formatting are preserved.
  var r = ss.getSheetByName(RESPONSES);
  r.getRange(2, RESPONSE_COLS.indexOf('phone') + 1, r.getMaxRows() - 1, 1).setNumberFormat('@');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  v = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v.slice(0, max || 500);
}

function doGet() { return json_({ ok: true, service: 'know-your-vaccine' }); }

function doPost(e) {
  var d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'bad_json' }); }

  if (KEY && d.key !== KEY) return json_({ ok: false, error: 'bad_key' });
  if (!d.session_id || ALLOWED_EVENTS.indexOf(d.event) < 0) return json_({ ok: false, error: 'bad_payload' });

  var phone = String(d.phone || '').replace(/\D/g, '');
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return json_({ ok: false, error: 'bad_phone' });
  var spam = (d.honeypot ? 'honeypot ' : '') + (d.event === 'lead_submitted' && Number(d.elapsed_ms) > 0 && Number(d.elapsed_ms) < 3000 ? 'too_fast' : '');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var resp = ss.getSheetByName(RESPONSES), ev = ss.getSheetByName(EVENTS);
    if (!resp || !ev) { setup(); resp = ss.getSheetByName(RESPONSES); ev = ss.getSheetByName(EVENTS); }
    var now = new Date();

    // ---- upsert responses row by session_id ----
    var sidCol = RESPONSE_COLS.indexOf('session_id') + 1;
    var found = resp.getRange(2, sidCol, Math.max(resp.getLastRow() - 1, 1), 1)
      .createTextFinder(String(d.session_id)).matchEntireCell(true).findNext();
    var rowIdx = found ? found.getRow() : resp.getLastRow() + 1;
    var existing = found ? resp.getRange(rowIdx, 1, 1, RESPONSE_COLS.length).getValues()[0] : null;

    var row = RESPONSE_COLS.map(function (c, i) {
      if (c === 'first_seen') return existing ? existing[i] : now;
      if (c === 'last_updated') return now;
      if (c === 'last_event') return clean_(d.event);
      if (c === 'phone') return phone || (existing ? existing[i] : '');
      if (c === 'spam_flag') return spam || (existing ? existing[i] : '');
      var v = d[c];
      // Never blank out a value we already have (e.g. a later event without the name).
      if ((v === '' || v == null) && existing) return existing[i];
      return clean_(v);
    });
    resp.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    if (!found) resp.getRange(rowIdx, RESPONSE_COLS.indexOf('phone') + 1).setNumberFormat('@').setValue(row[RESPONSE_COLS.indexOf('phone')]);

    // ---- append event ----
    ev.appendRow(EVENT_COLS.map(function (c) { return c === 'timestamp' ? now : clean_(d[c]); }));

    return json_({ ok: true, row: rowIdx });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
