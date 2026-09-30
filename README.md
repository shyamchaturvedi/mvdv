# mvdv

🚩 **श्री माता वैष्णो देवी विशेष तीर्थ यात्रा - ट्रेन आरक्षण एवं प्रबंधन प्रणाली (MVD Train Ticket Management System)**

A complete, high-fidelity train reservation, receipt generation, refund/cancellation, coach allocation, and administrative management software developed for Shri Mata Vaishno Devi Yatra Special Train operations.

---

## ✨ Features & Capabilities

1. **IRCTC-Standard Electronic Reservation Slip (ERS)**
   - Exact 1-page A4 print & PDF format.
   - PNR, Coach/Seat allocation, barcode, QR code verification.
   - Clean Hindi & English bilingual metadata.

2. **Mandir Trust Payment & Refund Slips**
   - Exact A4 Half-page receipt vouchers with official seals and signatures.
   - Dedicated refund slip generation (processed via source account within 5-7 working days).

3. **Admin & Counter Dashboard**
   - Total Bookings, Fare Collection, Advance Received, Remaining Dues & Refund metrics.
   - Defaulter tracking, live seat charts, bulk printing, and Excel data export.
   - Action controls with full-fit responsive design on all screens.

4. **Multi-Station Dynamic Pricing & Coach Management**
   - Dynamic route fare calculation based on Admin settings.
   - S1-S12 sleeper coaches, berths, seat charts, and automatic allocation.

5. **Security & Role-Based Access**
   - Admin and Counter Staff roles with PIN/password protection.
   - Audit trail for bookings, payments, cancellations, and refunds.

---

## 🛠 Tech Stack

- **Frontend:** React + Vite + Lucide Icons + DM Sans / Poppins / Hind Typography
- **Backend:** Node.js + Express
- **Database:** SQLite (Better-SQLite3) with automatic migrations
- **PDF Engine:** PDFKit with custom vector layouts & Indian currency formatting
- **Styling:** Custom Vanilla CSS with saffron/bhagwa spiritual aesthetic

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
npm run build
cd ..
```

### 2. Run the Server
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📞 Support & Credits
- **Admin Contact:** iammshyam@gmail.com
- **Software Developed By:** [ArovenTech](https://www.aroventech.site) (Phone: +91 9598023701)
