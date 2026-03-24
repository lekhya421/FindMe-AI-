const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Only configure if credentials are provided
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'demo') {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary configured');
} else {
  console.log('⚠️  Cloudinary not configured - using local file storage');
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

exports.uploadToCloudinary = async (file) => {
  const isCloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'demo';

  if (!isCloudinaryConfigured) {
    // Save file locally instead of using placeholder
    const uploadsDir = path.join(__dirname, '../../uploads');
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);
    
    // Return URL that points to local file
    return `/uploads/${fileName}`;
  }
  
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'findme',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
};

