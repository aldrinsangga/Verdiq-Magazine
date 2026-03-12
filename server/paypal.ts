import paypal from "@paypal/checkout-server-sdk";

// Use sandbox for development, live for production
const environment = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'sb';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'sb';

  if (process.env.NODE_ENV === 'production') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
};

const client = () => {
  return new paypal.core.PayPalHttpClient(environment());
};

export { client, paypal };
