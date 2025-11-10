// routes/timesheet.routes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TimesheetController = require('../controllers/timesheet.controller');

const router = express.Router();

// Ensure upload directory exists
const uploadPath = 'uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer config for Excel files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `timesheet-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx?$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xls and .xlsx files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Routes
router.post('/upload', upload.single('timesheet'), TimesheetController.uploadTimesheet);
router.post('/upload-upsert', upload.single('timesheet'), TimesheetController.uploadTimesheetWithSequelizeUpsert);

// Optional: get timesheets
router.get('/timesheets', TimesheetController.getAllTimesheets);
router.get('/employees/:employee_id/timesheets', TimesheetController.getEmployeeTimesheets);

module.exports = router;