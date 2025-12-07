import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.0";
import Stripe from "https://esm.sh/stripe@11.1.0";

// Stripe setup
const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY")!, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

// Supabase client (using anon key since we just validate JWT; no admin ops here)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

// Config
const PRICE_ID_EARLY_TEACHER = Deno.env.get("PRICE_ID_EARLY_TEACHER"); // £6.99/month
const PRICE_ID_TEACHER_PRO_PLUS = Deno.env.get("PRICE_ID_TEACHER_PRO_PLUS"); // £9.99/month
const DEFAULT_ORIGIN = Deno.env.get("DEFAULT_ORIGIN") || "https://yourapp.vercel.app";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Expect Authorization: Bearer <jwt>
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice("bearer ".length);

  // Validate user via Supabase auth
  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userResult?.user) {
    console.error("Auth error", userError);
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = userResult.user.id;

  // Parse request body to get plan selection
  let body: { plan?: string } = {};
  try {
    const text = await req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch (e) {
    console.error("Failed to parse body", e);
  }

  // Map plan to price ID
  const plan = body.plan || 'teacher_pro';
  let priceId: string | undefined;
  
  if (plan === 'teacher_pro') {
    priceId = PRICE_ID_EARLY_TEACHER; // Reusing early teacher price ID for Teacher Pro
  } else if (plan === 'teacher_pro_plus') {
    priceId = PRICE_ID_TEACHER_PRO_PLUS;
  }

  if (!priceId) {
    return jsonResponse({ error: `Price ID not configured for plan: ${plan}` }, 500);
  }

  // Determine origin for redirect URLs
  const origin = req.headers.get("Origin") || DEFAULT_ORIGIN;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: { user_id: userId, plan },
    });

    return jsonResponse({ url: session.url });
  } catch (err: any) {
    console.error("Stripe error", err);
    return jsonResponse({ error: err.message ?? "Stripe error" }, 500);
  }
});
