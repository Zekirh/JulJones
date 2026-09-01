const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { orders: [], transactions: [], deliveries: [] };
    }
}

async function writeDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/orders', async (req, res) => {
    try {
        const { name, phone, email, delivery, address, special, items, total } = req.body;
        
        if (!name || !phone || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required order information' });
        }

        const db = await readDB();
        const order = {
            id: Date.now().toString(),
            name,
            phone,
            email: email || '',
            delivery,
            address: address || '',
            special: special || '',
            items,
            total,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        db.orders.push(order);
        db.transactions.push({
            id: Date.now().toString(),
            type: 'order',
            amount: total,
            customerId: name,
            status: 'pending',
            createdAt: order.createdAt
        });

        await writeDB(db);
        res.status(201).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process order' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const db = await readDB();
        const order = db.orders.find(o => o.id === req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const db = await readDB();
        const order = db.orders.find(o => o.id === req.params.id);
        
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        order.status = status;
        const transaction = db.transactions.find(t => t.id === order.id);
        if (transaction) transaction.status = status;

        if (status === 'delivered') {
            db.deliveries.push({
                id: Date.now().toString(),
                orderId: order.id,
                customer: order.name,
                items: order.items,
                amount: order.total,
                deliveredAt: new Date().toISOString()
            });
        }

        await writeDB(db);
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.get('/api/deliveries', async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.deliveries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
});

app.listen(PORT, () => {
    console.log(`Admin dashboard running on http://localhost:${PORT}`);
});