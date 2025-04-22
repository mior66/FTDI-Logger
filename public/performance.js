/**
 * FTDI Logger Client-Side Performance Optimizations
 * 
 * This script enhances the performance of the FTDI Logger application
 * without modifying the existing codebase structure.
 */

(function() {
  // Performance monitoring
  const performanceData = {
    loadTime: 0,
    resourceCount: 0,
    errors: 0
  };
  
  // Measure page load time
  window.addEventListener('load', () => {
    if (window.performance) {
      const perfData = window.performance.timing;
      performanceData.loadTime = perfData.loadEventEnd - perfData.navigationStart;
      performanceData.resourceCount = window.performance.getEntriesByType('resource').length;
      console.log(`Page loaded in ${performanceData.loadTime}ms with ${performanceData.resourceCount} resources`);
    }
  });
  
  // Global error handler to track errors without disrupting the application
  window.addEventListener('error', (event) => {
    performanceData.errors++;
    console.error('Caught error:', event.error);
    // Don't disrupt the application
    event.preventDefault();
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    performanceData.errors++;
    console.error('Unhandled promise rejection:', event.reason);
    // Don't disrupt the application
    event.preventDefault();
  });
  
  // Throttle function to limit the rate at which a function can fire
  window.throttle = function(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };
  
  // Optimize chart rendering
  if (window.Chart) {
    // Reduce animation duration for better performance
    Chart.defaults.animation.duration = 400;
    
    // Use a more efficient rendering mode
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }
  
  // Optimize DOM operations
  const originalAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function() {
    // Use requestAnimationFrame for DOM updates to avoid layout thrashing
    return requestAnimationFrame(() => {
      originalAppendChild.apply(this, arguments);
    });
  };
  
  console.log('✅ Client-side performance optimizations applied');
})();
