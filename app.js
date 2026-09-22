const SUPABASE_URL='https://uwfyfuoiksjgyxoovxfn.supabase.co';
const SUPABASE_KEY='sb_publishable_f4RpmT2AsQToBtiBiI6hBg_kqSZbwCj';
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);

// Ambient particle canvas
const canvas=document.getElementById('fx'),ctx=canvas.getContext('2d');let pts=[];
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);pts=Array.from({length:Math.min(95,Math.floor(innerWidth/13))},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.6+.2,v:(Math.random()*.25+.08)}))}resize();addEventListener('resize',resize);
function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);for(const p of pts){p.y-=p.v;if(p.y<0){p.y=innerHeight;p.x=Math.random()*innerWidth}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(190,150,255,.32)';ctx.fill()}requestAnimationFrame(draw)}draw();

const glow=document.getElementById('cursorGlow');addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px'});

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

document.querySelectorAll('.tilt').forEach(card=>{card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(900px) rotateX(${-y*7}deg) rotateY(${x*8}deg) translateY(-3px)`});card.addEventListener('pointerleave',()=>card.style.transform='')});

document.querySelectorAll('[data-modal]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.modal).showModal());document.querySelectorAll('.modal-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());

// Supabase analytics: anonymous session only, no fingerprinting.
(async()=>{if(!sb)return;let sid=localStorage.getItem('rlx_sid');if(!sid){sid=crypto.randomUUID();localStorage.setItem('rlx_sid',sid)}try{await sb.from('site_visits').insert({session_id:sid,path:location.pathname,referrer:document.referrer||null,locale:navigator.language||null,screen_width:screen.width})}catch{}})();

// Reviews
let rating=5;const starButtons=[...document.querySelectorAll('#stars button')];function paintStars(){starButtons.forEach((b,i)=>b.classList.toggle('active',i<rating))}paintStars();starButtons.forEach(b=>b.onclick=()=>{rating=+b.dataset.star;document.querySelector('[name=rating]').value=rating;paintStars()});
async function loadReviews(){if(!sb)return;const list=document.getElementById('reviewList');const {data,error}=await sb.from('reviews').select('display_name,rating,comment,created_at').order('created_at',{ascending:false}).limit(12);if(error||!data?.length)return;list.innerHTML=data.map(r=>`<article class="review-item"><div class="meta"><b>${escapeHtml(r.display_name)}</b><span>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><p>${escapeHtml(r.comment)}</p></article>`).join('')}
loadReviews();
document.getElementById('reviewForm').addEventListener('submit',async e=>{e.preventDefault();const status=document.getElementById('reviewStatus');if(!sb){status.textContent='Cloud indisponible.';return}const f=new FormData(e.currentTarget);status.textContent='Envoi...';const {error}=await sb.from('reviews').insert({display_name:f.get('display_name').trim(),rating:+f.get('rating'),comment:f.get('comment').trim(),approved:false});status.textContent=error?'Impossible d’envoyer pour le moment.':'Merci ! Ton avis a été reçu et attend validation.';if(!error)e.currentTarget.reset()});

// Shop orders
let selectedVbucks=5;document.querySelectorAll('.variant').forEach(b=>b.onclick=()=>{document.querySelectorAll('.variant').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedVbucks=+b.dataset.price;document.querySelector('.buy[data-product="vbucks"]').dataset.price=selectedVbucks});
const checkout=document.getElementById('checkoutModal'),cf=document.getElementById('checkoutForm');document.querySelectorAll('.buy').forEach(b=>b.onclick=()=>{const slug=b.dataset.product,price=+b.dataset.price;cf.product_slug.value=slug;cf.amount_eur.value=price;cf.product_label.value=(slug==='blenderfied'?'BlenderFied':'Carte V-Bucks')+' — '+price+' €';document.getElementById('checkoutStatus').textContent='';checkout.showModal()});
cf.addEventListener('submit',async e=>{e.preventDefault();const s=document.getElementById('checkoutStatus');if(!sb){s.textContent='Cloud indisponible.';return}const f=new FormData(cf),ref='RLX-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();s.textContent='Enregistrement...';const payload={order_ref:ref,product_slug:f.get('product_slug'),quantity:1,amount_eur:+f.get('amount_eur'),payment_method:f.get('payment_method'),customer_name:f.get('customer_name').trim(),email:f.get('email').trim()||null,phone:f.get('phone').trim()||null,status:'pending'};const {error}=await sb.from('orders').insert(payload);s.textContent=error?'La commande n’a pas pu être enregistrée.':`Commande ${ref} enregistrée. Le paiement réel sera activé après connexion du compte marchand.`});

function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
