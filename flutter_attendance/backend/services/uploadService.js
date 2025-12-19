const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

const buildStorageUrl = (path) => {
  const base = env.supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/${path.replace(/^\/+/, '')}`;
};

const uploadAttendanceImage = async (file, userId) => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is required');
  }

  const extension = path.extname(file.originalname || '') || '.jpg';
  const objectPath = [
    'attendance',
    userId,
    `${Date.now()}-${crypto.randomUUID()}${extension}`,
  ].join('/');

  const uploadUrl = buildStorageUrl(`object/${env.supabaseBucket}/${objectPath}`);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.mimetype || 'application/octet-stream',
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      apikey: env.supabaseServiceRoleKey,
      'x-upsert': 'false',
      'Cache-Control': '3600',
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase upload failed: ${response.status} ${errorBody}`);
  }

  return buildStorageUrl(`object/public/${env.supabaseBucket}/${objectPath}`);
};

const uploadLeaveDocument = async (file, employeeId) => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is required');
  }

  const extension = path.extname(file.originalname || '') || '.pdf';
  const objectPath = [
    'leave-documents',
    employeeId,
    `${Date.now()}-${crypto.randomUUID()}${extension}`,
  ].join('/');

  const uploadUrl = buildStorageUrl(`object/${env.supabaseBucket}/${objectPath}`);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.mimetype || 'application/pdf',
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      apikey: env.supabaseServiceRoleKey,
      'x-upsert': 'false',
      'Cache-Control': '3600',
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase upload failed: ${response.status} ${errorBody}`);
  }

  return buildStorageUrl(`object/public/${env.supabaseBucket}/${objectPath}`);
};

module.exports = {
  uploadAttendanceImage,
  uploadLeaveDocument,
};

