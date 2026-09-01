const API_BASE = 'http://localhost:3001/api';
let currentOrderId = null;

async function fetchOrders() {
    const res = await fetch(`${API_BASE}/orders`);
    const orders = await res.json();
    
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'pending').length;
    document.getElementById('deliveredOrders').textContent = orders.filter(o => o.status === 'delivered').length;
    document.getElementById('totalRevenue').textContent = `₵${orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}`;

    const tbody = document.getElementById('ordersBody');
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id.slice(-6)}</td>
            <td>${order.name}</td>
            <td>${order.items.map(i => i.name).join(', ')}</td>
            <td>₵${(order.total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${order.status}</span></td>
            <td>${new Date(order.createdAt).toLocaleString()}</td>
            <td><button class="btn" onclick="openStatusModal('${order.id}')">Update</button></td>
        </tr>
    `).join('');
}

async function fetchTransactions() {
    const res = await fetch(`${API_BASE}/transactions`);
    const transactions = await res.json();
    
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>#${t.id.slice(-6)}</td>
            <td>${t.customerId}</td>
            <td>₵${(t.amount || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${t.status}">${t.status}</span></td>
            <td>${new Date(t.createdAt).toLocaleString()}</td>
        </tr>
    `).join('');
}

async function fetchDeliveries() {
    const res = await fetch(`${API_BASE}/deliveries`);
    const deliveries = await res.json();
    
    const tbody = document.getElementById('deliveriesBody');
    tbody.innerHTML = deliveries.map(d => `
        <tr>
            <td>#${d.orderId.slice(-6)}</td>
            <td>${d.customer}</td>
            <td>${d.items.map(i => i.name).join(', ')}</td>
            <td>₵${(d.amount || 0).toFixed(2)}</td>
            <td>${new Date(d.deliveredAt).toLocaleString()}</td>
        </tr>
    `).join('');
}

function openStatusModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('statusModal').classList.add('active');
}

document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('statusModal').classList.remove('active');
});

document.getElementById('updateStatusBtn').addEventListener('click', async () => {
    const status = document.getElementById('newStatus').value;
    await fetch(`${API_BASE}/orders/${currentOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    document.getElementById('statusModal').classList.remove('active');
    fetchOrders();
    fetchTransactions();
    fetchDeliveries();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
});

fetchOrders();
fetchTransactions();
fetchDeliveries();
setInterval(fetchOrders, 5000);