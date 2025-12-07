// Supabase Edge Function: stripe-webhook
// Listens for events from Stripe to manage subscriptions.
// Deploy with: supabase functions deploy stripe-webhook

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.0";
import Stripe from "https://esm.sh/stripe@11.1.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY")!, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session?.metadata?.user_id;

  if (!userId) {
    console.error("Webhook received without user_id in metadata");
    return new Response("user_id not found in metadata", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await supabase
          .from("subscriptions")
          .insert({
            user_id: userId,
            plan_id: subscription.items.data[0].price.id,
            status: subscription.status,
            provider: "stripe",
            provider_subscription_id: subscription.id,
            provider_customer_id: customerId,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
          });

        await supabase
          .from("profiles")
          .update({ plan: "teacher_pro" })
          .eq("id", userId);
        
        console.log(`Subscription created for user ${userId}`);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const newStatus = subscription.status;
        const newPlan = newStatus === 'active' ? 'teacher_pro' : 'free';

        await supabase
          .from("subscriptions")
          .update({
            status: newStatus,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("provider_subscription_id", subscription.id);

        // If subscription is no longer active, downgrade the user's plan
        if (newPlan === 'free') {
            const { data: subData } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('provider_subscription_id', subscription.id)
                .single();

            if (subData?.user_id) {
                 await supabase
                    .from("profiles")
                    .update({ plan: "free" })
                    .eq("id", subData.user_id);
                console.log(`Plan for user ${subData.user_id} downgraded to free.`);
            }
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
