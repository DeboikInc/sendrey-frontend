// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage(); // Store in memory for processing

const fileFilter = (req, file, cb) => {
  console.log('Upload attempt:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    ext: path.extname(file.originalname),
  });

  const allowedMimetypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  const allowedExts = /\.(jpeg|jpg|png|webp|heic|heif)$/i;

  const validMime = allowedMimetypes.includes(file.mimetype);
  const validExt = allowedExts.test(path.extname(file.originalname));

  if (validMime || validExt) {  // OR instead of AND — one check is enough
    return cb(null, true);
  }

  cb(new Error('Only images are allowed (jpeg, jpg, png, webp)'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

module.exports = upload;