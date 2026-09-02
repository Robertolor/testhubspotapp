import Stripe from "stripe";
import { getStripeSecretKey } from "./config";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(getStripeSecretKey());
  }
  return stripe;
}
