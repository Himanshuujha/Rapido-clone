// src/jobs/index.js
const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Initialize background jobs
 */
const initializeJobs = async () => {
  try {
    logger.info('Initializing background jobs...');

    // Example: Cleanup expired OTPs every hour
    cron.schedule('0 * * * *', async () => {
      logger.info('Running cleanup job for expired OTPs');
      try {
        // Add logic to clean up expired OTPs from database
        // await OTP.deleteMany({ expiresAt: { $lt: new Date() } });
      } catch (error) {
        logger.error('Error in OTP cleanup job:', error);
      }
    });

    // Example: Update ride statistics every day at midnight
    cron.schedule('0 0 * * *', async () => {
      logger.info('Running daily statistics job');
      try {
        // Add logic to calculate and store daily statistics
      } catch (error) {
        logger.error('Error in statistics job:', error);
      }
    });

    // Example: Check and update ride statuses every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      logger.debug('Running ride status check job');
      try {
        // Add logic to check and update ride statuses
      } catch (error) {
        logger.error('Error in ride status check job:', error);
      }
    });

    // Example: Send reminder notifications
    cron.schedule('*/30 * * * *', async () => {
      logger.debug('Running notification reminder job');
      try {
        // Add logic to send reminder notifications
      } catch (error) {
        logger.error('Error in reminder job:', error);
      }
    });

    logger.info('✅ All background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize jobs:', error);
    throw error;
  }
};

module.exports = { initializeJobs };
