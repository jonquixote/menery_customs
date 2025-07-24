// Script to inspect the Square client methods
require('dotenv').config({ path: '.env' });

const { SquareClient, SquareEnvironment } = require('square');

async function inspectClient() {
  console.log('=== Square Client Inspection ===');
  
  const client = new SquareClient({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'production' 
      ? SquareEnvironment.Production 
      : SquareEnvironment.Sandbox,
  });

  console.log('Client constructor name:', client.constructor.name);
  console.log('Client prototype:', Object.getPrototypeOf(client).constructor.name);
  
  console.log('\n=== Client Properties ===');
  console.log(Object.keys(client).join(', '));
  
  console.log('\n=== Client Methods ===');
  const methods = [];
  for (const prop in client) {
    if (typeof client[prop] === 'function') {
      methods.push(prop);
    }
  }
  console.log(methods.join(', '));
  
  // Check if locations API is available
  console.log('\n=== Locations API ===');
  if (client.locations) {
    console.log('Locations API methods:');
    const locationsMethods = [];
    for (const prop in client.locations) {
      if (typeof client.locations[prop] === 'function') {
        locationsMethods.push(prop);
      }
    }
    console.log(locationsMethods.join(', '));
  } else {
    console.log('No locations property found on client');
  }
  
  // Check for API clients
  console.log('\n=== API Clients ===');
  const apiClients = [];
  for (const prop in client) {
    if (client[prop] && typeof client[prop] === 'object' && 
        prop.toLowerCase().includes('api')) {
      apiClients.push(prop);
    }
  }
  console.log('API Clients:', apiClients.join(', '));
  
  // If we found any API clients, inspect the first one
  if (apiClients.length > 0) {
    const apiClient = client[apiClients[0]];
    console.log(`\n=== Methods for ${apiClients[0]} ===`);
    const apiMethods = [];
    for (const prop in apiClient) {
      if (typeof apiClient[prop] === 'function') {
        apiMethods.push(prop);
      }
    }
    console.log(apiMethods.join(', '));
  }
}

inspectClient().catch(console.error);
