// src/app/api/create-payment/route.ts
import { NextResponse } from 'next/server';

// Dummy Payrexx credentials - REPLACE WITH YOUR ACTUAL CREDENTIALS IN A SECURE WAY (e.g., environment variables)
const PAYREXX_INSTANCE_NAME = 'YOUR_PAYREXX_INSTANCE_NAME'; // Example: rumi-restaurant
// const PAYREXX_API_SECRET = 'YOUR_PAYREXX_API_SECRET'; // Example: sk_abcdef1234567890

export async function POST(request: Request) {
  try {
    const { amount, currency, referenceId, successRedirectUrl, failedRedirectUrl, cancelRedirectUrl, customer } = await request.json();

    // Basic validation
    if (!amount || !currency || !referenceId || !successRedirectUrl || !failedRedirectUrl || !cancelRedirectUrl) {
      return NextResponse.json({ error: 'Missing required payment parameters.' }, { status: 400 });
    }

    // In a real scenario, you would make an API call to Payrexx here
    // For example, using fetch:
    /*
    const payrexxApiUrl = `https://api.payrexx.com/v1.0/Gateway/`;
    const params = new URLSearchParams();
    params.append('ApiSignature', PAYREXX_API_SECRET); // Note: Real signature generation is more complex
    params.append('instance', PAYREXX_INSTANCE_NAME);
    params.append('amount', (amount * 100).toString()); // Amount in cents
    params.append('currency', currency);
    params.append('referenceId', referenceId);
    params.append('successRedirectUrl', successRedirectUrl);
    params.append('failedRedirectUrl', failedRedirectUrl);
    params.append('cancelRedirectUrl', cancelRedirectUrl);
    // Add other necessary fields like 'purpose', 'psp', 'pm', customer details, etc.
    // For 'purpose' or line items, you might structure them as per Payrexx documentation.

    if (customer) {
      params.append('forename', customer.firstName || '' );
      params.append('surname', customer.lastName || '' );
      params.append('email', customer.email || '' );
      // Add other customer fields as needed
    }
    
    const response = await fetch(payrexxApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type', 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Payrexx API error:', errorData);
      return NextResponse.json({ error: 'Payrexx API request failed', details: errorData }, { status: response.status });
    }

    const responseData = await response.json();
    if (responseData.status === 'success' && responseData.data.length > 0) {
      const gateway = responseData.data[0];
      return NextResponse.json({ 
        message: 'Payment gateway created successfully (simulated)', 
        gatewayId: gateway.id,
        status: gateway.status,
        link: gateway.link, // This is the redirect URL for the user
        referenceId: gateway.referenceId
      });
    } else {
      console.error('Payrexx payment creation failed:', responseData);
      return NextResponse.json({ error: 'Failed to create Payrexx payment gateway', details: responseData }, { status: 500 });
    }
    */

    // Simulate a successful API call to Payrexx
    console.log('Simulating Payrexx create-payment API call with:');
    console.log('Instance:', PAYREXX_INSTANCE_NAME);
    // console.log('API Secret:', PAYREXX_API_SECRET); // Don't log secrets in production
    console.log('Amount:', amount);
    console.log('Currency:', currency);
    console.log('Reference ID:', referenceId);
    console.log('Customer:', customer);

    // Dummy response mimicking Payrexx Gateway creation
    const simulatedGatewayId = Math.floor(Math.random() * 100000) + 1;
    const simulatedPaymentLink = `https://${PAYREXX_INSTANCE_NAME}.payrexx.com/pay?tid=${"DUMMY_TRANSACTION_ID_" + simulatedGatewayId}`;

    return NextResponse.json({
      message: 'Payment gateway created successfully (simulated)',
      gatewayId: simulatedGatewayId,
      status: 'waiting', // Common initial status
      link: simulatedPaymentLink,
      referenceId: referenceId,
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Basic security: disallow GET requests for this endpoint
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

