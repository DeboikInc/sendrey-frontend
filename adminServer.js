// adminserver.js
const express = require('express');
const path = require('path');
const connectDb = require('./config/database');
const User = require('./models/User');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Start server
const startAdminServer = async () => {
  try {
    await connectDb();
    console.log('✅ Admin Server: Database connected');

    // Main KYC Dashboard
    app.get('/admin/kyc', async (req, res) => {
      try {
        const pendingRunners = await User.find({
          role: 'runner',
          $or: [
            { 'runnerProfile.verificationDocuments.nin.status': 'pending_review' },
            { 'runnerProfile.verificationDocuments.driverLicense.status': 'pending_review' },
            { 'runnerProfile.biometricVerification.status': 'pending_review' }
          ]
        }).select('firstName lastName email phone runnerProfile createdAt');

        res.render('admin/kyc-dashboard', {
          pendingRunners,
          title: 'KYC Verification Dashboard'
        });
      } catch (error) {
        console.error('Error fetching pending KYC:', error);
        res.status(500).send('Error loading dashboard');
      }
    });

    // View detailed runner KYC
    app.get('/admin/kyc/runner/:id', async (req, res) => {
      try {
        const runner = await User.findById(req.params.id);
        
        if (!runner) {
          return res.status(404).send('Runner not found');
        }

        res.render('admin/kyc-detail', {
          runner,
          title: `KYC Review - ${runner.firstName} ${runner.lastName}`
        });
      } catch (error) {
        console.error('Error fetching runner details:', error);
        res.status(500).send('Error loading runner details');
      }
    });

    // Approve specific document
    app.post('/admin/kyc/approve-document/:id', async (req, res) => {
      try {
        const { documentType } = req.body; // 'nin', 'driverLicense'
        
        const updateField = `runnerProfile.verificationDocuments.${documentType}`;
        await User.findByIdAndUpdate(req.params.id, {
          [`${updateField}.verified`]: true,
          [`${updateField}.status`]: 'approved',
          [`${updateField}.verifiedAt`]: new Date(),
          [`${updateField}.verifiedBy`]: 'admin' // You can add admin user ID here
        });

        // Recalculate runner status
        const user = await User.findById(req.params.id);
        const newStatus = await calculateRunnerStatus(user);
        await User.findByIdAndUpdate(req.params.id, { runnerStatus: newStatus });

        res.redirect(`/admin/kyc/runner/${req.params.id}`);
      } catch (error) {
        console.error('Error approving document:', error);
        res.status(500).send('Error approving document');
      }
    });

    // Reject specific document
    app.post('/admin/kyc/reject-document/:id', async (req, res) => {
      try {
        const { documentType, reason } = req.body;
        
        const updateField = `runnerProfile.verificationDocuments.${documentType}`;
        await User.findByIdAndUpdate(req.params.id, {
          [`${updateField}.verified`]: false,
          [`${updateField}.status`]: 'rejected',
          [`${updateField}.rejectedAt`]: new Date(),
          [`${updateField}.rejectionReason`]: reason
        });

        res.redirect(`/admin/kyc/runner/${req.params.id}`);
      } catch (error) {
        console.error('Error rejecting document:', error);
        res.status(500).send('Error rejecting document');
      }
    });

    // Approve selfie
    app.post('/admin/kyc/approve-selfie/:id', async (req, res) => {
      try {
        await User.findByIdAndUpdate(req.params.id, {
          'runnerProfile.biometricVerification.selfieVerified': true,
          'runnerProfile.biometricVerification.status': 'approved',
          'runnerProfile.biometricVerification.verifiedAt': new Date()
        });

        // Recalculate runner status
        const user = await User.findById(req.params.id);
        const newStatus = await calculateRunnerStatus(user);
        await User.findByIdAndUpdate(req.params.id, { 
          runnerStatus: newStatus,
          isVerified: newStatus === 'approved_full'
        });

        res.redirect(`/admin/kyc/runner/${req.params.id}`);
      } catch (error) {
        console.error('Error approving selfie:', error);
        res.status(500).send('Error approving selfie');
      }
    });

    // Reject selfie
    app.post('/admin/kyc/reject-selfie/:id', async (req, res) => {
      try {
        const { reason } = req.body;
        
        await User.findByIdAndUpdate(req.params.id, {
          'runnerProfile.biometricVerification.selfieVerified': false,
          'runnerProfile.biometricVerification.status': 'rejected',
          'runnerProfile.biometricVerification.rejectedAt': new Date(),
          'runnerProfile.biometricVerification.rejectionReason': reason
        });

        res.redirect(`/admin/kyc/runner/${req.params.id}`);
      } catch (error) {
        console.error('Error rejecting selfie:', error);
        res.status(500).send('Error rejecting selfie');
      }
    });

    // Helper function to calculate runner status
    async function calculateRunnerStatus(user) {
      const docs = user.runnerProfile?.verificationDocuments || {};
      const biometrics = user.runnerProfile?.biometricVerification || {};

      const verifiedDocs = [];
      if (docs.nin?.verified) verifiedDocs.push('nin');
      if (docs.driverLicense?.verified) verifiedDocs.push('driverLicense');

      const pendingDocs = [];
      if (docs.nin?.status === 'pending_review') pendingDocs.push('nin');
      if (docs.driverLicense?.status === 'pending_review') pendingDocs.push('driverLicense');

      if (pendingDocs.length > 0 || biometrics.status === 'pending_review') {
        return 'pending_verification';
      }

      if (verifiedDocs.length === 0) {
        return 'pending_verification';
      } else if (verifiedDocs.length >= 1 && biometrics.selfieVerified) {
        return 'approved_full';
      } else if (verifiedDocs.length >= 1) {
        return 'approved_limited';
      } else {
        return 'pending_verification';
      }
    }

    const PORT = process.env.ADMIN_PORT || 5001;
    app.listen(PORT, () => {
      console.log(`✅ Admin Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start admin server:', error);
    process.exit(1);
  }
};

startAdminServer();