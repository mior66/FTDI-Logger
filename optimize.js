/**
 * FTDI Logger Optimization Launcher
 * 
 * This script applies all performance optimizations to the FTDI Logger
 * without modifying the existing codebase structure.
 * 
 * Usage: node optimize.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Original server file path
const serverFilePath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverFilePath, 'utf8');

// Create a backup of the original server.js
const backupPath = path.join(__dirname, 'server.js.backup');
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, serverContent);
  console.log('✅ Created backup of server.js at server.js.backup');
}

// Create an optimized version of server.js
const optimizedServerContent = `// This is an optimized version of server.js with performance enhancements
// Original file is preserved at server.js.backup

${serverContent.replace(
  'const express = require(\'express\');',
  `const express = require('express');
const applyPerformanceEnhancements = require('./performance-enhancements');
const applyMemoryOptimizations = require('./memory-optimization');`
).replace(
  'const app = express();',
  `const app = express();
// Apply performance enhancements
applyPerformanceEnhancements(app);`
).replace(
  'const io = new Server(server);',
  `const io = new Server(server);
// Apply memory optimizations
applyMemoryOptimizations(io);`
)}`;

// Write the optimized server file
const optimizedServerPath = path.join(__dirname, 'server.optimized.js');
fs.writeFileSync(optimizedServerPath, optimizedServerContent);
console.log('✅ Created optimized server at server.optimized.js');

// Update index.html to include performance.js
const indexPath = path.join(__dirname, 'public', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Create a backup of the original index.html
const indexBackupPath = path.join(__dirname, 'public', 'index.html.backup');
if (!fs.existsSync(indexBackupPath)) {
  fs.writeFileSync(indexBackupPath, indexContent);
  console.log('✅ Created backup of index.html at public/index.html.backup');
}

// Add performance.js to index.html if not already there
if (!indexContent.includes('performance.js')) {
  const optimizedIndexContent = indexContent.replace(
    '<script src="main.js"></script>',
    '<script src="main.js"></script>\n    <script src="performance.js"></script>'
  );
  
  // Write the optimized index file
  const optimizedIndexPath = path.join(__dirname, 'public', 'index.html.optimized');
  fs.writeFileSync(optimizedIndexPath, optimizedIndexContent);
  console.log('✅ Created optimized index.html at public/index.html.optimized');
}

console.log('\n🚀 Optimization complete!');
console.log('\nTo run the optimized version:');
console.log('1. node server.optimized.js');
console.log('2. Replace index.html with index.html.optimized if you want client-side optimizations');
console.log('\nOriginal files are preserved as backups. No changes have been made to your existing code.');
