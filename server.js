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

// Mount Modern REST APIs (compatible with both /api prefix and root rewrites)
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', apiRoutes);

// Fallback route: Always serve the React Application
app.get('*', (req, res) => {
  const distIndex = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

// Express Error Handler - Always return JSON on error
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, error: err.message || 'आंतरिक सर्वर त्रुटि' });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚆 Mata Vaishno Devi Train System Server running on port ${PORT}`);
});

module.exports = app;
