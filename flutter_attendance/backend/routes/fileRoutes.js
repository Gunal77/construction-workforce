const express = require('express');
const { getFileFromGridFS } = require('../services/uploadService');

const router = express.Router();

/**
 * GET /api/files/:fileId
 * Download file from MongoDB GridFS
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId || fileId.length !== 24) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const file = await getFileFromGridFS(fileId);
    
    // Set headers
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.length);
    
    // Stream file to response
    file.stream.pipe(res);
    
    file.stream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });
  } catch (error) {
    console.error('Get file error:', error);
    if (error.message === 'File not found') {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.status(500).json({ message: 'Error retrieving file' });
  }
});

module.exports = router;

