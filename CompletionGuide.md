Project Completion Guide: From Frontend to Full-Stack
1. Introduction
Our index.html file serves as the complete frontend for the voiceover service. This document provides the roadmap and specific AI prompts to build the necessary backend infrastructure to make it fully functional.
The current index.html file simulates the user experience. The next step is to replace the simulated JavaScript functions with real API calls to a backend server that will handle file storage, payment processing, database management, and email notifications.
2. Required Backend Infrastructure
To make this work, you'll need the following components, which can be built as a single server application (e.g., using Node.js) or as individual serverless functions (e.g., using AWS Lambda or Vercel Functions).
 * A Database: To store order and user information.
 * Cloud File Storage: To securely handle large video file uploads.
 * Payment Processor Integration: To securely handle transactions on the server.
 * An API: To connect the frontend to your backend services.
 * An Email Service: To send notifications to the user and to Bob.
3. Step-by-Step Implementation Prompts
Here are the specific prompts you can use with a Mixture-of-Experts AI agent to build each part of the backend.
Prompt 1: Project Scaffolding & Database Setup
"As a full-stack developer, create the initial project structure for a Node.js and Express application. This application will serve as the backend for a custom voiceover website.
 * Create the Project Structure: Include standard folders like src, routes, controllers, models, and config.
 * Initialize the Project: Provide the necessary commands to set up package.json.
 * Set up the Database Schema:
   * Use PostgreSQL as the database and the Sequelize ORM.
   * Generate a User model with fields: firstName, lastName, email, phone.
   * Generate an Order model with fields:
     * status (ENUM: 'pending', 'paid', 'processing', 'complete')
     * price (INTEGER)
     * duration (INTEGER)
     * script (TEXT, optional)
     * originalVideoKey (STRING - This will be the key/path to the file in cloud storage)
     * finalVideoKey (STRING, optional)
     * paymentMethod (STRING)
     * paymentIntentId (STRING, unique)
   * Establish a one-to-many relationship: a User can have many Orders.
 * Provide a configuration file (config/config.js) to handle database connection details using environment variables."
Prompt 2: Secure File Uploads
"Using Node.js and the AWS SDK v3, create an API endpoint that allows a client to upload a video file directly to an Amazon S3 bucket.
 * Create an Endpoint: POST /api/orders/initiate-upload
 * Functionality:
   * The endpoint should accept a fileName and fileType in the request body.
   * It must generate a pre-signed URL using the S3 PutObjectCommand. This URL grants temporary permission for the client to upload a file directly to the S3 bucket.
   * The S3 object key should be unique, incorporating a timestamp or UUID (e.g., uploads/user-video-${Date.now()}-${fileName}).
   * Return the preSignedUrl and the objectKey in the JSON response.
 * Environment Variables: Use environment variables for the AWS region, bucket name, access key ID, and secret access key."
Prompt 3: Payment Processing (Stripe)
"Create the backend logic to handle payments using Stripe.
 * Create an Endpoint: POST /api/payments/create-payment-intent
 * Functionality:
   * The endpoint should accept an orderId and a price (in cents).
   * It must create a Stripe Payment Intent.
   * It should return the client_secret from the Payment Intent to the frontend.
 * Create a Webhook Endpoint: POST /api/webhooks/stripe
 * Webhook Functionality:
   * This endpoint must securely listen for events from Stripe, specifically the payment_intent.succeeded event.
   * Verify the webhook signature to ensure the request is from Stripe.
   * When a successful payment event is received, find the corresponding order in the database (using the paymentIntentId) and update its status to 'paid'.
   * Trigger an email notification to Bob Menery about the new order."
Prompt 4: Email Notifications
"Using Node.js and the SendGrid (or Nodemailer) library, create a reusable email service.
 * Create a Service Module: services/emailService.js.
 * Function sendNewOrderAlert(orderDetails):
   * This function takes an orderDetails object (containing user info, order ID, and a secure download link for the original video).
   * It sends a formatted HTML email to Bob Menery's admin email address with the subject "New Voiceover Order: #[OrderID]".
 * Function sendCompletionEmail(orderDetails):
   * This function takes an orderDetails object (containing the user's email and a secure download link for the final video).
   * It sends a formatted HTML email to the customer with the subject "Your Bob Menery Voiceover is Ready!".
 * Configuration: Use environment variables for the email service API key and sender/receiver email addresses."
4. Connecting the Frontend
Once the backend is built, you will need to modify the JavaScript in your index.html file.
Task: Replace the placeholder logic inside the handlePayment function and other areas with fetch calls to your new API endpoints.
Example handlePayment modification:
// This is an example of what the new function would look like.

async function handlePayment(method) {
    // ... (disable buttons, show spinner) ...

    try {
        // Step 1: Get a pre-signed URL for the file upload
        const uploadResponse = await fetch('/api/orders/initiate-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: uploadedFile.name, fileType: uploadedFile.type })
        });
        const { preSignedUrl, objectKey } = await uploadResponse.json();

        // Step 2: Upload the file directly to S3 from the browser
        await fetch(preSignedUrl, { method: 'PUT', body: uploadedFile });

        // Step 3: Create a payment intent on your server
        const paymentResponse = await fetch('/api/payments/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                price: selectedPrice * 100, // Price in cents
                // ... include other order details like user info and the objectKey
            })
        });
        const { client_secret, orderId } = await paymentResponse.json();

        // Step 4: Use Stripe.js on the frontend to confirm the payment
        // const { error } = await stripe.confirmCardPayment(client_secret, ...);

        // if (!error) {
        //     showSuccessModal(method, orderId);
        // } else {
        //     alert('Payment failed: ' + error.message);
        // }

    } catch (err) {
        console.error("An error occurred:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        // ... (enable buttons, hide spinner) ...
    }
}

By following this guide and using these prompts, you can systematically build the robust backend required to power your beautiful frontend.