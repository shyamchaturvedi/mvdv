const ExcelJS = require('exceljs');
const { FARES, getBerthType } = require('./bookingService');

class ExcelService {
  // Export bookings to formatted Excel workbook
  static async exportBookingsToExcel(bookings, stream) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mata Vaishno Devi Public Charitable Trust';
    workbook.created = new Date();

    // Sheet 1: Master Bookings Summary
    const masterSheet = workbook.addWorksheet('Bookings Master', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    masterSheet.columns = [
      { header: 'Booking ID (PNR)', key: 'bookingId', width: 18 },
      { header: 'Yatra Year', key: 'yatraYear', width: 12 },
      { header: 'Booked By', key: 'bookedBy', width: 22 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Aadhar', key: 'aadhar', width: 16 },
      { header: 'From Station', key: 'fromStation', width: 20 },
      { header: 'To Station', key: 'toStation', width: 24 },
      { header: 'Class', key: 'travelClass', width: 12 },
      { header: 'Coach', key: 'coachName', width: 10 },
      { header: 'Seat Number(s)', key: 'seatNumber', width: 18 },
      { header: 'Passengers', key: 'numberOfPassengers', width: 12 },
      { header: 'Total Amount (₹)', key: 'totalAmount', width: 16 },
      { header: 'Advance (₹)', key: 'advance', width: 14 },
      { header: 'Discount (₹)', key: 'discount', width: 14 },
      { header: 'Remaining Due (₹)', key: 'remainingAmount', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
      { header: 'Travel Date', key: 'travelDate', width: 15 },
      { header: 'Booking Time', key: 'createdAt', width: 22 }
    ];

    // Header styling
    const headerRow = masterSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B192C' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    bookings.forEach(b => {
      const seats = Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : (b.seatNumber || '');
      masterSheet.addRow({
        bookingId: b.bookingId,
        yatraYear: b.yatraYear || 2026,
        bookedBy: b.bookedBy,
        mobile: b.mobile,
        aadhar: b.aadhar,
        fromStation: b.fromStation,
        toStation: b.toStation,
        travelClass: b.travelClass,
        coachName: b.coachName,
        seatNumber: seats,
        numberOfPassengers: b.numberOfPassengers || (b.passengers ? b.passengers.length : 1),
        totalAmount: b.totalAmount,
        advance: b.advance,
        discount: b.discount || 0,
        remainingAmount: b.remainingAmount,
        paymentStatus: b.paymentStatus,
        travelDate: b.travelDate || '',
        createdAt: b.createdAt ? new Date(b.createdAt).toLocaleString() : ''
      });
    });

    // Sheet 2: Individual Passengers Roster
    const paxSheet = workbook.addWorksheet('Passenger Roster', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    paxSheet.columns = [
      { header: 'Booking ID', key: 'bookingId', width: 18 },
      { header: 'Lead Devotee', key: 'bookedBy', width: 20 },
      { header: 'Passenger Name', key: 'name', width: 22 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Aadhar', key: 'aadhar', width: 16 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Coach', key: 'coachName', width: 10 },
      { header: 'Seat Assigned', key: 'seatAssigned', width: 14 },
      { header: 'Berth Type', key: 'berthPreference', width: 14 }
    ];

    const paxHeaderRow = paxSheet.getRow(1);
    paxHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    paxHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD84315' }
    };
    paxHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    bookings.forEach(b => {
      const passengers = b.passengers || [];
      passengers.forEach(p => {
        paxSheet.addRow({
          bookingId: b.bookingId,
          bookedBy: b.bookedBy,
          name: p.name,
          age: p.age,
          gender: p.gender || 'Male',
          aadhar: p.aadhar || '',
          mobile: p.mobile || b.mobile || '',
          coachName: b.coachName,
          seatAssigned: p.seatAssigned || p.seatNumber || '',
          berthPreference: p.berthPreference || ''
        });
      });
    });

    await workbook.xlsx.write(stream);
  }

