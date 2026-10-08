"use strict";
/* LA INFINITÉ operations: server-authoritative enquiries, Circle invitations, audit and alerts. */
const crypto = require("node:crypto");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const webpush = require("web-push");

initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const CALL = {region: REGION, enforceAppCheck: true, maxInstances: 10};
const PUSH_PRIVATE = defineSecret("WEB_PUSH_PRIVATE_KEY");
const text = (x, max) => typeof x === "string" ? x.trim().slice(0, max + 1) : "";
const checkText = (x, max, label) => {
  const v = text(x, max);
  if (!v || v.length > max) throw new HttpsError("invalid-argument", "Invalid " + label + ".");
  return v;
};
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const emailValue = (x) => {
  const v = text(x, 254).toLowerCase();
  if (!validEmail(v)) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  return v;
};
const ensureAdmin = (r) => {
  if (!r.auth || r.auth.token.admin !== true || r.auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "Verified administrator access required.");
  }
  return r.auth.uid;
};
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const audit = async (uid, action, target, before, after) => db.collection("auditLogs").add({
  actorUid: uid, action, target, before: before || null, after: after || null,
  createdAt: FieldValue.serverTimestamp()
});
const MAX_MESSAGE = 5000;

exports.submitEnquiry = onCall({...CALL, maxInstances: 20}, async (r) => {
  const d = r.data || {};
  const name = checkText(d.name, 120, "name");
  const email = emailValue(d.email);
  const subject = checkText(d.subject, 120, "subject");
  const message = checkText(d.message, MAX_MESSAGE, "message");
  if (message.length < 8) throw new HttpsError("invalid-argument", "Please add a little more detail.");
  if (text(d.website, 200)) return {received: true}; // invisible anti-bot field
  // IPs are not stored. App Check is mandatory; bounded frequency deters submission floods.
  const ip = String(r.rawRequest.ip || "unknown");
  const windowNumber = Math.floor(Date.now() / (15 * 60 * 1000));
  const rateRef = db.doc("rateLimits/" + hash("enquiries:" + ip + ":" + windowNumber));
  const ref = db.collection("enquiries").doc();
  const reference = "ENQ-" + new Date().getUTCFullYear() + "-" + ref.id.slice(0, 10).toUpperCase();
  await db.runTransaction(async (tx) => {
    const record = await tx.get(rateRef);
    const count = record.exists ? record.data().count || 0 : 0;
    if (count >= 5) throw new HttpsError("resource-exhausted", "Too many attempts. Please try again later.");
    tx.set(rateRef, {count: count + 1, expiresAt: new Date(Date.now() + 86400000)});
    tx.create(ref, {
      reference, name, email, subject, message, source: "contact",
      status: "New", priority: subject === "Private order request" ? "High" : "Normal", assigneeUid: null,
      notes: [], createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  return {received: true, reference};
});

exports.subscribeNewsletter = onCall({...CALL, maxInstances: 15}, async (r) => {
  if (r.data?.consent !== true) throw new HttpsError("invalid-argument", "Consent is required.");
  const email = emailValue(r.data?.email);
  const ref = db.collection("newsletterSubscribers").doc(hash(email));
  await ref.set({email, consent: true, source: "website", status: "Pending verification",
    updatedAt: FieldValue.serverTimestamp(), subscribedAt: FieldValue.serverTimestamp()}, {merge: true});
  // No marketing messages are sent until the mail provider and verification flow are connected.
  return {received: true, status: "Pending verification"};
});

exports.getOperationsOverview = onCall(CALL, async (r) => {
  ensureAdmin(r);
  const [enquiries, pending, invitations, orders] = await Promise.all([
    db.collection("enquiries").count().get(),
    db.collection("enquiries").where("status", "==", "New").count().get(),
    db.collection("invitations").count().get(),
    db.collection("orders").count().get()
  ]);
  return {enquiries: enquiries.data().count, newEnquiries: pending.data().count,
    invitations: invitations.data().count, orders: orders.data().count};
});

exports.listEnquiries = onCall(CALL, async (r) => {
  ensureAdmin(r);
  let q = db.collection("enquiries").orderBy("createdAt", "desc").limit(30);
  const cursorId = text(r.data?.cursor, 100);
  if (cursorId) {
    const cursor = await db.collection("enquiries").doc(cursorId).get();
    if (!cursor.exists) throw new HttpsError("invalid-argument", "Invalid page cursor.");
    q = q.startAfter(cursor);
  }
  const result = await q.get();
  return {items: result.docs.map((doc) => {
    const d = doc.data();
    return {id: doc.id, reference: d.reference, name: d.name, email: d.email,
      subject: d.subject, message: d.message, status: d.status, priority: d.priority,
      notes: d.notes || [], assigneeUid: d.assigneeUid || null,
      createdAt: d.createdAt?.toDate().toISOString() || null};
  }), nextCursor: result.size === 30 ? result.docs[result.size - 1].id : null};
});

exports.updateEnquiry = onCall(CALL, async (r) => {
  const uid = ensureAdmin(r);
  const d = r.data || {};
  const id = checkText(d.id, 100, "enquiry ID");
  const status = checkText(d.status, 40, "status");
  const priority = checkText(d.priority, 20, "priority");
  if (!["New", "Open", "In progress", "Waiting for customer", "Resolved", "Closed"].includes(status))
    throw new HttpsError("invalid-argument", "Invalid enquiry status.");
  if (!["Normal", "High", "Urgent"].includes(priority))
    throw new HttpsError("invalid-argument", "Invalid priority.");
  const note = text(d.note, 1000);
  if (note.length > 1000) throw new HttpsError("invalid-argument", "Internal note too long.");
  const ref = db.collection("enquiries").doc(id);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Enquiry not found.");
    const before = {status: snap.data().status, priority: snap.data().priority};
    const after = {status, priority};
    const update = {status, priority, updatedAt: FieldValue.serverTimestamp()};
    if (note) update.notes = FieldValue.arrayUnion({text: note, byUid: uid, at: new Date().toISOString()});
    tx.update(ref, update);
    return {before, after};
  });
  await audit(uid, "enquiry.update", id, result.before, result.after);
  return {ok: true};
});

exports.createMaisonInvitation = onCall(CALL, async (r) => {
  const uid = ensureAdmin(r);
  const name = checkText(r.data?.name, 120, "name");
  const email = emailValue(r.data?.email);
  const token = crypto.randomBytes(32).toString("base64url");
  const ref = db.collection("invitations").doc();
  const expires = new Date(Date.now() + 7 * 86400000);
  await ref.create({
    name, email, tokenHash: hash(token), status: "Pending",
    createdBy: uid, createdAt: FieldValue.serverTimestamp(),
    expiresAt: expires, acceptedAt: null, memberUid: null
  });
  await audit(uid, "maisonCircle.invitation.create", ref.id, null, {email});
  return {id: ref.id, email, expiresAt: expires.toISOString(),
    inviteUrl: "https://maisonlainfinite.github.io/circle/accept/#i=" + encodeURIComponent(ref.id) +
      "&t=" + encodeURIComponent(token)};
});

exports.listMaisonInvitations = onCall(CALL, async (r) => {
  ensureAdmin(r);
  const q = await db.collection("invitations").orderBy("createdAt", "desc").limit(30).get();
  return {items: q.docs.map((doc) => {
    const d = doc.data();
    return {id: doc.id, email: d.email, name: d.name, status: d.status,
      expiresAt: d.expiresAt?.toDate().toISOString() || null,
      createdAt: d.createdAt?.toDate().toISOString() || null};
  })};
});

exports.acceptMaisonInvitation = onCall(CALL, async (r) => {
  if (!r.auth || r.auth.token.email_verified !== true || !r.auth.token.email)
    throw new HttpsError("unauthenticated", "Sign in with a verified email.");
  const uid = r.auth.uid;
  const invitationId = checkText(r.data?.invitationId, 100, "invitation");
  const token = checkText(r.data?.token, 200, "invitation token");
  const email = String(r.auth.token.email).toLowerCase();
  const inviteRef = db.collection("invitations").doc(invitationId);
  const memberRef = db.collection("memberships").doc(uid);
  await db.runTransaction(async (tx) => {
    const [snap, member] = await Promise.all([tx.get(inviteRef), tx.get(memberRef)]);
    if (!snap.exists || member.exists) throw new HttpsError("failed-precondition", "Invitation unavailable.");
    const invitation = snap.data();
    const candidateHash = Buffer.from(hash(token), "hex");
    const storedHash = Buffer.from(String(invitation.tokenHash || "").padEnd(64,"0").slice(0,64), "hex");
    const validToken = crypto.timingSafeEqual(candidateHash, storedHash);
    if (!validToken || invitation.status !== "Pending" ||
        invitation.email !== email || invitation.expiresAt.toMillis() <= Date.now())
      throw new HttpsError("permission-denied", "Invitation invalid or expired.");
    tx.create(memberRef, {email, name: invitation.name, tier: "Bronze", status: "Active",
      invitationId, joinedAt: FieldValue.serverTimestamp()});
    tx.update(inviteRef, {status: "Accepted", memberUid: uid,
      acceptedAt: FieldValue.serverTimestamp(), tokenHash: FieldValue.delete()});
  });
  await audit(uid, "maisonCircle.invitation.accept", invitationId, null, {memberUid: uid});
  return {joined: true};
});

exports.registerAdminPush = onCall(CALL, async (r) => {
  const uid = ensureAdmin(r);
  const sub = r.data?.subscription;
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 1200 ||
      !sub.endpoint.startsWith("https://") ||
      typeof sub.keys?.p256dh !== "string" || sub.keys.p256dh.length > 300 ||
      typeof sub.keys?.auth !== "string" || sub.keys.auth.length > 300)
    throw new HttpsError("invalid-argument", "Invalid browser push subscription.");
  const id = hash(sub.endpoint).slice(0, 32);
  await db.doc("adminPush/" + uid + "/subscriptions/" + id).set({
    endpoint: sub.endpoint, keys: {p256dh: sub.keys.p256dh, auth: sub.keys.auth},
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
  return {ok: true};
});

async function broadcastPush(title, body, url) {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = PUSH_PRIVATE.value();
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails("mailto:maisonlainfinite@outlook.com", publicKey, privateKey);
  const group = await db.collectionGroup("subscriptions").get();
  const payload = JSON.stringify({title, body, url});
  await Promise.all(group.docs.map(async (d) => {
    try {
      await webpush.sendNotification(d.data(), payload, {TTL: 3600});
    } catch (err) {
      if ([404, 410].includes(err.statusCode)) await d.ref.delete();
      else console.error("Web push failed", err.statusCode || "unknown");
    }
  }));
}

exports.onEnquiryCreated = onDocumentCreated({
  document: "enquiries/{id}", region: REGION, secrets: [PUSH_PRIVATE]
}, async (event) => {
  if (!event.data) return;
  const enquiry = event.data.data();
  const id = event.params.id;
  // Idempotent event doc: retried triggers cannot issue a second alert.
  const notification = db.doc("operationsEvents/enquiry_" + id);
  try {
    await notification.create({kind: "enquiry", reference: enquiry.reference,
      title: "New client enquiry", priority: "Normal", read: false,
      targetId: id, createdAt: FieldValue.serverTimestamp()});
  } catch (err) {
    if (err.code === 6 || err.code === "already-exists") return;
    throw err;
  }
  await broadcastPush("LA INFINITÉ", "New client enquiry awaiting review", "/admin/");
});

// Only provider-verified payment transitions will result in a paid-order alert.
// All order writes remain server-only, enforced by Firestore rules.
exports.onOrderPaid = onDocumentUpdated({
  document: "orders/{id}", region: REGION, secrets: [PUSH_PRIVATE]
}, async (event) => {
  if (!event.data) return;
  const before = event.data.before.data(), after = event.data.after.data();
  if (before?.paymentStatus === "paid" || after?.paymentStatus !== "paid") return;
  const id = event.params.id;
  const eventRef = db.doc("operationsEvents/order_paid_" + id);
  try {
    await eventRef.create({kind: "order", title: "Paid order awaiting fulfilment",
      priority: "High", reference: String(after.orderRef || id),
      read: false, targetId: id, createdAt: FieldValue.serverTimestamp()});
  } catch (error) {
    if (error.code === 6 || error.code === "already-exists") return;
    throw error;
  }
  await broadcastPush("LA INFINITÉ", "A paid order needs attention", "/admin/");
});

exports.listOperationsEvents = onCall(CALL, async (r) => {
  ensureAdmin(r);
  const q = await db.collection("operationsEvents").orderBy("createdAt", "desc").limit(30).get();
  return {items: q.docs.map((doc) => ({
    id: doc.id, title: doc.data().title, kind: doc.data().kind,
    reference: doc.data().reference, createdAt: doc.data().createdAt?.toDate().toISOString() || null
  }))};
});
