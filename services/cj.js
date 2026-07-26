const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }),
  });
  const data = await res.json();

  if (!data.result) {
    throw new Error(`فشل الحصول على توكن CJ: ${data.message}`);
  }

  cachedToken = data.data.accessToken;
  cachedTokenExpiry = Date.now() + 14 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function createSupplierOrder(order) {
  const token = await getAccessToken();
  const isSandbox = process.env.CJ_SANDBOX === '1' ? 1 : 0;

  const payload = {
    orderNumber: order.orderNumber,
    shippingCustomerName: order.customerName,
    shippingAddress: order.address,
    shippingCity: order.city,
    shippingProvince: order.province || order.city,
    shippingCountryCode: order.countryCode,
    shippingZip: order.zip || '',
    shippingPhone: order.phone || '',
    email: order.email || '',
    remark: 'أوتوماتيك من المتجر',
    logisticName: process.env.CJ_LOGISTIC_NAME || 'CJPacket Ordinary',
    fromCountryCode: 'CN',
    payType: 2,
    isSandbox,
    products: order.lines.map((l) => ({
      vid: l.cjVid,
      quantity: l.qty,
    })),
  };

  const res = await fetch(`${CJ_BASE}/shopping/order/createOrderV2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!data.result) {
    throw new Error(`فشل إرسال الطلبية لـ CJ: ${data.message}`);
  }
  return data.data;
}

module.exports = { getAccessToken, createSupplierOrder };
