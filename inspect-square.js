// Simple script to inspect the Square package exports
console.log('=== Square Package Exports ===');
const square = require('square');
console.log('Square package keys:', Object.keys(square).join(', '));

// Try to find the client constructor
console.log('\n=== Available Constructors ===');
for (const key in square) {
  if (typeof square[key] === 'function' && key.toLowerCase().includes('client')) {
    console.log(`Found client constructor: ${key}`);
  }
}

console.log('\n=== Square Environment Constants ===');
for (const key in square) {
  if (key.toLowerCase().includes('environment')) {
    console.log(`${key}:`, square[key]);
  }
}
