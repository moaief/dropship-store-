let products = [];
let cart = {};

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  const icons = { 'ملابس':'👕', 'إكسسوارات':'⌚', 'أدوات منزلية':'💡' };
  document.getElementById('productGrid').innerHTML = products.map(p => `
    <div class="card">
      <div class="card-icon">${icons[p.category] || '📦'}</div>
      <div class="card-cat">${p.category}</div>
      <p class="card-name">${p.name}</p>
      <div class="card-bottom">
        <span class="card-price">${p.price} ${window.CURRENCY_LABEL || '$'}</span>
        <button class="add-btn" onclick="addToCart('${p.id}')">أضف للسلة</button>
      </div>
    </div>`).join('');
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart);
  document.getElementById('cartCount').textContent = entries.reduce((s, [,q]) => s + q, 0);
  const box = document.getElementById('cartItems');
  const btn = document.getElementById('checkoutBtn');
  if (entries.length === 0) {
    box.innerHTML = '<div class="cart-empty">السلة فاضية</div>';
    btn.disabled = true;
  } else {
    box.innerHTML = entries.map(([id, qty]) => {
      const p = products.find(x => x.id === id);
      return `<div class="cart-item"><span>${p.name} × ${qty}</span><span>${(p.price*qty).toFixed(2)}</span></div>`;
    }).join('');
    btn.disabled = false;
  }
  const total = entries.reduce((s, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return s + p.price * qty;
  }, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(2);
}

function openCart() { document.getElementById('overlay').classList.add('open'); }
function closeCart() { document.getElementById('overlay').classList.remove('open'); }

async function checkout() {
  const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  btn.textContent = 'جاري التحويل لصفحة الدفع...';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('صار خطأ: ' + (data.error || 'غير معروف'));
      btn.disabled = false;
      btn.textContent = 'ادفع الآن';
    }
  } catch (err) {
    alert('تعذر الاتصال بالسيرفر');
    btn.disabled = false;
    btn.textContent = 'ادفع الآن';
  }
}

loadProducts();
renderCart();
