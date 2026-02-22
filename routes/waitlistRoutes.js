// routes/waitlist.js
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');


const { sendEmail } = require('../services/emailService');

router.post('/', async (req, res) => {
  const { email, name, role, type } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {

    const auth = new google.auth.GoogleAuth({
      keyFile: 'path/to/your-service-account.json', // Download from Google Cloud
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: 'YOUR_GOOGLE_SHEET_ID', // Get from sheet URL
      range: 'Sheet1!A:C',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toISOString(),
          email,
          name || '',
          role
        ]]
      },
    });

    // 2. Send email using your existing email service
    await sendEmail({
      to: email,
      subject: 'Thanks for joining the waitlist!',
      html: `<p>Hi ${name || 'there'},</p><p>We'll notify you when we launch.</p>`
    });

    // 3. Optional: Send notification to yourself
    await sendEmail({
      to: 'deboikinternational@gmail.com',
      subject: 'New Waitlist Signup',
      html: `<p>New signup: ${email} ${name ? `(${name}), role: ${role}` : ''}</p>`
    });

    res.status(201).json({ 
      success: true, 
      message: 'Added to waitlist successfully' 
    });

  } catch (error) {
    console.error('Waitlist error:', error);
    res.status(500).json({ 
      error: 'Failed to add to waitlist' 
    });
  }
});

module.exports = router;