/* =========================================================
   BOOSTFIT — script.js
   Handles: page routing, signup/login/logout, product catalog,
   cart persistence, macro calculator, dashboard personalization,
   contact form — all backed by localStorage.
   ========================================================= */

/* ---------- helpers ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const LS_USERS   = 'boostfit_users';
const LS_SESSION = 'boostfit_session';
const LS_MESSAGES= 'boostfit_messages';

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function showToast(msg){
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ---------- static data ---------- */
const PRODUCTS = [
  { id:'p1', name:'Whey Isolate — Vanilla',   price:34.99, protein:27, carbs:3,  fat:1,  color:'var(--accent)' },
  { id:'p2', name:'Whey Isolate — Chocolate', price:34.99, protein:26, carbs:4,  fat:2,  color:'var(--accent)' },
  { id:'p3', name:'Plant Protein — Cocoa',    price:31.99, protein:22, carbs:6,  fat:3,  color:'var(--accent-3)' },
  { id:'p4', name:'Mass Gainer — Banana',     price:39.99, protein:30, carbs:85, fat:6,  color:'var(--accent-2)' },
  { id:'p5', name:'Protein Bar — Peanut',     price:2.99,  protein:20, carbs:22, fat:8,  color:'var(--accent-2)' },
  { id:'p6', name:'Casein — Slow Release',    price:36.99, protein:25, carbs:4,  fat:2,  color:'var(--accent-3)' },
];

const PROGRAMS = [
  { id:'g1', name:'Push / Pull / Legs', sets:'18 sets', freq:'6 days/wk', level:'Intermediate', desc:'Classic hypertrophy split rotating push, pull, and leg days twice weekly.' },
  { id:'g2', name:'Upper / Lower Power', sets:'14 sets', freq:'4 days/wk', level:'Intermediate', desc:'Strength-focused split alternating upper and lower body with heavy compounds.' },
  { id:'g3', name:'Full Body Foundations', sets:'12 sets', freq:'3 days/wk', level:'Beginner', desc:'Whole-body sessions to build baseline strength before specializing.' },
  { id:'g4', name:'5-Day Bodybuilder Split', sets:'20 sets', freq:'5 days/wk', level:'Advanced', desc:'One muscle group per day for maximum volume and isolation work.' },
  { id:'g5', name:'Athletic Conditioning', sets:'10 sets', freq:'4 days/wk', level:'All levels', desc:'Strength paired with sprint and mobility work for sport performance.' },
  { id:'g6', name:'Home Minimalist', sets:'8 sets', freq:'3 days/wk', level:'Beginner', desc:'Bodyweight and dumbbell-only program for training anywhere.' },
];

/* ---------- state ---------- */
let users = loadJSON(LS_USERS, []);
let sessionEmail = loadJSON(LS_SESSION, null);

function currentUser(){
  return users.find(u => u.email === sessionEmail) || null;
}
function persistUsers(){ saveJSON(LS_USERS, users); }
function updateUser(email, patch){
  const idx = users.findIndex(u => u.email === email);
  if(idx > -1){ users[idx] = { ...users[idx], ...patch }; persistUsers(); }
}

/* default macro ring values (used on hero when no calc saved) */
const DEFAULT_MACROS = { kcal:2180, protein:165, carbs:210, fat:65 };

/* =========================================================
   ROUTING
   ========================================================= */
function navigate(pageId){
  if((pageId === 'dashboard') && !currentUser()){
    pageId = 'account';
    showToast('Log in to view your dashboard');
  }
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === pageId));
  $$('.nav-link').forEach(l => l.classList.toggle('is-active', l.dataset.nav === pageId));
  document.getElementById('navLinks')?.parentElement?.classList.remove('menu-open');
  window.scrollTo({ top:0, behavior:'smooth' });
  if(pageId === 'dashboard') renderDashboard();
  if(pageId === 'cart') renderCart();
}

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if(navBtn){ navigate(navBtn.dataset.nav); }
});

$('#hamburger').addEventListener('click', () => {
  $('.nav').classList.toggle('menu-open');
});

/* =========================================================
   NAV ACTIONS (auth-aware)
   ========================================================= */
function renderNavActions(){
  const actions = $('#navActions');
  const user = currentUser();
  const cart = user ? (user.cart || []) : [];
  const cartCount = cart.reduce((n,i) => n + i.qty, 0);

  if(user){
    actions.innerHTML = `
      <button class="pill-btn cart-badge" data-nav="cart">
        🛒 Cart ${cartCount ? `<span class="cart-count">${cartCount}</span>` : ''}
      </button>
      <button class="pill-btn" data-nav="dashboard">
        <span class="avatar-dot">${user.name.charAt(0).toUpperCase()}</span>
        ${user.name.split(' ')[0]}
      </button>
    `;
  } else {
    actions.innerHTML = `
      <button class="pill-btn cart-badge" data-nav="cart">🛒 Cart</button>
      <button class="btn btn-accent btn-small" data-nav="account">Log in</button>
    `;
  }
}

/* =========================================================
   MACRO RING RENDERING (signature visual, reused 4x)
   ========================================================= */
function setRing(svg, protein, carbs, fat){
  // radii match the SVG markup: 92 / 72 / 52
  const radii = { protein:92, carbs:72, fat:52 };
  const values = { protein, carbs, fat };
  // scale each ring to a reasonable visual max so bars read clearly
  const maxes = { protein:220, carbs:320, fat:110 };
  ['protein','carbs','fat'].forEach(key => {
    const circle = svg.querySelector(`.ring-${key}`);
    if(!circle) return;
    const r = radii[key];
    const c = 2 * Math.PI * r;
    const pct = Math.min(1, values[key] / maxes[key]);
    circle.style.strokeDasharray = `${c * pct} ${c}`;
  });
}

