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
app.use(express.static(path.join(__dirname, 'public', 'app')));
app.use(express.static(path.join(__dirname, 'public')));

// Mount Modern REST APIs
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Helper function to seed initial high-quality records if database is empty
async function seedInitialData() {
  try {
    const existing = await BookingService.getBookings();
    if (existing.length === 0) {
      console.log('🌱 Seeding initial sample Yatra bookings for demonstration...');
      await BookingService.createBooking({
        yatraYear: 2026,
        bookedBy: 'Pandit Rajesh Shastri',
        mobile: '9876543210',
        aadhar: '987654321012',
        email: 'rajesh.shastri@gmail.com',
        fromStation: 'New Delhi (NDLS)',
        toStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
        travelClass: 'AC',
        coachName: 'A1',
        seatNumber: ['1', '2'],
        travelDate: '2026-10-14',
        advancePayment: 8000,
        discount: 0,
        passengers: [
          { name: 'Pandit Rajesh Shastri', age: 52, gender: 'Male', aadhar: '987654321012', seatAssigned: '1', berthPreference: 'Lower' },
          { name: 'Kamlesh Shastri', age: 49, gender: 'Female', aadhar: '987654321013', seatAssigned: '2', berthPreference: 'Middle' }
        ],
        notes: 'Annual Navratri Yatra Group'
      });

      await BookingService.createBooking({
        yatraYear: 2026,
        bookedBy: 'Suresh Kumar Agrawal',
        mobile: '9811223344',
        aadhar: '332211445566',
        email: 'suresh.agrawal@yahoo.com',
        fromStation: 'Lucknow Charbagh (LKO)',
        toStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
        travelClass: 'Sleeper',
        coachName: 'S1',
        seatNumber: ['5', '6', '7'],
        travelDate: '2026-10-14',
        advancePayment: 4000,
        discount: 500,
        passengers: [
          { name: 'Suresh Kumar Agrawal', age: 44, gender: 'Male', aadhar: '332211445566', seatAssigned: '5', berthPreference: 'Middle' },
          { name: 'Sarita Agrawal', age: 41, gender: 'Female', aadhar: '332211445567', seatAssigned: '6', berthPreference: 'Upper' },
          { name: 'Rahul Agrawal', age: 16, gender: 'Male', aadhar: '332211445568', seatAssigned: '7', berthPreference: 'Side Lower' }
        ],
        notes: 'Family Pilgrimage'
      });

      console.log('✅ Initial Yatra sample records created successfully.');
    }
  } catch (err) {
    console.warn('Could not seed sample data:', err.message);
  }
}

// Fallback route: Always serve the React Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

// Start listening
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚆 MATA VAISHNO DEVI TRAIN TICKET BOOKING SYSTEM 2.0`);
  console.log(`📍 Server live at: http://localhost:${PORT}`);
  console.log(`🔥 Database Engine: ${isFirebaseActive ? 'Firebase Cloud Firestore' : 'Persistent Local Firestore-compatible JSON Storage'}`);
  console.log(`=======================================================`);
  await seedInitialData();
});
