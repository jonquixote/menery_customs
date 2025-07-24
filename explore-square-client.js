require('dotenv').config({ path: '.env' });

const { SquareClient, SquareEnvironment } = require('square');

async function exploreClient() {
  console.log('=== Exploring SquareClient ===');
  
  // Create a new client instance
  const client = new SquareClient({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'production' 
      ? SquareEnvironment.Production 
      : SquareEnvironment.Sandbox,
  });
  
  console.log('Client instance created successfully');
  
  // Log all properties of the client
  console.log('\n=== Client Properties ===');
  const clientProps = [];
  for (const prop in client) {
    if (typeof client[prop] !== 'function') {
      clientProps.push(prop);
    }
  }
  console.log(clientProps.join(', '));
  
  // Log all methods of the client
  console.log('\n=== Client Methods ===');
  const clientMethods = [];
  for (const prop in client) {
    if (typeof client[prop] === 'function') {
      clientMethods.push(prop);
    }
  }
  console.log(clientMethods.join(', '));
  
  // Try to access APIs directly
  console.log('\n=== Trying to access APIs ===');
  
  // Try locations API
  if (client.locations) {
    console.log('locations API available');
    console.log('Methods on locations:', Object.keys(client.locations).filter(k => typeof client.locations[k] === 'function'));
  } else {
    console.log('locations API not directly available');
  }
  
  // Try payments API
  if (client.payments) {
    console.log('payments API available');
  } else {
    console.log('payments API not directly available');
  }
  
  // Try to list locations using the client
  console.log('\n=== Attempting to list locations ===');
  try {
    // Try to find the correct way to access the locations API
    let locations = [];
    
    // Try direct property access
    if (client.locations && typeof client.locations.listLocations === 'function') {
      console.log('Using client.locations.listLocations');
      const result = await client.locations.listLocations();
      locations = result.result.locations || [];
    } 
    // Try with getApi method if available
    else if (typeof client.getApi === 'function') {
      console.log('Using client.getApi');
      const locationsApi = client.getApi('Locations');
      const result = await locationsApi.listLocations();
      locations = result.result.locations || [];
    }
    // Try with square object
    else if (client.square && client.square.locationsApi) {
      console.log('Using client.square.locationsApi');
      const result = await client.square.locationsApi.listLocations();
      locations = result.result.locations || [];
    } else {
      console.log('Could not find a way to access the locations API');
    }
    
    console.log(`Found ${locations.length} locations`);
    if (locations.length > 0) {
      console.log('First location:', {
        id: locations[0].id,
        name: locations[0].name,
        address: locations[0].address,
      });
    }
    
  } catch (error) {
    console.error('Error listing locations:', error.message);
    if (error.errors) {
      console.error('API Errors:', error.errors);
    }
  }
}

exploreClient().catch(console.error);
