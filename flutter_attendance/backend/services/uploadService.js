const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

// MongoDB GridFS bucket for file storage
let gridFSBucket = null;

// Initialize GridFS bucket
const getGridFSBucket = () => {
  if (!gridFSBucket) {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB connection not established. Cannot initialize GridFS bucket.');
    }
    const db = mongoose.connection.db;
    gridFSBucket = new GridFSBucket(db, { bucketName: 'files' });
  }
  return gridFSBucket;
};

// Build file URL (for serving files via API)
const buildFileUrl = (fileId) => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  return `${baseUrl}/api/files/${fileId}`;
};

/**
 * Upload file to MongoDB GridFS
 * @param {Object} file - Multer file object with buffer
 * @param {string} userId - User ID for organizing files
 * @param {string} category - File category (attendance, leave-documents, etc.)
 * @returns {Promise<string>} File URL
 */
const uploadToGridFS = async (file, userId, category = 'attendance') => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is required');
  }

  const extension = path.extname(file.originalname || '') || '.jpg';
  const filename = `${category}/${userId}/${Date.now()}-${crypto.randomUUID()}${extension}`;
  
  const bucket = getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        userId,
        category,
        originalName: file.originalname,
        uploadedAt: new Date(),
      },
    });

    uploadStream.on('error', (error) => {
      reject(new Error(`GridFS upload failed: ${error.message}`));
    });

    uploadStream.on('finish', () => {
      const fileId = uploadStream.id.toString();
      const fileUrl = buildFileUrl(fileId);
      resolve(fileUrl);
    });

    uploadStream.end(file.buffer);
  });
};

/**
 * Upload attendance image to MongoDB GridFS
 * @param {Object} file - Multer file object
 * @param {string} userId - User ID
 * @returns {Promise<string>} File URL
 */
const uploadAttendanceImage = async (file, userId) => {
  try {
    return await uploadToGridFS(file, userId, 'attendance');
  } catch (error) {
    console.error('GridFS upload error:', error);
    throw new Error(`Failed to upload image to MongoDB: ${error.message}`);
  }
};

/**
 * Upload leave document to MongoDB GridFS
 * @param {Object} file - Multer file object
 * @param {string} employeeId - Employee ID
 * @returns {Promise<string>} File URL
 */
const uploadLeaveDocument = async (file, employeeId) => {
  return await uploadToGridFS(file, employeeId, 'leave-documents');
};

/**
 * Get file from GridFS by ID
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<Object>} File stream and metadata
 */
const getFileFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  const fileIdObj = new mongoose.Types.ObjectId(fileId);
  
  const files = await bucket.find({ _id: fileIdObj }).toArray();
  if (files.length === 0) {
    throw new Error('File not found');
  }
  
  const file = files[0];
  const downloadStream = bucket.openDownloadStream(fileIdObj);
  
  return {
    stream: downloadStream,
    contentType: file.contentType || 'application/octet-stream',
    filename: file.filename,
    length: file.length,
  };
};

/**
 * Delete file from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<void>}
 */
const deleteFileFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  const fileIdObj = new mongoose.Types.ObjectId(fileId);
  await bucket.delete(fileIdObj);
};

module.exports = {
  uploadAttendanceImage,
  uploadLeaveDocument,
  getFileFromGridFS,
  deleteFileFromGridFS,
};
