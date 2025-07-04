const express = require('express');
const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/', (req, res) => {
  const healthData = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };
  
  res.json({
    success: true,
    data: healthData
  });
});

module.exports = router; 