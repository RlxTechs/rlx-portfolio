const URL='https://uwfyfuoiksjgyxoovxfn.supabase.co';
const KEY='sb_publishable_f4RpmT2AsQToBtiBiI6hBg_kqSZbwCj';
const ADMIN_EMAIL='bossedemardochee@gmail.com';
const sb=window.supabase.createClient(URL,KEY);
const state={reviews:[],orders:[],visits:[],messages:[],donations:[],downloads:[],products:[],erp:[],audit:[]};
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
function fmt(d){return d?new Date(d).toLocaleString('fr-FR'):'—'}
function setSync(v){$('syncState').textContent=v}
async function authUser(){const {data:{user}}=await sb.auth.getUser();return user}
async function boot(){
 const user=await authUser();
 if(!user){$('loginView').hidden=false;$('appView').hidden=true;return}
 if((user.email||'').toLowerCase()!==ADMIN_EMAIL){await sb.auth.signOut();$('authStatus').textContent='Ce compte n’est pas autorisé.';return}
 $('loginView').hidden=true;$('appView').hidden=false;$('sessionEmail').textContent=user.email;await refreshAll();
}
$('loginBtn').onclick=async()=>{const email=$('email').value.trim(),password=$('password').value;$('authStatus').textContent='Connexion…';const {error}=await sb.auth.signInWithPassword({email,password});$('authStatus').textContent=error?error.message:'';if(!error)boot()};
$('createBtn').onclick=async()=>{const email=$('email').value.trim(),password=$('password').value;if(email.toLowerCase()!==ADMIN_EMAIL){$('authStatus').textContent='Utilise l’adresse administrateur RLX.';return}if(password.length<8){$('authStatus').textContent='Choisis un mot de passe d’au moins 8 caractères.';return}$('authStatus').textContent='Création…';const {data,error}=await sb.auth.signUp({email,password});$('authStatus').textContent=error?error.message:(data.session?'Accès créé. Connexion…':'Compte créé. Vérifie ton email si Supabase demande une confirmation.');if(data.session)boot()};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('refreshBtn').onclick=()=>refreshAll();
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('tab-'+b.dataset.tab).classList.add('active')});