  // Parse bulk bookings uploaded via Excel
  static async parseBulkBookingsFromExcel(filePath, defaultYear = 2026) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Excel file contains no readable worksheets.');
    }

    const bookings = [];
    const errors = [];
    let rowNum = 1;

    worksheet.eachRow({ includeEmpty: false }, (row, currentIdx) => {
      rowNum = currentIdx;
      if (currentIdx === 1) return; // Skip header

      try {
        const values = row.values;
        // Supports flexible column mapping:
        // [Index, BookedBy, Mobile, Aadhar, FromStation, ToStation, Class, CoachName, Seats, TravelDate, Advance, Discount, PassengerNames, PassengerAadhars, PassengerAges]
        const bookedBy = String(values[1] || '').trim();
        const mobile = String(values[2] || '').trim();
        const aadhar = String(values[3] || '').trim();
        const fromStation = String(values[4] || 'New Delhi (NDLS)').trim();
        const toStation = String(values[5] || 'Shri Mata Vaishno Devi Katra (SVDK)').trim();
        const travelClass = String(values[6] || 'Sleeper').trim();
        const coachName = String(values[7] || 'S1').trim();
        const seatStr = String(values[8] || '').trim();
        const travelDate = values[9] ? (values[9] instanceof Date ? values[9].toISOString().split('T')[0] : String(values[9]).trim()) : new Date().toISOString().split('T')[0];
        const advance = parseFloat(values[10]) || 0;
        const discount = parseFloat(values[11]) || 0;
        const paxNamesStr = String(values[12] || bookedBy).trim();
        const paxAadharsStr = String(values[13] || aadhar).trim();
        const paxAgesStr = String(values[14] || '').trim();

        if (!bookedBy) {
          errors.push(`Row ${rowNum}: 'Booked By' is missing.`);
          return;
        }

        const validClass = ['AC', 'Sleeper', 'General'].includes(travelClass) ? travelClass : 'Sleeper';
        const unitPrice = FARES[validClass] || 3000;

        const paxNames = paxNamesStr.split(',').map(s => s.trim()).filter(Boolean);
        const paxAadhars = paxAadharsStr.split(',').map(s => s.trim()).filter(Boolean);
        const paxAges = paxAgesStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        const seats = seatStr ? seatStr.split(',').map(s => s.trim()).filter(Boolean) : [];

        const paxCount = paxNames.length > 0 ? paxNames.length : 1;
        const totalAmount = unitPrice * paxCount;
        const remainingAmount = Math.max(0, totalAmount - (advance + discount));
        const paymentStatus = remainingAmount <= 0 ? 'Paid' : (advance > 0 ? 'Partial' : 'Unpaid');

        const passengers = paxNames.map((name, idx) => ({
          name,
          age: paxAges[idx] || null,
          gender: 'Male',
          aadhar: paxAadhars[idx] || (idx === 0 ? aadhar : ''),
          mobile: idx === 0 ? mobile : '',
          seatAssigned: seats[idx] || `${idx + 1}`,
          berthPreference: getBerthType(seats[idx] || (idx + 1), validClass)
        }));

        bookings.push({
          yatraYear: parseInt(defaultYear, 10) || 2026,
          bookedBy,
          mobile,
          aadhar,
          fromStation,
          toStation,
          travelClass: validClass,
          coachName,
          seatNumber: seats.length > 0 ? seats : passengers.map((_, i) => String(i + 1)),
          travelDate,
          numberOfPassengers: paxCount,
          unitPrice,
          totalAmount,
          advance,
          discount,
          remainingAmount,
          paymentStatus,
          passengers
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: Parsing failed (${err.message})`);
      }
    });

    return { bookings, errors };
  }

  // Generate Sample Excel Template for Admin Bulk Upload
  static async generateSampleExcel(stream) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bulk Booking Template');

    sheet.columns = [
      { header: 'Booked By', key: 'bookedBy', width: 22 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Aadhar', key: 'aadhar', width: 16 },
      { header: 'From Station', key: 'fromStation', width: 20 },
      { header: 'To Station', key: 'toStation', width: 24 },
      { header: 'Class (AC/Sleeper/General)', key: 'travelClass', width: 16 },
      { header: 'Coach (e.g. S1, A1)', key: 'coachName', width: 14 },
      { header: 'Seats (comma separated)', key: 'seatNumber', width: 20 },
      { header: 'Travel Date (YYYY-MM-DD)', key: 'travelDate', width: 16 },
      { header: 'Advance Paid (₹)', key: 'advance', width: 14 },
      { header: 'Discount (₹)', key: 'discount', width: 14 },
      { header: 'Passenger Names (comma separated)', key: 'paxNames', width: 32 },
      { header: 'Passenger Aadhars (comma separated)', key: 'paxAadhars', width: 32 },
      { header: 'Passenger Ages (comma separated)', key: 'paxAges', width: 24 }
    ];

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B192C' }
    };

    // Add 2 realistic sample rows
    sheet.addRow({
      bookedBy: 'Rameshwar Sharma',
      mobile: '9876543210',
      aadhar: '987654321012',
      fromStation: 'New Delhi (NDLS)',
      toStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
      travelClass: 'Sleeper',
      coachName: 'S1',
      seatNumber: '1, 2, 3',
      travelDate: '2026-10-15',
      advance: 5000,
      discount: 0,
      paxNames: 'Rameshwar Sharma, Sunita Sharma, Ankit Sharma',
      paxAadhars: '987654321012, 987654321013, 987654321014',
      paxAges: '52, 48, 22'
    });

    sheet.addRow({
      bookedBy: 'Vijay Kumar Verma',
      mobile: '9812345678',
      aadhar: '451278963214',
      fromStation: 'Kanpur Central (CNB)',
      toStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
      travelClass: 'AC',
      coachName: 'A1',
      seatNumber: '9, 10',
      travelDate: '2026-10-15',
      advance: 8000,
      discount: 0,
      paxNames: 'Vijay Kumar Verma, Pooja Verma',
      paxAadhars: '451278963214, 451278963215',
      paxAges: '42, 39'
    });

    await workbook.xlsx.write(stream);
  }
}

module.exports = ExcelService;
