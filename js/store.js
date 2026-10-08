/* LA INFINITÉ storefront. No customer credentials or payments are collected here. */
(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('site-data').textContent);
  config.basePath = new URL(document.baseURI).pathname.replace(/\/$/, '');
  const products = config.products;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const route = (p = '') => `${config.basePath}/${p.replace(/^\//, '')}`;
  const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const days = (n) => n * 86400000;
  const storageMemory = new Map();
  let toastTimer;
  let modalTrigger = null;
  let sizeSystem = 'EU';
  let chosenEU = null;

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key) || storageMemory.get(key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || !Number.isFinite(value.expires) || value.expires <= Date.now()) {
        removeStorage(key); return null;
      }
      return value.data;
    } catch { return null; }
  }
  function saveStorage(key, data, ttl = days(30)) {
    const serialized = JSON.stringify({ expires: Date.now() + ttl, data });
    storageMemory.set(key, serialized);
    try { localStorage.setItem(key, serialized); } catch { /* A bag still works during this visit. */ }
  }
  function removeStorage(key) {
    storageMemory.delete(key);
    try { localStorage.removeItem(key); } catch { /* Browser storage may be unavailable. */ }
  }
  function toast(message) {
    const element = $('#toast');
    element.textContent = message; element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.hidden = true; }, 5000);
  }
  function openDialog(id, trigger = document.activeElement) {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    modalTrigger = trigger;
    dialog.showModal(); document.body.classList.add('modal-open');
    if (id === 'search-dialog') $('#global-search').focus();
  }
  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
  $$('[data-open]').forEach((el) => el.addEventListener('click', () => openDialog(el.dataset.open, el)));
  $$('[data-close]').forEach((el) => el.addEventListener('click', () => closeDialog(el.closest('dialog'))));
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('modal-open');
      modalTrigger?.focus?.();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(dialog);
    });
  });

  // Rotate one restrained, clickable collection announcement at a time.
  const promoLinks = $$('.promo-link');
  if (promoLinks.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const bar = $('.promo-strip');
    let index = 0, interval;
    const next = () => {
      promoLinks[index].hidden = true;
      index = (index + 1) % promoLinks.length;
      promoLinks[index].hidden = false;
    };
    const stop = () => { window.clearInterval(interval); interval = undefined; };
    const start = () => { if (!interval && !document.hidden) interval = window.setInterval(next, 6500); };
    bar?.addEventListener('mouseenter', stop);
    bar?.addEventListener('mouseleave', start);
    bar?.addEventListener('focusin', stop);
    bar?.addEventListener('focusout', (event) => { if (!bar.contains(event.relatedTarget)) start(); });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    start();
  }

  // Essential and optional browser storage are deliberately separate.
  function cookieValue(name) {
    const found = document.cookie.split('; ').find((x) => x.startsWith(name + '='));
    if (!found) return null;
    try { return decodeURIComponent(found.substring(name.length + 1)); } catch { return null; }
  }
  function setCookie(name, value, maxAge) {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${config.basePath || '/'}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function getConsent() {
    try {
      const c = JSON.parse(cookieValue('li_consent'));
      return c && c.version === 1 && typeof c.analytics === 'boolean' && Number.isFinite(c.time) && c.time + days(180) > Date.now() ? c : null;
    } catch { return null; }
  }
  function clearAnalytics() { setCookie('li_visit', '', 0); removeStorage('li_analytics_v1'); }
  function trackPage() {
    if (!getConsent()?.analytics) { clearAnalytics(); return; }
    if (!cookieValue('li_visit')) setCookie('li_visit', crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`, 30 * 86400);
    const records = readStorage('li_analytics_v1');
    const safeRecords = Array.isArray(records) ? records.filter((x) => x && typeof x.path === 'string' && Number.isFinite(x.time)).slice(-99) : [];
    safeRecords.push({ path: location.pathname, time: Date.now() });
    saveStorage('li_analytics_v1', safeRecords);
  }
  function saveConsent(analytics) {
    setCookie('li_consent', JSON.stringify({ version: 1, analytics: !!analytics, time: Date.now() }), 180 * 86400);
    if (analytics) trackPage(); else clearAnalytics();
    $('#cookie-banner').hidden = true;
    closeDialog($('#cookie-dialog'));
    toast(analytics ? 'Your cookie preferences have been saved.' : 'Only essential storage is enabled.');
  }
  $$('[data-cookie-settings]').forEach((el) => el.addEventListener('click', () => {
    $('#analytics-consent').checked = getConsent()?.analytics === true;
    openDialog('cookie-dialog', el);
  }));
  $('[data-cookie-reject]').addEventListener('click', () => saveConsent(false));
  $('[data-cookie-accept]').addEventListener('click', () => saveConsent(true));
  $('[data-cookie-save]').addEventListener('click', () => saveConsent($('#analytics-consent').checked));
  if (!getConsent()) { clearAnalytics(); $('#cookie-banner').hidden = false; }
  else trackPage();

  function cleanCart(value) {
    if (!Array.isArray(value)) return [];
    const clean = [];
    for (const item of value.slice(0, 30)) {
      const p = products.find((x) => x.id === item?.id);
      if (!p || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      const shoe = p.id === 'zebra-stiletto';
      if (shoe && (!Number.isInteger(item.euSize) || item.euSize < 35 || item.euSize > 42)) continue;
      const row = { id: p.id, quantity: Math.min(item.quantity, 9), euSize: shoe ? item.euSize : null, system: ['EU', 'UK', 'US'].includes(item.system) ? item.system : 'EU' };
      const duplicate = clean.find((x) => x.id === row.id && x.euSize === row.euSize);
      if (duplicate) duplicate.quantity = Math.min(duplicate.quantity + row.quantity, 9); else clean.push(row);
    }
    return clean;
  }
  let cart = cleanCart(readStorage('li_cart_v1'));
  function cartCount() { return cart.reduce((a, x) => a + x.quantity, 0); }
  function updateBadge() { $$('[data-cart-count]').forEach((el) => { el.textContent = cartCount(); }); }
  function persistCart() { saveStorage('li_cart_v1', cart); updateBadge(); }
  updateBadge();
  const converted = (eu, system) => system === 'US' ? eu - 30 : system === 'UK' ? eu - 33 : eu;
  function addItem(id, euSize, system = 'EU', quantity = 1) {
    const p = products.find((x) => x.id === id);
    if (!p) throw new Error('Unknown creation.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9) throw new Error('Choose a quantity from 1 to 9.');
    if (!['EU', 'US', 'UK'].includes(system)) throw new Error('Unknown size system.');
    if (p.id === 'zebra-stiletto' && (!Number.isInteger(euSize) || euSize < 35 || euSize > 42)) throw new Error('Select a preferred shoe size first.');
    const size = p.id === 'zebra-stiletto' ? euSize : null;
    const existing = cart.find((x) => x.id === id && x.euSize === size);
    if (existing && existing.quantity + quantity > 9) throw new Error('For more than 9 of the same creation, please contact the Maison.');
    if (existing) { existing.quantity += quantity; existing.system = system; }
    else cart.push({ id, quantity, euSize: size, system });
    persistCart(); renderCart();
    toast(`${p.name} has been added to your bag.`);
    return { id, quantity, euSize: size, bagQuantity: cartCount() };
  }
  function renderSizes() {
    const container = $('[data-sizes]'); if (!container) return;
    container.replaceChildren();
    for (let eu = 35; eu <= 42; eu++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'size-option';
      b.textContent = converted(eu, sizeSystem); b.setAttribute('aria-label', `${sizeSystem} ${converted(eu, sizeSystem)}`);
      b.setAttribute('aria-pressed', String(eu === chosenEU));
      b.addEventListener('click', () => { chosenEU = eu; renderSizes(); $('[data-product-status]').textContent = `Preferred size: ${sizeSystem} ${converted(eu, sizeSystem)}${sizeSystem !== 'EU' ? ` (EU ${eu})` : ''}.`; });
      container.append(b);
    }
    $$('[data-size-system]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sizeSystem === sizeSystem)));
  }
  $$('[data-size-system]').forEach((b) => b.addEventListener('click', () => {
    sizeSystem = b.dataset.sizeSystem; renderSizes();
    if (chosenEU) $('[data-product-status]').textContent = `Preferred size: ${sizeSystem} ${converted(chosenEU, sizeSystem)}${sizeSystem !== 'EU' ? ` (EU ${chosenEU})` : ''}.`;
  }));
  renderSizes();
  $('[data-add-product]')?.addEventListener('click', () => {
    const id = $('[data-product]').dataset.product;
    try {
      addItem(id, chosenEU, sizeSystem);
      $('[data-product-status]').innerHTML = `Added to your selection. <a class="text-link" href="${route('cart/')}">View your bag</a>`;
    } catch (e) {
      $('[data-product-status]').textContent = e.message;
      if (!chosenEU) $('.size-option')?.focus();
    }
  });
  $$('[data-gallery]').forEach((b) => b.addEventListener('click', () => {
    const main = $('#product-main-image'); main.src = b.dataset.gallery; main.alt = b.dataset.alt;
    $$('[data-gallery]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('[data-zoom]')?.addEventListener('click', () => {
    const source = $('#product-main-image'), zoom = $('#zoomed-image'); zoom.src = source.src; zoom.alt = source.alt;
    openDialog('image-dialog');
  });

  // Collection filters and search operate on real catalogue records only.
  const catalogue = $('[data-catalog]');
  const searchParams = new URLSearchParams(location.search);
  let searchQuery = catalogue?.hasAttribute('data-search-page') ? (searchParams.get('q') || '').slice(0, 100) : '';
  const normalise = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function productMatches(p, query) {
    const text = normalise([p.name, p.fullName, p.description, p.category, p.colour, p.material, p.availability, ...p.collections].join(' '));
    return normalise(query).split(/\s+/).filter(Boolean).every((term) => text.includes(term));
  }
  const pageDirectory = [...config.products.map((p) => ({ title: p.name, path: `products/${p.id}/`, words: p.description })),
    ...[['Gifts', 'gifts/'], ['Handbags', 'handbags/'], ['Women', 'women/'], ['Men', 'men/'], ['New in', 'new-in/'], ['Children', 'children/'], ['Travel', 'travel/'], ['Jewellery & Watches', 'jewellery-watches/'], ['Décor & Lifestyle', 'decor-lifestyle/'], ['Client services', 'services/'], ['Maison Circle rewards', 'rewards/'], ['Shipping & delivery', 'shipping/'], ['Returns & refunds', 'returns/'], ['Size guide', 'size-guide/'], ['The Maison — our story', 'about/'], ['Contact us', 'contact/'], ['My account', 'account/']].map(([title, path]) => ({ title, path, words: title }))];
  function applyFilters() {
    if (!catalogue) return;
    const selected = Object.fromEntries($$('[data-filter]', catalogue).map((x) => [x.dataset.filter, x.value]));
    const order = $('[data-sort]', catalogue).value;
    const activeCount = Object.values(selected).filter((v) => v !== 'all').length + (order === 'featured' ? 0 : 1);
    const counter = $('[data-filter-count]', catalogue);
    if (counter) counter.textContent = activeCount ? String(activeCount) : '';
    const cards = $$('[data-product-card]', catalogue);
    let shown = 0;
    cards.forEach((card) => {
      const p = products.find((x) => x.id === card.dataset.id);
      const match = productMatches(p, searchQuery) && (selected.category === 'all' || p.category === selected.category)
        && (selected.availability === 'all' || card.dataset.availability === selected.availability)
        && (selected.price === 'all' || (selected.price === 'under400' ? p.price < 400 : p.price >= 400));
      card.hidden = !match; if (match) shown++;
    });
    cards.sort((a, b) => {
      const pa = products.find((x) => x.id === a.dataset.id), pb = products.find((x) => x.id === b.dataset.id);
      return order === 'price-asc' ? pa.price - pb.price : order === 'price-desc' ? pb.price - pa.price : order === 'name' ? pa.name.localeCompare(pb.name) : products.indexOf(pa) - products.indexOf(pb);
    }).forEach((card) => $('[data-product-grid]', catalogue).append(card));
    $('[data-results-count]', catalogue).textContent = `${shown} creation${shown === 1 ? '' : 's'}${searchQuery ? ` for “${searchQuery}”` : ''}`;
    $('[data-empty-results]', catalogue).hidden = shown > 0;
    const pages = $('#search-page-links');
    if (pages) {
      pages.replaceChildren();
      const matches = pageDirectory.filter((p) => !p.path.startsWith('products/') && searchQuery && normalise(p.title + ' ' + p.words).includes(normalise(searchQuery)));
      if (matches.length) {
        const h = document.createElement('h2'); h.textContent = 'Elsewhere in the Maison'; h.style.fontSize = '1.4rem'; pages.append(h);
        for (const p of matches) { const a = document.createElement('a'); a.href = route(p.path); a.className = 'text-link'; a.style.margin = '0 24px 12px 0'; a.textContent = p.title; pages.append(a); }
      }
    }
  }
  if (catalogue) {
    if ($('#page-search')) $('#page-search').value = searchQuery;
    $$('[data-filter], [data-sort]', catalogue).forEach((x) => x.addEventListener('change', applyFilters));
    $$('[data-clear-filters]', catalogue).forEach((button) => button.addEventListener('click', () => {
      $$('[data-filter]', catalogue).forEach((x) => { x.value = 'all'; }); $('[data-sort]', catalogue).value = 'featured';
      searchQuery = ''; if ($('#page-search')) $('#page-search').value = '';
      if (catalogue.hasAttribute('data-search-page')) history.replaceState(null, '', route('search/'));
      applyFilters();
    }));
    applyFilters();
  }

  function emailUrl(subject, body) { return `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
  function prepareEmail(form, subject, body) {
    const href = emailUrl(subject, body);
    const fallback = $('[data-email-fallback]', form);
    if (fallback) { fallback.href = href; fallback.hidden = false; }
    $('[data-form-status]', form).textContent = `Your email draft is ready. Send it in your email app to reach the Maison. If nothing opens, use the link below or write to ${config.email}.`;
    location.href = href;
  }
  $$('[data-newsletter]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const email = new FormData(form).get('email').trim();
    $('#newsletter-mail').href = emailUrl('Newsletter subscription request — LA INFINITÉ', `Hello LA INFINITÉ,\n\nPlease add ${email} to the Maison's email updates. I consent to receiving news about creations, collection previews and Maison services, and understand that I can unsubscribe at any time. I have read the Privacy notice.\n\nThank you.`);
    $('[data-form-status]', form).textContent = 'Your subscription request is ready to send by email.';
    openDialog('newsletter-dialog');
  }));
  const contactForm = $('[data-contact]');
  if (contactForm) {
    const requestProduct = products.find((p) => p.id === searchParams.get('product'));
    const subject = searchParams.get('subject');
    const subjects = { shipping: 'Shipping & delivery', returns: 'Returns & refunds', sizing: 'Size & fit advice', rewards: 'Maison Circle', account: 'Account access', privacy: 'Privacy request', 'private-order': 'Private order request' };
    if (subjects[subject]) $('#contact-subject').value = subjects[subject];
    if (requestProduct) $('#contact-message').value = `I would like to enquire about ${requestProduct.fullName}.\n\n`;
    else if (subject && !subjects[subject] && /^[a-z-]+$/.test(subject)) $('#contact-message').value = `I would like to enquire about the ${subject.replaceAll('-', ' ')} collection.\n\n`;
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault(); if (!contactForm.reportValidity()) return;
      const d = new FormData(contactForm);
      prepareEmail(contactForm, `${d.get('subject')} — LA INFINITÉ`, `Name: ${d.get('name')}\nEmail: ${d.get('email')}\n\n${d.get('message')}\n\nI have read the Privacy notice and understand that my information will be used to respond to this enquiry.`);
    });
  }
  $('[data-membership]')?.addEventListener('submit', (e) => {
    e.preventDefault(); const form = e.currentTarget; if (!form.reportValidity()) return;
    const d = new FormData(form);
    prepareEmail(form, 'Maison Circle — Invitation request', `Hello LA INFINITÉ,\n\nI would like to receive an invitation to Maison Circle when client accounts open.\n\nName: ${d.get('name')}\nEmail: ${d.get('email')}\n\nI consent to being contacted about Maison Circle membership and have read the Privacy notice.\n\nThank you.`);
  });
  function selectAccountTab(key, focus = false) {
    $$('[data-account-tab]').forEach((b) => { const active = b.dataset.accountTab === key; b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; if (active && focus) b.focus(); });
    $('#signin-panel').hidden = key !== 'signin'; $('#join-panel').hidden = key !== 'join';
  }
  $$('[data-account-tab]').forEach((b) => {
    b.addEventListener('click', () => selectAccountTab(b.dataset.accountTab));
    b.addEventListener('keydown', (e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); selectAccountTab(e.key === 'Home' ? 'signin' : e.key === 'End' ? 'join' : b.dataset.accountTab === 'signin' ? 'join' : 'signin', true); } });
  });
  if ($('#join-panel') && searchParams.get('tab') === 'join') selectAccountTab('join');

  const regionNames = { ZA: 'South Africa', US: 'United States', GB: 'United Kingdom', EUROPE: 'Europe (other)', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', ASIA: 'Asia', MIDDLE_EAST: 'Middle East', AFRICA: 'Africa (other)', AMERICAS: 'Central & South America', OTHER: 'Other destination' };
  let country = readStorage('li_country_v1'); if (!regionNames[country]) country = '';
  function shippingFor(code) { return ['US', 'GB', 'EUROPE'].includes(code) ? 0 : code === 'ZA' ? 60 : null; }
  function updateShipping() {
    const cost = shippingFor(country);
    if ($('[data-shipping-result]')) $('[data-shipping-result]').textContent = !country ? 'Choose a destination to see the current shipping arrangement.' : cost === 0 ? 'Complimentary express shipping. Destination coverage and any import charges are confirmed before purchase.' : cost === 60 ? '$60.00 USD shipping from Italy to South Africa. Import duties or destination taxes may be additional.' : 'An individual shipping quote will be provided before your order is confirmed. Please share your country and postal code with Client Services.';
    updateCartTotals();
  }
  $$('[data-shipping-country]').forEach((s) => {
    s.value = country;
    s.addEventListener('change', () => { country = s.value; saveStorage('li_country_v1', country); updateShipping(); });
  });
  const subtotal = () => cart.reduce((sum, item) => sum + products.find((p) => p.id === item.id).price * item.quantity, 0);
  function updateCartTotals() {
    if (!$('[data-subtotal]')) return;
    const cost = shippingFor(country), sub = subtotal();
    $('[data-subtotal]').textContent = formatMoney(sub);
    $('[data-delivery]').textContent = !country ? 'Select destination' : cost === null ? 'Quote required' : cost === 0 ? 'Complimentary' : formatMoney(cost);
    $('[data-total-label]').textContent = cost === null ? 'Subtotal · shipping pending' : 'Estimated total';
    $('[data-total]').textContent = cost === null ? formatMoney(sub) : formatMoney(sub + cost);
    $('[data-cart-shipping-note]').textContent = cost === null ? 'Shipping has not been included. Your complete total, applicable taxes and duties will be confirmed before purchase.' : 'Includes the listed shipping fee. Applicable import duties and any additional destination taxes are confirmed before purchase. All prices are USD.';
  }
  function renderCart() {
    const container = $('#cart-items'); if (!container) return;
    $('#empty-cart').hidden = cart.length > 0; $('#filled-cart').hidden = cart.length === 0;
    container.innerHTML = cart.map((item, index) => {
      const p = products.find((x) => x.id === item.id);
      const size = item.euSize ? `Preferred size: ${item.system} ${converted(item.euSize, item.system)}${item.system !== 'EU' ? ` · EU ${item.euSize}` : ''}` : 'One size · By request';
      return `<article class="cart-item"><a class="cart-image" href="${route(`products/${p.id}/`)}"><img src="${route(`assets/${p.images[0]}`)}" alt="${escapeHTML(p.name)}"></a><div><div class="item-line"><h2><a href="${route(`products/${p.id}/`)}">${escapeHTML(p.name)}</a></h2><p>${formatMoney(p.price * item.quantity)}</p></div><p>${escapeHTML(p.colour)}</p><p>${escapeHTML(size)}</p><div class="item-controls"><div class="quantity" aria-label="Quantity for ${escapeHTML(p.name)}"><button data-quantity="${index}" data-delta="-1" aria-label="Reduce quantity of ${escapeHTML(p.name)}" ${item.quantity === 1 ? 'disabled' : ''}>−</button><span>${item.quantity}</span><button data-quantity="${index}" data-delta="1" aria-label="Increase quantity of ${escapeHTML(p.name)}" ${item.quantity === 9 ? 'disabled' : ''}>+</button></div><button class="remove-item" data-remove="${index}" aria-label="Remove ${escapeHTML(p.name)} from bag">Remove</button></div></div></article>`;
    }).join('');
    $$('[data-quantity]', container).forEach((b) => b.addEventListener('click', () => {
      const index = Number(b.dataset.quantity), delta = Number(b.dataset.delta);
      cart[index].quantity = Math.max(1, Math.min(9, cart[index].quantity + delta));
      persistCart(); renderCart();
      $(`[data-quantity="${index}"][data-delta="${delta}"]`, container)?.focus();
    }));
    $$('[data-remove]', container).forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.remove), name = products.find((p) => p.id === cart[i].id).name;
      cart.splice(i, 1); persistCart(); renderCart(); toast(`${name} has been removed from your bag.`);
      $('[data-remove]', container)?.focus();
    }));
    updateCartTotals();
  }
  renderCart(); updateShipping();
  $('[data-request-order]')?.addEventListener('click', () => {
    if (!cart.length) return;
    if (!country) { $('[data-cart-status]').textContent = 'Please select your delivery destination first.'; $('[data-shipping-country]').focus(); return; }
    const cost = shippingFor(country);
    const lines = cart.map((item) => { const p = products.find((x) => x.id === item.id); return `${item.quantity} × ${p.fullName}${item.euSize ? ` — preferred ${item.system} ${converted(item.euSize, item.system)} (indicative EU ${item.euSize})` : ''}: ${formatMoney(p.price * item.quantity)} USD`; });
    const body = `Hello LA INFINITÉ,\n\nI would like to request the following order:\n\n${lines.join('\n')}\n\nDelivery destination: ${regionNames[country]}\nCountry and postal code: [Please complete]\nSubtotal: ${formatMoney(subtotal())} USD\nShipping: ${cost === null ? 'Individual quote requested' : `${formatMoney(cost)} USD`}\n${cost === null ? 'Final total: to be confirmed after shipping quote' : `Estimated total: ${formatMoney(subtotal() + cost)} USD`}\n\nPlease confirm availability, sizing, applicable taxes or duties, production timing and final payment arrangements. I understand that this enquiry does not reserve stock or constitute a confirmed order.\n\nName: [Please complete]\n\nThank you.`;
    const href = emailUrl('Personal order request — LA INFINITÉ', body);
    const fallback = $('[data-order-email]'); fallback.href = href; fallback.hidden = false;
    $('[data-cart-status]').textContent = 'Your request is ready in your email app. Please complete your details and send it. Your bag has been kept on this device.';
    location.href = href;
  });
  window.addEventListener('storage', (e) => {
    if (e.key) storageMemory.delete(e.key);
    if (e.key === 'li_cart_v1') { cart = cleanCart(readStorage('li_cart_v1')); updateBadge(); renderCart(); }
    if (e.key === 'li_country_v1') { const next = readStorage('li_country_v1'); country = regionNames[next] ? next : ''; $$('[data-shipping-country]').forEach((s) => { s.value = country; }); updateShipping(); }
  });

  // Progressive, page-scoped agent tools reuse the visible catalogue and bag.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = (tool) => {
      try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Unsupported browsers continue normally. */ }
    };
    register({ name: 'search_maison_catalogue', title: 'Search LA INFINITÉ creations', description: 'Read the current product catalogue. Does not reserve inventory or create an order.', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 100 } }, required: ['query'], additionalProperties: false }, execute(input) {
      if (!input || typeof input.query !== 'string' || input.query.length > 100) throw new Error('Provide a query of at most 100 characters.');
      return products.filter((p) => productMatches(p, input.query)).map((p) => ({ id: p.id, name: p.name, price: p.price, currency: 'USD', availability: p.availability, url: route(`products/${p.id}/`) }));
    } });
    register({ name: 'add_to_maison_bag', title: 'Add a creation to the bag', description: 'Stage a creation in the device-local bag. A shoe requires an indicative EU size. This is not an order, reservation or payment.', annotations: { readOnlyHint: false }, inputSchema: { type: 'object', properties: { productId: { type: 'string', enum: products.map((p) => p.id) }, euSize: { type: 'integer', minimum: 35, maximum: 42 }, quantity: { type: 'integer', minimum: 1, maximum: 9 } }, required: ['productId', 'quantity'], additionalProperties: false }, execute(input) {
      if (!input || typeof input.productId !== 'string') throw new Error('Provide a product ID.');
      return addItem(input.productId, input.euSize, 'EU', input.quantity);
    } });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
