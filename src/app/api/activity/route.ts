import { NextResponse } from "next/server";

// Activity persistence is not wired yet. Return a stable empty collection
// rather than shipping a route module placeholder that breaks production builds.
export async function GET() {
  return NextResponse.json({ activities: [], count: 0 });
}
