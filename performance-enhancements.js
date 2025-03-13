/**
 * FTDI Logger Performance Enhancements
 * 
 * This module provides performance optimizations for the FTDI Logger application
 * without modifying the existing codebase structure.
 */

const compression = require('compression');

/**
 * Apply performance enhancements to an Express application
 * @param {Object} app - Express application instance
 */
function applyPerformanceEnhancements(app) {
  // Enable compression for all responses
  app.use(compression());
  
  // Add cache control headers for static assets
  app.use((req, res, next) => {
    // Only apply to static assets
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      // Cache for 1 day
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    next();
  });
  
  // Optimize JSON responses
  app.set('json spaces', 0); // Minimize JSON response size
  
  console.log('✅ Performance enhancements applied');
}

module.exports = applyPerformanceEnhancements;
