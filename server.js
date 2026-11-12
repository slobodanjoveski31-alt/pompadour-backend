const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'pompadour_db.json');

app.use(cors());
app.use(express.json());

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { orders: [], nextOrderNum: 1006 };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
    res.send('Pompadour Beverly Hills Backend API is LIVE!');
});

app.get('/api/orders', (req, res) => {
    const db = readDB();
    res.json(db);
});

app.post('/api/orders', (req, res) => {
    const db = readDB();
    const newOrder = {
        id: db.nextOrderNum,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        origin: req.body.origin || 'Kiosk Terminal',
        cake: req.body.cake || 'None',
        items: req.body.items || 'None',
        paid: parseFloat(req.body.paid) || 0,
        status: parseFloat(req.body.paid) || 0,
        authorizedBy: 'System',
        isVoided: false
    };
    db.orders.unshift(newOrder);
    db.nextOrderNum++;
    writeDB(db);
    res.json({ success: true, order: newOrder, nextOrderNum: db.nextOrderNum });
});

app.post('/api/orders/:id/void', (req, res) => {
    const orderId = parseInt(req.params.id);
    const { authorizedBy } = req.body;
    const db = readDB();

    const order = db.orders.find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.isVoided = true;
    order.status = 0;
    order.authorizedBy = authorizedBy || 'Staff';

    writeDB(db);
    res.json({ success: true, order });
});

// НОВО: Автоматски PDF сметководствен извештај од базата
app.get('/api/report/pdf', (req, res) => {
    const db = readDB();
    const orders = [...db.orders].reverse();

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Pompadour_Financial_Report.pdf"');
    doc.pipe(res);

    // Заглавие на брендот
    doc.fillColor('#C9A961').fontSize(20).font('Helvetica-Bold').text('POMPADOUR BEVERLY HILLS', { align: 'center' });
    doc.fillColor('#374151').fontSize(11).font('Helvetica').text('Official Shift Accounting & Volumetric Kiosk Audit Report', { align: 'center' });
    doc.fontSize(9).fillColor('#6b7280').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Пресметка на биланс
    let grossTotal = 0;
    let voidedTotal = 0;
    let netTotal = 0;

    orders.forEach(o => {
        grossTotal += o.paid;
        if (o.isVoided) voidedTotal += o.paid;
        else netTotal += o.status;
    });

    // Финансиско резиме кутија
    doc.rect(40, doc.y, 515, 55).fillAndStroke('#f8fafc', '#cbd5e1');
    const boxY = doc.y + 12;
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
    doc.text(`Gross Terminal Volume: $${grossTotal.toFixed(2)}`, 55, boxY);
    doc.fillColor('#ef4444').text(`Voided / Refunded: -$${voidedTotal.toFixed(2)}`, 235, boxY);
    doc.fillColor('#16a34a').text(`REAL NET BALANCE: $${netTotal.toFixed(2)}`, 400, boxY);
    doc.moveDown(3.5);

    // Заглавие на табела
    let y = doc.y;
    doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold');
    doc.text('ID', 40, y);
    doc.text('Time', 80, y);
    doc.text('Terminal', 140, y);
    doc.text('Order Details', 230, y);
    doc.text('Paid', 410, y);
    doc.text('Net Balance', 460, y);
    doc.text('Auth', 520, y);

    y += 15;
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#94a3b8').stroke();
    y += 8;

    // Редови со трансакции
    doc.font('Helvetica').fontSize(8.5);
    orders.forEach(row => {
        if (y > 750) { doc.addPage(); y = 50; }
        const details = [row.cake !== 'None' ? row.cake : '', row.items !== 'None' ? row.items : ''].filter(Boolean).join(', ') || 'Custom Order';
        const shortDetails = details.length > 34 ? details.substring(0, 31) + '...' : details;

        doc.fillColor('#111827');
        doc.text(`#${row.id}`, 40, y);
        doc.text(row.time, 80, y);
        doc.text(row.origin.replace(' Terminal', '').replace(' Handoff', ''), 140, y);
        doc.text(shortDetails, 230, y);
        doc.text(`$${row.paid.toFixed(2)}`, 410, y);

        if (row.isVoided) {
            doc.fillColor('#ef4444').text('($0.00) VOID', 460, y);
        } else {
            doc.fillColor('#16a34a').text(`$${row.status.toFixed(2)}`, 460, y);
        }
        doc.fillColor('#4b5563').text(row.authorizedBy.split(' ')[0], 520, y);
        y += 18;
    });

    doc.end();
});

app.listen(PORT, () => {
    console.log(`Pompadour Backend Server with PDF Engine running on port ${PORT}`);
});