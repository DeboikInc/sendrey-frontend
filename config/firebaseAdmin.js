const admin = require('firebase-admin');
const path = require('path');

// Path
const serviceAccount = require(path.join(__dirname, 'sendrey-cb4e6-firebase-adminsdk-fbsvc-c45466bf0a.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;