async function fetchTable(name,limit=200){
 const {data,error}=await sb.from(name).select('*').order('created_at',{ascending:false}).limit(limit);
 if(error) throw error; return data||[];
}
async function fetchJsonTable(name,limit=200){
 const {data,error}=await sb.from(name).select('*').order('updated_at',{ascending:false}).limit(limit);
 if(error) throw error; return data||[];
}
async function refreshAll(){
 setSync('Synchronisation…');
 try{
   const [reviews,orders,visits,messages,donations,downloads,products,erp,audit]=await Promise.all([
     fetchTable('reviews'),
     fetchTable('orders'),
     fetchTable('site_visits',300),
     fetchTable('contact_messages'),
     fetchTable('donations'),
     fetchTable('download_events',300),
     fetchJsonTable('products'),
     fetchJsonTable('erp_state'),
     fetchTable('audit_events',300)
   ]);
   Object.assign(state,{reviews,orders,visits,messages,donations,downloads,products,erp,audit});
   renderAll();$('lastRefresh').textContent='Mis à jour '+new Date().toLocaleTimeString('fr-FR');setSync('À jour');
 }catch(e){console.error(e);setSync('Erreur');toast(e.message||'Accès aux données refusé')}
}
function renderAll(){
 const pending=state.reviews.filter(x=>!x.approved).length;
 $('statVisits').textContent=state.visits.length;$('statReviews').textContent=state.reviews.length;$('statPending').textContent=pending;$('statOrders').textContent=state.orders.length;$('statMessages').textContent=state.messages.length;$('statDonations').textContent=state.donations.length;$('statProducts').textContent=state.products.length;$('statErp').textContent=state.erp.length;$('pendingBadge').textContent=pending||'';$('productsBadge').textContent=state.products.length||'';$('erpBadge').textContent=state.erp.length||'';
 renderReviews();renderOrders();renderVisits();renderMessages();renderDonations();renderDownloads();renderProducts();renderErp();renderAudit();renderRecent();
}
function renderRecent(){
 const all=[
  ...state.reviews.map(x=>({t:x.created_at,label:'Avis',text:x.display_name+' · '+x.rating+'/5'})),
  ...state.orders.map(x=>({t:x.created_at,label:'Commande',text:x.order_ref+' · '+x.customer_name})),
  ...state.messages.map(x=>({t:x.created_at,label:'Message',text:x.display_name+' · '+x.subject})),
  ...state.products.map(x=>({t:x.updated_at,label:'Produit',text:x.id})),
  ...state.erp.map(x=>({t:x.updated_at,label:'ERP State',text:x.id}))
 ].sort((a,b)=>new Date(b.t||0)-new Date(a.t||0)).slice(0,8);
 $('recentActivity').innerHTML=all.map(x=>'<div class="card"><div class="card-head"><b>'+esc(x.label)+'</b><span class="meta">'+fmt(x.t)+'</span></div><div>'+esc(x.text)+'</div></div>').join('')||'<div class="empty">Aucune activité.</div>';
}
function renderReviews(){
 const q=($('reviewSearch').value||'').toLowerCase(), rows=state.reviews.filter(x=>(x.display_name+' '+x.comment).toLowerCase().includes(q));
 $('reviewsList').innerHTML=rows.map(x=>'<article class="card"><div class="card-head"><div><b>'+esc(x.display_name)+'</b><div class="meta">'+x.rating+'/5 · '+fmt(x.created_at)+'</div></div><span class="pill '+(x.approved?'good':'warn')+'">'+(x.approved?'Publié':'En attente')+'</span></div><div>'+esc(x.comment)+'</div><div class="card-actions"><button class="'+(x.approved?'':'good')+'" data-review-toggle="'+x.id+'" data-approved="'+x.approved+'">'+(x.approved?'Retirer du site':'Publier')+'</button><button class="danger" data-review-delete="'+x.id+'">Supprimer</button></div></article>').join('')||'<div class="empty">Aucun avis.</div>';
 document.querySelectorAll('[data-review-toggle]').forEach(b=>b.onclick=()=>updateReview(b.dataset.reviewToggle,b.dataset.approved!=='true'));
 document.querySelectorAll('[data-review-delete]').forEach(b=>b.onclick=()=>removeRow('reviews',b.dataset.reviewDelete,'cet avis'));
}
$('reviewSearch').oninput=renderReviews;
async function updateReview(id,approved){const {error}=await sb.from('reviews').update({approved}).eq('id',id);if(error)return toast(error.message);toast(approved?'Avis publié':'Avis retiré');refreshAll()}
function renderOrders(){
 const q=($('orderSearch').value||'').toLowerCase(), rows=state.orders.filter(x=>(x.order_ref+' '+x.customer_name+' '+x.product_slug).toLowerCase().includes(q));
 $('ordersList').innerHTML=rows.map(x=>'<article class="card"><div class="card-head"><div><b>'+esc(x.order_ref)+'</b><div class="meta">'+esc(x.customer_name)+' · '+fmt(x.created_at)+'</div></div><b>'+Number(x.amount_eur).toFixed(2)+' €</b></div><div>'+esc(x.product_slug)+' · '+esc(x.payment_method)+'</div><div class="card-actions"><select data-order-status="'+x.id+'">'+['pending','payment_requested','paid','cancelled','refunded'].map(s=>'<option '+(s===x.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="danger" data-order-delete="'+x.id+'">Supprimer</button></div></article>').join('')||'<div class="empty">Aucune commande.</div>';
 document.querySelectorAll('[data-order-status]').forEach(s=>s.onchange=()=>updateStatus('orders',s.dataset.orderStatus,s.value));
 document.querySelectorAll('[data-order-delete]').forEach(b=>b.onclick=()=>removeRow('orders',b.dataset.orderDelete,'cette commande'));
}
$('orderSearch').oninput=renderOrders;
function renderVisits(){
 $('visitsList').innerHTML=table(['Date','Page','Langue','Écran','Session'],state.visits.map(x=>[fmt(x.created_at),esc(x.path),esc(x.locale),x.screen_width||'—',esc((x.session_id||'').slice(0,10))]));
}
function renderMessages(){
 $('messagesList').innerHTML=state.messages.map(x=>'<article class="card"><div class="card-head"><div><b>'+esc(x.display_name)+'</b><div class="meta">'+esc(x.email)+' · '+fmt(x.created_at)+'</div></div><span class="pill '+(x.status==='new'?'warn':'')+'">'+esc(x.status)+'</span></div><b>'+esc(x.subject)+'</b><div>'+esc(x.message)+'</div><div class="card-actions"><select data-message-status="'+x.id+'">'+['new','read','archived'].map(s=>'<option '+(s===x.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="danger" data-message-delete="'+x.id+'">Supprimer</button></div></article>').join('')||'<div class="empty">Aucun message.</div>';
 document.querySelectorAll('[data-message-status]').forEach(s=>s.onchange=()=>updateStatus('contact_messages',s.dataset.messageStatus,s.value));
 document.querySelectorAll('[data-message-delete]').forEach(b=>b.onclick=()=>removeRow('contact_messages',b.dataset.messageDelete,'ce message'));
}
function renderDonations(){
 $('donationsList').innerHTML=state.donations.map(x=>'<article class="card"><div class="card-head"><div><b>'+esc(x.donor_name||'Anonyme')+'</b><div class="meta">'+esc(x.campaign_slug)+' · '+fmt(x.created_at)+'</div></div><b>'+Number(x.amount_eur).toFixed(2)+' €</b></div><div>'+esc(x.payment_method)+' · '+esc(x.message||'')+'</div><div class="card-actions"><select data-donation-status="'+x.id+'">'+['pending','confirmed','rejected','refunded'].map(s=>'<option '+(s===x.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="danger" data-donation-delete="'+x.id+'">Supprimer</button></div></article>').join('')||'<div class="empty">Aucun don.</div>';
 document.querySelectorAll('[data-donation-status]').forEach(s=>s.onchange=()=>updateStatus('donations',s.dataset.donationStatus,s.value));
 document.querySelectorAll('[data-donation-delete]').forEach(b=>b.onclick=()=>removeRow('donations',b.dataset.donationDelete,'ce don'));
}
function renderDownloads(){$('downloadsList').innerHTML=table(['Date','Asset','Session'],state.downloads.map(x=>[fmt(x.created_at),esc(x.asset_slug),esc((x.session_id||'').slice(0,14))]))}

function safeJson(value){try{return JSON.stringify(value??{},null,2)}catch{return '{}'}}
function parseEditorJson(text,label){
 try{return JSON.parse(text)}
 catch(e){throw new Error(label+' : JSON invalide — '+e.message)}
}
function renderJsonRows(kind){
 const cfg=kind==='product'
  ?{rows:state.products,list:'productsList',search:'productSearch',count:'productCountLabel',edit:'product-edit',del:'product-delete'}
  :{rows:state.erp,list:'erpList',search:'erpSearch',count:'erpCountLabel',edit:'erp-edit',del:'erp-delete'};
 const q=($(cfg.search)?.value||'').toLowerCase();
 const rows=cfg.rows.filter(x=>(x.id+' '+safeJson(x.data)).toLowerCase().includes(q));
 $(cfg.count).textContent=rows.length+' élément'+(rows.length>1?'s':'');
 $(cfg.list).innerHTML=rows.map(x=>{
   const preview=safeJson(x.data);
   return '<article class="card json-record"><div class="card-head"><div><b>'+esc(x.id)+'</b><div class="meta">Mis à jour '+fmt(x.updated_at)+'</div></div><span class="pill">JSON</span></div><pre>'+esc(preview)+'</pre><div class="card-actions"><button data-'+cfg.edit+'="'+esc(x.id)+'">Modifier</button><button class="danger" data-'+cfg.del+'="'+esc(x.id)+'">Supprimer</button></div></article>';
 }).join('')||'<div class="empty">Aucune donnée.</div>';
 document.querySelectorAll('[data-'+cfg.edit+']').forEach(b=>b.onclick=()=>openJsonRecord(kind,b.getAttribute('data-'+cfg.edit)));
 document.querySelectorAll('[data-'+cfg.del+']').forEach(b=>b.onclick=()=>deleteJsonRecord(kind,b.getAttribute('data-'+cfg.del)));
}
function renderProducts(){renderJsonRows('product')}
function renderErp(){renderJsonRows('erp')}

function resetJsonEditor(kind){
 const isProduct=kind==='product';
 const idEl=$(isProduct?'productId':'erpId'),dataEl=$(isProduct?'productData':'erpData'),title=$(isProduct?'productEditorTitle':'erpEditorTitle'),del=$(isProduct?'deleteProductBtn':'deleteErpBtn'),status=$(isProduct?'productEditorStatus':'erpEditorStatus');
 idEl.value='';idEl.readOnly=false;del.disabled=true;status.textContent='';
 title.textContent=isProduct?'Nouveau produit':'Nouvel état ERP';
 dataEl.value=isProduct
  ?'{\n  "name": "Nouveau produit",\n  "price": 0,\n  "currency": "EUR",\n  "active": true\n}'
  :'{\n  "version": 1,\n  "app": "BOCAR GESTION",\n  "state": {}\n}';
}
function openJsonRecord(kind,id){
 const isProduct=kind==='product',rows=isProduct?state.products:state.erp,row=rows.find(x=>x.id===id);if(!row)return;
 const idEl=$(isProduct?'productId':'erpId'),dataEl=$(isProduct?'productData':'erpData'),title=$(isProduct?'productEditorTitle':'erpEditorTitle'),del=$(isProduct?'deleteProductBtn':'deleteErpBtn');
 idEl.value=row.id;idEl.readOnly=true;dataEl.value=safeJson(row.data);title.textContent=(isProduct?'Produit : ':'ERP State : ')+row.id;del.disabled=false;
 window.scrollTo({top:0,behavior:'smooth'});
}
async function saveJsonRecord(kind){
 const isProduct=kind==='product',tableName=isProduct?'products':'erp_state',idEl=$(isProduct?'productId':'erpId'),dataEl=$(isProduct?'productData':'erpData'),status=$(isProduct?'productEditorStatus':'erpEditorStatus');
 const rowId=idEl.value.trim();if(!rowId){status.textContent='Identifiant obligatoire.';return}
 let data;try{data=parseEditorJson(dataEl.value,isProduct?'Produit':'ERP State')}catch(e){status.textContent=e.message;return}
 status.textContent='Enregistrement…';
 const {error}=await sb.from(tableName).upsert({id:rowId,data,updated_at:new Date().toISOString()},{onConflict:'id'});
 if(error){status.textContent=error.message;return}
 status.textContent='Enregistré.';toast((isProduct?'Produit':'ERP State')+' sauvegardé');await refreshAll();openJsonRecord(kind,rowId);
}
async function deleteJsonRecord(kind,id){
 const isProduct=kind==='product',tableName=isProduct?'products':'erp_state',label=isProduct?'le produit':'l’état ERP';
 if(!confirm('Supprimer '+label+' « '+id+' » ?'))return;
 const {error}=await sb.from(tableName).delete().eq('id',id);if(error)return toast(error.message);
 toast('Supprimé');resetJsonEditor(kind);await refreshAll();
}

$('productSearch').oninput=renderProducts;
$('erpSearch').oninput=renderErp;
$('newProductBtn').onclick=()=>resetJsonEditor('product');
$('resetProductBtn').onclick=()=>resetJsonEditor('product');
$('saveProductBtn').onclick=()=>saveJsonRecord('product');
$('deleteProductBtn').onclick=()=>{const id=$('productId').value.trim();if(id)deleteJsonRecord('product',id)};
$('newErpBtn').onclick=()=>resetJsonEditor('erp');
$('resetErpBtn').onclick=()=>resetJsonEditor('erp');
$('saveErpBtn').onclick=()=>saveJsonRecord('erp');
$('deleteErpBtn').onclick=()=>{const id=$('erpId').value.trim();if(id)deleteJsonRecord('erp',id)};

function renderAudit(){$('auditList').innerHTML=table(['Date','Table','Action','Acteur','Record'],state.audit.map(x=>[fmt(x.created_at),esc(x.source_table),esc(x.action),esc(x.actor_email||'—'),esc(x.record_id||'—')]))}
function table(headers,rows){return '<table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
async function updateStatus(tableName,id,status){const {error}=await sb.from(tableName).update({status}).eq('id',id);if(error)return toast(error.message);toast('Statut mis à jour');refreshAll()}
async function removeRow(tableName,id,label){if(!confirm('Supprimer '+label+' ?'))return;const {error}=await sb.from(tableName).delete().eq('id',id);if(error)return toast(error.message);toast('Supprimé');refreshAll()}
sb.auth.onAuthStateChange(()=>boot());boot();