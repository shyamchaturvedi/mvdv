const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { BookingService } = require('./services/bookingService');
const { isFirebaseActive } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'mvd_secret_pilgrimage_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Serve React Single Page App as the primary frontend
const fs = require('fs');
const distPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(path.join(__dirname, 'public', 'app')));
app.use(express.static(path.join(__dirname, 'public')));

// Mount Modern REST APIs
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Fallback route: Always serve the React Application
app.get('*', (req, res) => {
  const distIndex = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

// Start listening if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚆 MATA VAISHNO DEVI TRAIN TICKET BOOKING SYSTEM 2.0`);
    console.log(`📍 Server live at: http://localhost:${PORT}`);
    console.log(`🔥 Database Engine: ${isFirebaseActive ? 'Firebase Cloud Firestore' : 'Persistent Local Firestore-compatible JSON Storage'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
