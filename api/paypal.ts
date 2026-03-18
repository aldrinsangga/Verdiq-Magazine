import paypal from "@paypal/checkout-server-sdk";

// Force live production environment as requested
const environment = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  // Always use LiveEnvironment
  return new paypal.core.LiveEnvironment(clientId, clientSecret);
};

const client = () => {
  return new paypal.core.PayPalHttpClient(environment());
};

export { client, paypal };
