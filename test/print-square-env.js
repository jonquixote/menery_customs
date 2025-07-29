// print-square-env.js
// Prints the Square-related environment variables and their lengths for debugging hidden characters

require('dotenv').config();

function printEnvVar(name) {
  const value = process.env[name];
  if (value === undefined) {
    console.log(`${name}: NOT SET`);
  } else {
    // Show value, length, and hex encoding for hidden character debugging
    console.log(`${name}: '${value}' (length: ${value.length})`);
    console.log(`${name} (hex):`, Buffer.from(value).toString('hex'));
  }
}

console.log('--- Square Environment Variable Debug ---');
printEnvVar('SQUARE_ACCESS_TOKEN');
printEnvVar('SQUARE_ENVIRONMENT');
printEnvVar('SQUARE_LOCATION_ID');
printEnvVar('SQUARE_APPLICATION_ID');
console.log('----------------------------------------');
