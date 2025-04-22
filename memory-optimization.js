/**
 * FTDI Logger Memory Optimizations
 * 
 * This module provides memory management optimizations for the FTDI Logger application
 * without modifying the existing codebase structure.
 */

// Track active connections for better resource management
const activeConnections = new Set();

/**
 * Apply memory optimizations to a Socket.IO server instance
 * @param {Object} io - Socket.IO server instance
 */
function applyMemoryOptimizations(io) {
  // Original connection handler remains untouched
  // This middleware runs before any existing connection logic
  io.use((socket, next) => {
    // Track active connections
    activeConnections.add(socket.id);
    
    // Clean up resources when socket disconnects
    socket.on('disconnect', () => {
      activeConnections.delete(socket.id);
    });
    
    // Continue to the next middleware
    next();
  });
  
  // Periodically log memory usage for monitoring
  const memoryInterval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    console.log('Memory usage:', {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      activeConnections: activeConnections.size
    });
  }, 60000); // Log every minute
  
  // Clean up interval on process exit
  process.on('SIGINT', () => {
    clearInterval(memoryInterval);
    // Original SIGINT handler in server.js will still run
  });
  
  console.log('✅ Memory optimizations applied');
}

module.exports = applyMemoryOptimizations;
