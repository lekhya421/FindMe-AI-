const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES.split(',');
  const normalizedMime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  
  if (allowedTypes.includes(normalizedMime)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  },
  fileFilter
});

module.exports = upload;