function renderMacroWidget({ svgId, kcalId, pId, cId, fId }, macros){
  const svg = document.getElementById(svgId);
  if(!svg) return;
  setRing(svg, macros.protein, macros.carbs, macros.fat);
  const kcalEl = document.getElementById(kcalId);
  if(kcalEl) kcalEl.textContent = macros.kcal.toLocaleString();
  const pEl = document.getElementById(pId); if(pEl) pEl.textContent = `${macros.protein}g`;
  const cEl = document.getElementById(cId); if(cEl) cEl.textContent = `${macros.carbs}g`;
  const fEl = document.getElementById(fId); if(fEl) fEl.textContent = `${macros.fat}g`;
}

function renderHeroRing(){
  const user = currentUser();
  const macros = (user && user.macros) ? user.macros : DEFAULT_MACROS;
  renderMacroWidget({ svgId:'heroRing', kcalId:'heroKcal', pId:'legendP', cId:'legendC', fId:'legendF' }, macros);
}

/* =========================================================
   SHOP
   ========================================================= */
function renderProducts(){
  const grid = $('#productGrid');
  grid.innerHTML = PRODUCTS.map(p => `
    <div class="product-card">
      <div class="product-thumb" style="background:${p.color}">${p.name.charAt(0)}</div>
      <h3>${p.name}</h3>
      <div class="product-macros">
        <span>P <b>${p.protein}g</b></span>
        <span>C <b>${p.carbs}g</b></span>
        <span>F <b>${p.fat}g</b></span>
      </div>
      <div class="product-foot">
        <span class="product-price">$${p.price.toFixed(2)}</span>
        <button class="btn btn-accent btn-small" data-add="${p.id}">Add to cart</button>
      </div>
    </div>
  `).join('');
}

$('#productGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if(!btn) return;
  addToCart(btn.dataset.add);
});

function addToCart(productId){
  const user = currentUser();
  if(!user){
    showToast('Log in to add items to your cart');
    navigate('account');
    return;
  }
  const cart = user.cart || [];
  const existing = cart.find(i => i.id === productId);
  if(existing){ existing.qty += 1; }
  else { cart.push({ id:productId, qty:1 }); }
  updateUser(user.email, { cart });
  renderNavActions();
  const product = PRODUCTS.find(p => p.id === productId);
  showToast(`${product.name} added to cart`);
}

/* =========================================================
   PROGRAMS
   ========================================================= */
function renderPrograms(){
  const list = $('#programList');
  list.innerHTML = PROGRAMS.map((p, i) => `
    <div class="program-row">
      <span class="program-num">${String(i+1).padStart(2,'0')}</span>
      <div class="program-info">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
      </div>
      <div class="program-meta">
        <span>${p.sets}</span><span>${p.freq}</span><span>${p.level}</span>
      </div>
      <button class="btn btn-ghost btn-small" data-program="${p.id}">Save to dashboard</button>
    </div>
  `).join('');
}

$('#programList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-program]');
  if(!btn) return;
  const user = currentUser();
  if(!user){
    showToast('Log in to save a program');
    navigate('account');
    return;
  }
  const program = PROGRAMS.find(p => p.id === btn.dataset.program);
  updateUser(user.email, { program });
  showToast(`${program.name} saved to your dashboard`);
});

/* =========================================================
   MACRO CALCULATOR
   ========================================================= */
$('#calcForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const weight = parseFloat($('#calcWeight').value);
  const height = parseFloat($('#calcHeight').value);
  const age = parseFloat($('#calcAge').value);
  const activity = parseFloat($('#calcActivity').value);
  const goalAdjust = parseFloat($('#calcGoal').value);

  // Mifflin-St Jeor (using a neutral midpoint constant, no sex field to keep the form simple)
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) - 78;
  const tdee = bmr * activity;
  const kcal = Math.round(tdee + goalAdjust);

  const protein = Math.round(weight * 2); // ~2g/kg
  const fat = Math.round((kcal * 0.25) / 9);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbs = Math.max(0, Math.round((kcal - proteinKcal - fatKcal) / 4));

  const macros = { kcal, protein, carbs, fat };
  window._lastCalc = macros;

  renderMacroWidget({ svgId:'calcRing', kcalId:'calcKcal', pId:'calcP', cId:'calcC', fId:'calcF' }, macros);
  $('#calcNote').textContent = `Based on ${weight}kg, ${height}cm, age ${age}, at your selected activity level.`;
  $('#saveCalcBtn').style.display = 'block';
  showToast('Macros calculated');
});

$('#saveCalcBtn').addEventListener('click', () => {
  const user = currentUser();
  if(!user){
    showToast('Log in to save this to your dashboard');
    navigate('account');
    return;
  }
  if(!window._lastCalc) return;
  updateUser(user.email, { macros: window._lastCalc });
  renderHeroRing();
  showToast('Saved to your dashboard');
});

/* =========================================================
   AUTH — signup / login / logout
   ========================================================= */
$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
});
$$('.link-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
});
function switchAuthTab(tab){
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#loginForm').classList.toggle('hidden', tab !== 'login');
  $('#signupForm').classList.toggle('hidden', tab !== 'signup');
}

$('#signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#signupName').value.trim();
  const email = $('#signupEmail').value.trim().toLowerCase();
  const password = $('#signupPassword').value;

  if(users.some(u => u.email === email)){
    showToast('An account with that email already 