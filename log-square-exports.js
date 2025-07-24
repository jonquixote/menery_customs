// Script to log all exports from the Square package
console.log('=== Square Package Exports ===');
const square = require('square');

// Log all top-level exports
console.log('Top-level exports:', Object.keys(square).join(', '));

// Try to find Environment-related exports
console.log('\n=== Environment Exports ===');
for (const key in square) {
  if (key.toLowerCase().includes('environment')) {
    console.log(`${key}:`, square[key]);
  }
}

// Try to find Client-related exports
console.log('\n=== Client Exports ===');
for (const key in square) {
  if (key.toLowerCase().includes('client')) {
    console.log(`${key}:`, square[key]);
  }
}

// Try to find any API-related exports
console.log('\n=== API Exports ===');
const apiExports = [];
for (const key in square) {
  if (key.toLowerCase().includes('api') || 
      (typeof square[key] === 'object' && square[key] !== null)) {
    apiExports.push(key);
  }
}
console.log(apiExports.join(', '));
