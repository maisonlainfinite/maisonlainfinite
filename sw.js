"use strict";
self.addEventListener("push", (event) => {
  let data = {title: "LA INFINITÉ", body: "A new operation needs attention.", url: "/admin/"};
  try { if (event.data) data = {...data, ...event.data.json()}; } catch (_) {}
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/admin/";
  event.waitUntil(self.registration.showNotification(String(data.title).slice(0, 80), {
    body: String(data.body).slice(0, 160), icon: "/assets/maison-icon.svg",
    badge: "/assets/maison-icon.svg", data: {url}, tag: "maison-operations"
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin/", self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then((list) => {
    for (const c of list) {if (c.url.startsWith(self.location.origin + "/admin/")) return c.focus();}
    return clients.openWindow(target);
  }));
});
