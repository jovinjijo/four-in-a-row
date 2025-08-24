"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import React from "react";

// Expect NEXT_PUBLIC_CONVEX_URL to be set after running `npx convex dev` and deploying.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set. Convex client will not connect.");
}
const convex = new ConvexReactClient(convexUrl || "");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
