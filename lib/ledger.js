const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'ledger.json');

function readAll() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function saveAll(orders) {
  fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));
}

function addOrder(order) {
  const orders = readAll();
  orders.unshift(order);
  saveAll(orders);
  return order;
}

function updateOrder(id, patch) {
  const orders = readAll();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch };
  saveAll(orders);
  return orders[idx];
}

function summary() {
  const orders = readAll();
  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const cost = orders.reduce((s, o) => s + o.cost, 0);
  return { revenue, cost, profit: revenue - cost, count: orders.length };
}

module.exports = { readAll, addOrder, updateOrder, summary };
