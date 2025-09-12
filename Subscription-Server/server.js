require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(cors());
app.use(express.json());

// In-memory database for licenses (for portfolio purposes).
// In a real production app, this would be a persistent database like PostgreSQL or Firestore.
const licenseDB = new Map();

/**
 * Endpoint to create a Stripe Checkout session.
 * The frontend will call this when a user clicks "Upgrade".
 */
app.post('/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Price ID is required.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CHECKOUT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.CHECKOUT_CANCEL_URL,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe Error:", e.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * Endpoint to verify a license key.
 * The Chrome extension will call this periodically.
 */
app.post('/verify-license', async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey || !licenseDB.has(licenseKey)) {
    return res.status(404).json({ valid: false, tier: 'free', message: 'License key not found.' });
  }

  const license = licenseDB.get(licenseKey);

  try {
    const subscription = await stripe.subscriptions.retrieve(license.stripeSubscriptionId);
    const isActive = ['trialing', 'active'].includes(subscription.status);

    if (isActive) {
      res.json({ valid: true, tier: license.tier });
    } else {
      res.json({ valid: false, tier: 'free', message: 'Subscription is not active.' });
    }
  } catch (e) {
    console.error("Stripe Subscription Error:", e.message);
    res.status(500).json({ valid: false, tier: 'free', message: 'Failed to verify subscription with Stripe.' });
  }
});

/**
 * Stripe Webhook Handler.
 * Stripe sends events here (e.g., when a payment succeeds).
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // In production, you would use a webhook secret from your Stripe dashboard.
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    event = JSON.parse(req.body); // For simplified local testing
  } catch (err) {
    console.log(`❌ Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const subscriptionId = session.subscription;
    const priceId = session.display_items[0].price.id;

    // Determine tier from Price ID
    let tier = 'free'; // The Pilgrim's Echo
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro'; // The Harbinger's Sigil
    if (priceId === process.env.STRIPE_REVENANT_PRICE_ID) tier = 'revenant'; // The Revenant's Avatar

    // Generate and store a license key with narrative tier name
    const tierNames = {
      'free': 'PILGRIM',
      'pro': 'HARBINGER',
      'revenant': 'REVENANT'
    };
    const licenseKey = `IRIS-${tierNames[tier]}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    licenseDB.set(licenseKey, { stripeSubscriptionId: subscriptionId, tier });

    console.log(`✅ New Subscription! Tier: ${tier}, License Key: ${licenseKey}`);
    // In a real app, you would email this license key to the customer.
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🔑 Subscription server running on port ${PORT}`));
