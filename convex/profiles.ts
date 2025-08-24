import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type SetUsernameResult =
  | { ok: true; username: string; created?: boolean; updated?: boolean }
  | { ok: false; code: string; message: string };

function validateUsername(raw: string): SetUsernameResult {
  const username = raw.trim();
  if (username.length < 3 || username.length > 20) {
    return { ok: false, code: "length", message: "Username must be 3-20 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { ok: false, code: "invalid_format", message: "Only letters, numbers and underscore allowed" };
  }
  return { ok: true, username } as const;
}

export const setUsername = mutation({
  args: { playerId: v.string(), username: v.string() },
  handler: async (ctx, args): Promise<SetUsernameResult> => {
    const validation = validateUsername(args.username);
    if (!validation.ok) return validation;
    const username = validation.username;
    const lower = username.toLowerCase();

    // Uniqueness check (case-insensitive)
    const existingSame = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", lower))
      .unique();
    if (existingSame && existingSame.playerId !== args.playerId) {
      return { ok: false, code: "taken", message: "That username is already in use" };
    }

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { username, usernameLower: lower });
      return { ok: true, updated: true, username };
    }
    await ctx.db.insert("profiles", {
      playerId: args.playerId,
      username,
      usernameLower: lower,
      createdAt: Date.now(),
    });
    return { ok: true, created: true, username };
  },
});

export const me = query({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
  },
});