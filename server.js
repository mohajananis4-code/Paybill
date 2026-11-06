import express from 'express';
import crypto from 'node:crypto';

const { PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID, PORT = 3000 } = process.env;
const BASE = 'https://api-m.sandbox.paypal.com';
const DL_WINDOW_MS = 24 * 3600 * 1000, MAX_DL = 3;

// Shop prices live on the SERVER. Never trust amounts sent by the client.
const SHOPS = { fashionhub: { name: 'Chennai Fashion Hub', gstRate: 0.05,
  items: [{ n: 'Shirt', price: 5, qty: 2 }, { n: 'Jeans', price: 12, qty: 1 }, { n: 'Delivery', price: 0.5, qty: 1 }] } };

const receipts = new Map(), byOrder = new Map(), dlTokens = new Map();
const rid = () => crypto.randomBytes(9).toString('base64url');   // unguessable id
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const mask = e => { const [u, d] = e.split('@'); return u.slice(0, 2) + '***@' + d; };

async function accessToken() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
               'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!r.ok) throw new Error('PayPal auth failed');
  return (await r.json()).access_token;
}
async function pp(path, body) {
  const r = await fetch(BASE + path, { method: 'POST',
    headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
function markPaid(r, captureId) {            // idempotent: webhook + capture may both call this
  if (r.status === 'PAID') return;
  Object.assign(r, { status: 'PAID', captureId, paidAt: Date.now(),
    expiresAt: Date.now() + DL_WINDOW_MS, downloadsLeft: MAX_DL });
}
const view = r => ({ id: r.id, type: r.type, title: r.title, to: r.toMasked, reason: r.reason,
  lines: r.lines, total: r.total, currency: 'USD', status: r.status, txn: r.captureId,
  paidAt: r.paidAt, downloadExpiresAt: r.expiresAt, downloadsLeft: r.downloadsLeft });

const app = express();
app.use(express.static('public'));                                  // serves public/index.html
app.get('/config', (req, res) => res.json({ clientId: PAYPAL_CLIENT_ID })); // client id is public; secret never leaves server

// 1) Create order  (body: {type:'p2p', amount, reason, email} or {type:'shop', shopId})
app.post('/api/orders', express.json(), async (req, res) => {
  try {
    const { type, shopId, amount, reason, email } = req.body;
    let total, lines = [], title, toMasked, note = '';
    if (type === 'shop') {
      const s = SHOPS[shopId]; if (!s) return res.status(400).json({ error: 'unknown shop' });
      lines = s.items.map(i => ({ n: i.n, qty: i.qty, amt: i.price * i.qty }));
      const sub = lines.reduce((a, l) => a + l.amt, 0), gst = +(sub * s.gstRate).toFixed(2);
      lines.push({ n: 'GST', qty: 1, amt: gst }); total = +(sub + gst).toFixed(2); title = s.name;
    } else if (type === 'p2p') {
      const a = Number(amount);
      if (!(a > 0 && a <= 10000) || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'bad input' });
      total = +a.toFixed(2); title = 'Person to Person'; toMasked = mask(email);   // full email never stored
      note = String(reason || '').slice(0, 100);
    } else return res.status(400).json({ error: 'bad type' });

    const order = await pp('/v2/checkout/orders', { intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'USD', value: total.toFixed(2) }, description: title.slice(0, 120) }] });
    const r = { id: rid(), type, title, toMasked, reason: note, lines, total, status: 'PENDING', orderId: order.id };
    receipts.set(r.id, r); byOrder.set(order.id, r.id);
    res.json({ orderId: order.id, receiptId: r.id });
  } catch (e) { console.error(e.message); res.status(500).json({ error: 'order failed' }); }
});

// 2) Capture after customer approves in PayPal
app.post('/api/orders/:orderId/capture', async (req, res) => {
  try {
    const r = receipts.get(byOrder.get(req.params.orderId)); if (!r) return res.sendStatus(404);
    const cap = await pp(`/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}/capture`);
    const c = cap.purchase_units?.[0]?.payments?.captures?.[0];
    if (c?.status === 'COMPLETED') markPaid(r, c.id);
    res.json(view(r));
  } catch (e) { console.error(e.message); res.status(500).json({ error: 'capture failed' }); }
});

// 3) Webhook: only trust it if PayPal's signature verifies
app.post('/webhook', express.json(), async (req, res) => {
  try {
    const h = k => req.get(k);
    const v = await pp('/v1/notifications/verify-webhook-signature', {
      auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'), transmission_sig: h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'), webhook_id: PAYPAL_WEBHOOK_ID, webhook_event: req.body });
    if (v.verification_status !== 'SUCCESS') return res.sendStatus(400);
    if (req.body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const c = req.body.resource, orderId = c.supplementary_data?.related_ids?.order_id;
      const r = receipts.get(byOrder.get(orderId)); if (r) markPaid(r, c.id);
    }
    res.sendStatus(200);
  } catch (e) { console.error(e.message); res.sendStatus(400); }
});

// 4) Receipt view (TODO: add login so only payer/payee can open)
app.get('/api/receipts/:id', (req, res) => {
  const r = receipts.get(req.params.id); r ? res.json(view(r)) : res.sendStatus(404);
});

// 5) Download: server-side expiry + count, one-time token
app.post('/api/receipts/:id/download', (req, res) => {
  const r = receipts.get(req.params.id);
  if (!r || r.status !== 'PAID') return res.sendStatus(403);
  if (Date.now() > r.expiresAt || r.downloadsLeft <= 0) return res.status(410).json({ error: 'download expired' });
  const t = crypto.randomBytes(24).toString('base64url');
  dlTokens.set(t, { id: r.id, until: Date.now() + 120000 });
  res.json({ url: `/download/${t}` });
});
app.get('/download/:t', (req, res) => {
  const t = dlTokens.get(req.params.t); dlTokens.delete(req.params.t);   // single use
  const r = t && receipts.get(t.id);
  if (!r || Date.now() > t.until || Date.now() > r.expiresAt || r.downloadsLeft <= 0) return res.sendStatus(410);
  r.downloadsLeft--;
  const rows = r.lines.map(l => `<tr><td>${esc(l.n)} x${l.qty}</td><td>$${l.amt.toFixed(2)}</td></tr>`).join('');
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="bill-${r.id}.html"` });
  res.send(`<h2>${esc(r.title)}</h2><p>PAID · Txn ${esc(r.captureId)}${r.toMasked ? ' · To ' + esc(r.toMasked) : ''}</p>
<p>${esc(r.reason)}</p><table>${rows}</table><h3>Total $${r.total.toFixed(2)}</h3>`);   // TODO: swap for real PDF (pdfkit)
});

app.listen(PORT, () => console.log('PayBill backend on :' + PORT));
