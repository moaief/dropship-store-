require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Stripe = require('stripe');
const cj = require('./services/cj');
const ledger = require('./lib/ledger');
const products = require('./data/products.json');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;
const CURRENCY = process.env.CURRENCY || 'usd';
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const ALLOWED_COUNTRIES = (process.env.ALLOWED_COUNTRIES || 'US,CA,GB,DE,FR,IL,JO,AE,SA')
  .split(',')
  .map((c) => c.trim());

const pendingOrders = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', (req, res) => {
  const publicProducts = products.map(({ id, name, category, price }) => ({
    id, name, category, price,
  }));
  res.json(publicProducts);
});

app.get('/api/ledger', (req, res) => {
  res.json(ledger.summary());
});

app.get('/api/orders', (req, res) => {
  res.json(ledger.readAll());
});

app.post('/api/checkout', express.json(), async (req, res) => {
  try {
    const items = req.body.items || [];
    if (items.length === 0) return res.status(400).json({ error: 'السلة فاضية' });

    const lines = items.map((item) => {
      const p = products.find((x) => x.id === item.id);
      if (!p) throw new Error(`منتج غير معروف: ${item.id}`);
      return { product: p, qty: Math.max(1, parseInt(item.qty, 10) || 1) };
    });

    const revenue = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    const cost = lines.reduce((s, l) => s + l.product.cost * l.qty, 0);
    const draftId = 'DR-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    pendingOrders.set(draftId, {
      id: draftId,
      lines: lines.map((l) => ({
        name: l.product.name, qty: l.qty, price: l.product.price,
        cost: l.product.cost, cjVid: l.product.cjVid,
      })),
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lines.map((l) => ({
        price_data: {
          currency: CURRENCY,
          product_data: { name: l.product.name },
          unit_amount: Math.round(l.product.price * 100),
        },
        quantity: l.qty,
      })),
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      metadata: { draftId },
      success_url: `${DOMAIN}/success.html?order=${draftId}`,
      cancel_url: `${DOMAIN}/index.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('توقيع الويبهوك غير صالح:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const draftId = session.metadata.draftId;
    const pending = pendingOrders.get(draftId);

    if (!pending) {
      console.warn('طلبية مدفوعة بس ما لقيتها بالذاكرة:', draftId);
      return res.status(200).send();
    }

    const shipping = session.shipping_details || session.customer_details;
    const address = shipping?.address || {};

    const order = {
      ...pending,
      stage: 'paid',
      customerName: shipping?.name || 'زبون',
      createdAt: new Date().toISOString(),
    };
    ledger.addOrder(order);
    pendingOrders.delete(draftId);

    try {
      const cjResult = await cj.createSupplierOrder({
        orderNumber: draftId,
        customerName: shipping?.name || 'Customer',
        address: address.line1 || '',
        city: address.city || '',
        province: address.state || '',
        countryCode: address.country || 'US',
        zip: address.postal_code || '',
        email: session.customer_details?.email || '',
        lines: order.lines.map((l) => ({ cjVid: l.cjVid, qty: l.qty })),
      });
      ledger.updateOrder(draftId, { stage: 'sent_to_supplier', cjOrderId: cjResult.orderId });
    } catch (err) {
      console.error('فشل إرسال الطلبية للمورد:', err.message);
      ledger.updateOrder(draftId, { stage: 'supplier_error', supplierError: err.message });
    }
  }

  res.status(200).send();
});

app.listen(PORT, () => {
  console.log(`المتجر شغال على المنفذ ${PORT}`);
});
