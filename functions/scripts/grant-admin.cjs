"use strict";
/* Local-only administrator bootstrap. Never expose this in browser code. */
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: node functions/scripts/grant-admin.cjs VERIFIED_EMAIL");
    process.exitCode = 2; return;
  }
  initializeApp({credential: applicationDefault()});
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  if (!user.emailVerified) throw Error("Verify the user's email before giving admin access.");
  const claims = Object.assign({}, user.customClaims || {}, {admin: true});
  await auth.setCustomUserClaims(user.uid, claims);
  console.log("Granted verified admin claim to " + email + ". Sign out and in again.");
}
main().catch((err) => {console.error(err.message); process.exitCode = 1;});
