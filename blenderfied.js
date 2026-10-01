import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

const $=id=>document.getElementById(id);
const viewport=$('viewport');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x101019);
const camera=new THREE.PerspectiveCamera(50,1,.05,3000);
camera.position.set(7,5,8);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.target.set(0,1,0);
const transform=new TransformControls(camera,renderer.domElement);
transform.setSize(.85);
const transformHelper=transform.getHelper();
transformHelper.userData.helper=true;
scene.add(transformHelper);
transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);
transform.addEventListener('mouseDown',()=>checkpoint());
transform.addEventListener('objectChange',()=>{syncInspector();scheduleAutosave();renderKeyframes()});

const hemi=new THREE.HemisphereLight(0xded8ff,0x282035,1.8);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(6,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const grid=new THREE.GridHelper(60,60,0x7565a0,0x2b2a38);grid.userData.helper=true;scene.add(grid);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x292834,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;ground.userData.helper=true;scene.add(ground);

let selected=null,snap=false,playing=false,playStart=0,currentTime=0,duration=10,pendingImageFile=null;
let saveTimer=null,historyApplying=false;
const keyframes=new Map(), importedClips=new Map(), undoStack=[],redoStack=[];
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const DEFAULT_KEYS={translate:'g',rotate:'r',scale:'s',focus:'f',duplicate:'d',delete:'delete',play:'space',keyframe:'k',save:'ctrl+s'};
let settings=loadSettings();

function id(){return crypto.randomUUID()}
function editorObjects(){return scene.children.filter(o=>o.userData?.editable)}
function ensureMeta(o){o.userData.editable=true;o.userData.editorId=o.userData.editorId||id();return o}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1900)}
function nameFor(base){let n=1,label=base;while(scene.getObjectByName(label))label=base+'.'+String(n++).padStart(3,'0');return label}
function basicMat(color=0x8e72ff){return new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.06})}
function markShadows(o){o.traverse?.(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}})}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
addEventListener('resize',resize);resize();

function animate(now){requestAnimationFrame(animate);orbit.update();if(playing){currentTime=(now-playStart)/1000;if(currentTime>duration){currentTime=0;playStart=now}applyAnimation(currentTime);updateTimelineUI()}renderer.render(scene,camera)}
requestAnimationFrame(animate);

function meshBox(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),basicMat(color));m.castShadow=m.receiveShadow=true;return m}
function meshCylinder(rt,rb,h,color,segments=20){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),basicMat(color));m.castShadow=m.receiveShadow=true;return m}

function addPrimitive(type,pos=[0,.5,0],opts={}){
 if(!opts.noHistory)checkpoint();
 let o;
 if(type==='cube')o=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),basicMat(0x8e72ff));
 if(type==='sphere')o=new THREE.Mesh(new THREE.SphereGeometry(.7,36,24),basicMat(0x69b7ff));
 if(type==='cylinder')o=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.4,32),basicMat(0xff8db0));
 if(type==='plane'){o=new THREE.Mesh(new THREE.PlaneGeometry(3,3),basicMat(0x626271));o.rotation.x=-Math.PI/2;o.position.y=.01}
 if(type==='light'){o=new THREE.PointLight(0xffffff,8,25);o.add(new THREE.Mesh(new THREE.SphereGeometry(.12,16,10),new THREE.MeshBasicMaterial({color:0xffe7a0})));pos=[2,3,2]}
 if(type==='spot'){o=new THREE.SpotLight(0xffffff,12,35,Math.PI/5,.35,1.2);o.target.position.set(0,0,0);o.add(o.target);pos=[3,5,3]}
 if(type==='camera')o=new THREE.PerspectiveCamera(45,16/9,.1,1000);
 if(type==='group')o=new THREE.Group();
 if(!o)return null;
 ensureMeta(o);o.name=nameFor(({cube:'Cube',sphere:'Sphère',cylinder:'Cylindre',plane:'Plan',light:'Point Light',spot:'Spot',camera:'Caméra',group:'Groupe'})[type]||'Objet');
 o.userData.sourceType=type;o.position.set(...pos);markShadows(o);scene.add(o);select(o);refreshTree();scheduleAutosave();return o
}
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addPrimitive(b.dataset.add));

function addPrefab(type,pos=[0,0,0],opts={}){
 if(!opts.noHistory)checkpoint();
 const g=ensureMeta(new THREE.Group());g.userData.prefab=type;g.name=nameFor(type[0].toUpperCase()+type.slice(1));
 if(type==='tree'){
  const trunk=meshCylinder(.18,.24,2,0x70482f,14);trunk.position.y=1;
  const c1=new THREE.Mesh(new THREE.IcosahedronGeometry(1.0,2),basicMat(0x397b49));c1.position.y=2.45;c1.scale.set(1,1.15,1);
  const c2=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,2),basicMat(0x4d9658));c2.position.set(.45,2.35,.05);
  g.add(trunk,c1,c2)
 }
 if(type==='rock'){
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.75,1),basicMat(0x77727c));r.scale.set(1.35,.7,1);r.rotation.set(.15,.4,.08);g.add(r)
 }
 if(type==='building'){
  const body=meshBox(3,5,2.6,0x55596c);body.position.y=2.5;g.add(body);
  for(let y=1;y<=4;y++)for(let x of [-.85,0,.85]){const w=meshBox(.42,.55,.04,0x9bd1ff);w.position.set(x,y+.2,1.32);w.material.emissive.set(0x143650);w.material.emissiveIntensity=.25;g.add(w)}
  const door=meshBox(.65,1.15,.06,0x252633);door.position.set(0,.58,1.34);g.add(door)
 }
 if(type==='house'){
  const body=meshBox(3,2.3,2.5,0xd0b89f);body.position.y=1.15;g.add(body);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(2.15,1.25,4),basicMat(0x7a3d3d));roof.position.y=2.9;roof.rotation.y=Math.PI/4;g.add(roof);
  const door=meshBox(.7,1.35,.05,0x4b332b);door.position.set(0,.68,1.28);g.add(door)
 }
 if(type==='road'){
  const road=meshBox(10,.08,3.5,0x292b32);road.position.y=.04;g.add(road);
  for(let x=-4;x<=4;x+=2){const s=meshBox(.9,.015,.08,0xeedc91);s.position.set(x,.09,0);g.add(s)}
 }
 if(type==='lamp'){
  const pole=meshCylinder(.06,.09,3.1,0x3d414b,12);pole.position.y=1.55;g.add(pole);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.18,18,12),new THREE.MeshStandardMaterial({color:0xfff1c2,emissive:0xffd27a,emissiveIntensity:2}));bulb.position.y=3.15;g.add(bulb);
  const l=new THREE.PointLight(0xffdb9e,4,9);l.position.y=3.15;g.add(l)
 }
 if(type==='stairs'){for(let i=0;i<8;i++){const step=meshBox(1.7,.22,.5,0x707181);step.position.set(0,.11+i*.22,i*.42);g.add(step)}}
 if(type==='wall'){const wall=meshBox(4,2.7,.18,0x8a8391);wall.position.y=1.35;g.add(wall)}
 g.position.set(...pos);markShadows(g);scene.add(g);select(g);refreshTree();scheduleAutosave();return g
}
document.querySelectorAll('[data-prefab]').forEach(b=>b.onclick=()=>addPrefab(b.dataset.prefab));

function clearEditable(){
 transform.detach();selected=null;
 for(const o of [...editorObjects()])scene.remove(o);
 keyframes.clear();importedClips.clear();refreshTree();syncInspector();renderKeyframes()
}
function applyScenePreset(kind,noHistory=false){
 if(!noHistory)checkpoint();clearEditable();
 if(kind==='empty'){ground.material.color.set(0x292834);setLighting('day',true)}
 if(kind==='studio'){
  ground.material.color.set(0x18181f);setLighting('studio',true);
  addPrefab('wall',[0,0,-4],{noHistory:true});const w=editorObjects().at(-1);w.scale.set(2.4,2,1);
  addPrimitive('cube',[0,.5,0],{noHistory:true});selected.scale.set(1.5,1,1.5);selected.name='Produit';
 }
 if(kind==='forest'){
  ground.material.color.set(0x314532);setLighting('day',true);scene.fog=new THREE.FogExp2(0x8ca58c,.025);$('fogToggle').checked=true;$('fogDensity').value=.025;
  const pts=[[-5,0,-4],[-2,0,-6],[2,0,-5],[5,0,-3],[-6,0,1],[-3,0,3],[1,0,4],[5,0,3],[-1,0,0],[4,0,-7]];
  pts.forEach(p=>addPrefab('tree',p,{noHistory:true}));
  [[-3,0,-1],[3,0,1],[6,0,0],[0,0,-7]].forEach(p=>addPrefab('rock',p,{noHistory:true}))
 }
 if(kind==='city'){
  ground.material.color.set(0x3b3b42);setLighting('day',true);addPrefab('road',[0,0,0],{noHistory:true});
  [-4,-1,2,5].forEach((z,i)=>{addPrefab('building',[-4.2,0,z],{noHistory:true});selected.scale.y=.7+i*.12;addPrefab('building',[4.2,0,z],{noHistory:true});selected.scale.y=.9+i*.08});
  [-3,0,3].forEach(z=>{addPrefab('lamp',[-2,0,z],{noHistory:true});addPrefab('lamp',[2,0,z],{noHistory:true})})
 }
 if(kind==='desert'){
  ground.material.color.set(0xb79560);setLighting('sunset',true);scene.fog=new THREE.FogExp2(0xd39a65,.012);$('fogToggle').checked=true;$('fogDensity').value=.012;
  [[-4,0,-2],[-1,0,3],[3,0,-4],[5,0,2],[0,0,-6]].forEach((p,i)=>{addPrefab('rock',p,{noHistory:true});selected.scale.multiplyScalar(1+i*.18)})
 }
 if(kind==='interior'){
  ground.material.color.set(0x665f62);setLighting('studio',true);
  addPrefab('wall',[0,0,-4],{noHistory:true});selected.scale.x=2.5;
  addPrefab('wall',[-5,0,0],{noHistory:true});selected.rotation.y=Math.PI/2;selected.scale.x=2;
  addPrimitive('cube',[0,.45,-1],{noHistory:true});selected.scale.set(3,.9,1);selected.name='Canapé';
  addPrimitive('cube',[0,.35,2],{noHistory:true});selected.scale.set(1.7,.7,1);selected.name='Table';
  addPrefab('lamp',[3,0,-2],{noHistory:true})
 }
 selected=null;transform.detach();refreshTree();syncInspector();focusScene();scheduleAutosave();toast('Scène '+kind+' chargée')
}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>applyScenePreset(b.dataset.scene));

function setLighting(kind,noSave=false){
 if(kind==='day'){scene.background.set(0x9ab5d4);hemi.color.set(0xe6ecff);hemi.groundColor.set(0x4c5a49);hemi.intensity=2;sun.color.set(0xfff3dd);sun.intensity=3;sun.position.set(6,10,5)}
 if(kind==='sunset'){scene.background.set(0x6b3b58);hemi.color.set(0xffc0ad);hemi.groundColor.set(0x442a3f);hemi.intensity=1.6;sun.color.set(0xff9a62);sun.intensity=4;sun.position.set(-7,4,4)}
 if(kind==='night'){scene.background.set(0x090d1d);hemi.color.set(0x6578c9);hemi.groundColor.set(0x080812);hemi.intensity=.85;sun.color.set(0x8fa8ff);sun.intensity=1.2;sun.position.set(4,9,-6)}
 if(kind==='studio'){scene.background.set(0x15131d);hemi.color.set(0xffffff);hemi.groundColor.set(0x3a3345);hemi.intensity=2.6;sun.color.set(0xffffff);sun.intensity=4.6;sun.position.set(5,7,6)}
 $('worldColor').value='#'+scene.background.getHexString();$('ambientPower').value=hemi.intensity;$('sunPower').value=sun.intensity;if(!noSave)scheduleAutosave()
}
document.querySelectorAll('[data-lighting]').forEach(b=>b.onclick=()=>setLighting(b.dataset.lighting));

function selectableRoot(o){
 while(o&&o.parent&&o.parent!==scene){if(o.parent.userData?.editable)o=o.parent;else break}
 return o?.userData?.editable?o:null
}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(transform.dragging)return;
 const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects(editorObjects(),true).find(h=>!h.object.userData?.helper);if(hit){const o=selectableRoot(hit.object);if(o)select(o)}
});
function select(o){selected=o;transform.detach();if(o)transform.attach(o);refreshTree();syncInspector();renderKeyframes();$('selectedTrack').textContent=o?o.name:'Aucun objet'}
function refreshTree(){
 const el=$('sceneTree');el.innerHTML='';
 editorObjects().forEach(o=>{const d=document.createElement('div');d.className='scene-item'+(selected===o?' active':'');d.innerHTML='<span class="type">'+(o.isLight?'✦':o.isCamera?'◉':o.isGroup?'▦':'◆')+'</span><span>'+esc(o.name)+'</span>';d.onclick=()=>select(o);el.appendChild(d)})
}
function getMaterial(o){if(!o)return null;if(o.isMesh&&o.material?.color)return Array.isArray(o.material)?o.material[0]:o.material;let m=null;o.traverse?.(c=>{if(!m&&c.isMesh&&c.material?.color)m=Array.isArray(c.material)?c.material[0]:c.material});return m}
const ui=Object.fromEntries(['objName','px','py','pz','rx','ry','rz','sx','sy','sz','matColor','metalness','roughness','lightIntensity','lightColor'].map(k=>[k,$(k)]));
function syncInspector(){
 const box=$('inspector'),empty=$('emptyInspector');if(!selected){box.hidden=true;empty.hidden=false;return}box.hidden=false;empty.hidden=true;
 ui.objName.value=selected.name;['x','y','z'].forEach(a=>ui['p'+a].value=selected.position[a].toFixed(3));['x','y','z'].forEach(a=>ui['r'+a].value=THREE.MathUtils.radToDeg(selected.rotation[a]).toFixed(2));['x','y','z'].forEach(a=>ui['s'+a].value=selected.scale[a].toFixed(3));
 const m=getMaterial(selected);$('materialPanel').hidden=!m;if(m){ui.matColor.value='#'+m.color.getHexString();ui.metalness.value=m.metalness??0;ui.roughness.value=m.roughness??.5}
 const l=selected.isLight?selected:null;$('lightPanel').hidden=!l;if(l){ui.lightIntensity.value=l.intensity;ui.lightColor.value='#'+l.color.getHexString()}
}
for(const idn of ['px','py','pz'])ui[idn].onchange=()=>{if(selected){selected.position[idn[1]]=+ui[idn].value;scheduleAutosave()}};
for(const idn of ['rx','ry','rz'])ui[idn].onchange=()=>{if(selected){selected.rotation[idn[1]]=THREE.MathUtils.degToRad(+ui[idn].value);scheduleAutosave()}};
for(const idn of ['sx','sy','sz'])ui[idn].onchange=()=>{if(selected){selected.scale[idn[1]]=Math.max(.001,+ui[idn].value);scheduleAutosave()}};
ui.objName.onchange=()=>{if(selected){selected.name=ui.objName.value.trim()||'Objet';refreshTree();$('selectedTrack').textContent=selected.name;scheduleAutosave()}};
ui.matColor.oninput=()=>{const m=getMaterial(selected);if(m){m.color.set(ui.matColor.value);scheduleAutosave()}};
ui.metalness.oninput=()=>{const m=getMaterial(selected);if(m&&'metalness'in m){m.metalness=+ui.metalness.value;scheduleAutosave()}};
ui.roughness.oninput=()=>{const m=getMaterial(selected);if(m&&'roughness'in m){m.roughness=+ui.roughness.value;scheduleAutosave()}};
ui.lightIntensity.oninput=()=>{if(selected?.isLight){selected.intensity=+ui.lightIntensity.value;scheduleAutosave()}};
ui.lightColor.oninput=()=>{if(selected?.isLight){selected.color.set(ui.lightColor.value);scheduleAutosave()}};
document.querySelectorAll('#inspect-object input').forEach(i=>i.addEventListener('focus',()=>checkpoint(),{once:false}));

function setMode(mode){transform.setMode(mode);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('toggleGrid').onclick=e=>{grid.visible=!grid.visible;e.currentTarget.classList.toggle('active',grid.visible);scheduleAutosave()};
$('toggleSnap').onclick=e=>{snap=!snap;transform.setTranslationSnap(snap?.5:null);transform.setRotationSnap(snap?THREE.MathUtils.degToRad(15):null);transform.setScaleSnap(snap?.1:null);e.currentTarget.classList.toggle('active',snap)};
$('focusBtn').onclick=focusSelected;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function setView(v){const t=selected?new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3()):orbit.target.clone(),d=8;if(v==='front')camera.position.set(t.x,t.y,t.z+d);if(v==='side')camera.position.set(t.x+d,t.y,t.z);if(v==='top')camera.position.set(t.x,t.y+d,t.z+.001);if(v==='perspective')camera.position.set(t.x+d*.75,t.y+d*.55,t.z+d*.75);orbit.target.copy(t);orbit.update()}
function focusSelected(){if(!selected)return;const box=new THREE.Box3().setFromObject(selected);const c=box.getCenter(new THREE.Vector3()),s=Math.max(box.getSize(new THREE.Vector3()).length(),1);orbit.target.copy(c);camera.position.copy(c.clone().add(new THREE.Vector3(s*.75,s*.55,s*.75)));orbit.update()}
function focusScene(){const objs=editorObjects();if(!objs.length){camera.position.set(7,5,8);orbit.target.set(0,1,0);return}const box=new THREE.Box3();objs.forEach(o=>box.expandByObject(o));const c=box.getCenter(new THREE.Vector3()),s=Math.max(box.getSize(new THREE.Vector3()).length(),5);orbit.target.copy(c);camera.position.copy(c.clone().add(new THREE.Vector3(s*.6,s*.4,s*.6)));orbit.update()}

function deleteSelected(){if(!selected)return;checkpoint();transform.detach();keyframes.delete(selected.userData.editorId);importedClips.delete(selected.userData.editorId);scene.remove(selected);selected=null;refreshTree();syncInspector();renderKeyframes();scheduleAutosave()}
function duplicateSelected(){if(!selected)return;checkpoint();const c=selected.clone(true);ensureMeta(c);c.userData.editorId=id();c.name=selected.name+' Copy';c.position.x+=.6;scene.add(c);const src=keyframes.get(selected.userData.editorId);if(src)keyframes.set(c.userData.editorId,structuredClone(src));select(c);scheduleAutosave()}
$('deleteBtn').onclick=deleteSelected;$('duplicateBtn').onclick=duplicateSelected;

function snapshotTransform(o){return{p:o.position.toArray(),r:[o.rotation.x,o.rotation.y,o.rotation.z],s:o.scale.toArray()}}
function applyTransformData(o,t){o.position.fromArray(t.p);o.rotation.set(...t.r);o.scale.fromArray(t.s)}
function takeKey(at=currentTime){
 if(!selected)return;const eid=selected.userData.editorId,list=keyframes.get(eid)||[],k={t:+at.toFixed(3),...snapshotTransform(selected)};const i=list.findIndex(x=>Math.abs(x.t-k.t)<.025);if(i>=0)list[i]=k;else list.push(k);list.sort((a,b)=>a.t-b.t);keyframes.set(eid,list);renderKeyframes();scheduleAutosave();toast('Keyframe '+k.t.toFixed(2)+'s')
}
$('keyframeBtn').onclick=()=>{checkpoint();takeKey()};
function renderKeyframes(){const tr=$('keyframeTrack');tr.innerHTML='';if(!selected)return;(keyframes.get(selected.userData.editorId)||[]).forEach(k=>{const d=document.createElement('div');d.className='key-dot';d.style.left=(k.t/duration*100)+'%';d.title=k.t.toFixed(2)+'s';d.onclick=()=>{currentTime=k.t;applyAnimation(currentTime);updateTimelineUI()};tr.appendChild(d)})}
function applyAnimation(t){
 for(const o of editorObjects()){const list=keyframes.get(o.userData.editorId)||[];if(!list.length)continue;let a=list[0],b=list[list.length-1];if(t<=a.t)b=a;else if(t>=b.t)a=b;else for(let i=0;i<list.length-1;i++)if(t>=list[i].t&&t<=list[i+1].t){a=list[i];b=list[i+1];break}
  const f=a===b?0:THREE.MathUtils.clamp((t-a.t)/(b.t-a.t),0,1);o.position.fromArray(a.p).lerp(new THREE.Vector3().fromArray(b.p),f);o.scale.fromArray(a.s).lerp(new THREE.Vector3().fromArray(b.s),f);const qa=new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.r)),qb=new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.r));o.quaternion.copy(qa).slerp(qb,f)}
 syncInspector()
}
function animPreset(kind){
 if(!selected)return toast('Sélectionne un objet');checkpoint();const o=selected,eid=o.userData.editorId;keyframes.set(eid,[]);const base=snapshotTransform(o);
 const put=(t,p=base.p,r=base.r,s=base.s)=>{o.position.fromArray(p);o.rotation.set(...r);o.scale.fromArray(s);takeKey(t)};
 if(kind==='reset'){keyframes.delete(eid);renderKeyframes();scheduleAutosave();return}
 if(kind==='float'){put(0);put(2,[base.p[0],base.p[1]+1,base.p[2]]);put(4);duration=Math.max(duration,4)}
 if(kind==='bounce'){put(0);put(.5,[base.p[0],base.p[1]+1.5,base.p[2]]);put(1);put(1.5,[base.p[0],base.p[1]+.75,base.p[2]]);put(2);duration=Math.max(duration,2)}
 if(kind==='spin'){put(0);put(2,base.p,[base.r[0],base.r[1]+Math.PI,base.r[2]]);put(4,base.p,[base.r[0],base.r[1]+Math.PI*2,base.r[2]]);duration=Math.max(duration,4)}
 if(kind==='pulse'){put(0);put(1,base.p,base.r,base.s.map(v=>v*1.25));put(2);duration=Math.max(duration,2)}
 if(kind==='orbit'){const x=base.p[0],z=base.p[2],r=2;put(0,[x+r,base.p[1],z]);put(1,[x,base.p[1],z+r]);put(2,[x-r,base.p[1],z]);put(3,[x,base.p[1],z-r]);put(4,[x+r,base.p[1],z]);duration=Math.max(duration,4)}
 applyTransformData(o,base);$('durationInput').value=duration;$('timeRange').max=duration;renderKeyframes();scheduleAutosave();toast('Animation '+kind+' ajoutée')
}
document.querySelectorAll('[data-anim]').forEach(b=>b.onclick=()=>animPreset(b.dataset.anim));

const range=$('timeRange');range.oninput=()=>{currentTime=+range.value;applyAnimation(currentTime);updateTimelineUI(false)};
function updateTimelineUI(setRange=true){if(setRange)range.value=currentTime;$('timeLabel').textContent=currentTime.toFixed(2)+'s'}
$('durationInput').onchange=e=>{duration=Math.max(1,+e.target.value||10);range.max=duration;renderKeyframes();scheduleAutosave()};
$('playBtn').onclick=()=>togglePlay();
$('stopBtn').onclick=()=>{playing=false;currentTime=0;$('playBtn').textContent='▶';applyAnimation(0);updateTimelineUI()};
function togglePlay(){playing=!playing;playStart=performance.now()-currentTime*1000;$('playBtn').textContent=playing?'❚❚':'▶'}

async function openDb(){return await new Promise((resolve,reject)=>{const r=indexedDB.open('BlenderFiedAssets',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putAsset(blob,name,existingId=null){const db=await openDb(),assetId=existingId||id(),tx=db.transaction('assets','readwrite');tx.objectStore('assets').put({blob,name,at:Date.now()},assetId);await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=()=>j(tx.error)});return assetId}
async function getAsset(assetId){const db=await openDb(),tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').get(assetId);return await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)})}

const modelInput=$('modelInput'),drop=$('dropzone');drop.onclick=()=>modelInput.click();modelInput.onchange=()=>modelInput.files[0]&&importModel(modelInput.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>e.dataTransfer.files[0]&&importModel(e.dataTransfer.files[0]));
async function importModel(file,opts={}){
 if(!opts.noHistory)checkpoint();const ext=(opts.name||file.name||'model.glb').split('.').pop().toLowerCase(),url=URL.createObjectURL(file);
 try{
  let o,clips=[];if(ext==='glb'||ext==='gltf'){const g=await new GLTFLoader().loadAsync(url);o=g.scene;clips=g.animations||[]}else if(ext==='fbx')o=await new FBXLoader().loadAsync(url);else if(ext==='obj')o=await new OBJLoader().loadAsync(url);else throw Error('Format non pris en charge');
  const assetId=opts.assetId||await putAsset(file,opts.name||file.name);ensureMeta(o);o.name=(opts.name||file.name||'Modèle').replace(/\.[^.]+$/,'');o.userData.importAsset={id:assetId,name:opts.name||file.name};markShadows(o);scene.add(o);if(opts.transform)applyTransformData(o,opts.transform);if(clips.length)importedClips.set(o.userData.editorId,clips);if(opts.editorId)o.userData.editorId=opts.editorId;if(opts.keys)keyframes.set(o.userData.editorId,opts.keys);select(o);refreshTree();if(!opts.transform)focusSelected();scheduleAutosave();toast('Import '+(opts.name||file.name)+' réussi');return o
 }catch(e){console.error(e);toast('Import impossible : '+e.message)}finally{URL.revokeObjectURL(url)}
}

$('imageInput').onchange=()=>{pendingImageFile=$('imageInput').files[0]||null;if(pendingImageFile)toast('Image prête : '+pendingImageFile.name)};
$('reliefDepth').oninput=()=>$('reliefDepthValue').textContent=(+$('reliefDepth').value).toFixed(2);
async function textureAndBitmap(blob){const bitmap=await createImageBitmap(blob);const tex=new THREE.Texture(bitmap);tex.needsUpdate=true;tex.colorSpace=THREE.SRGBColorSpace;return{bitmap,tex}}
async function createFromImage(mode,opts={}){
 const file=opts.file||pendingImageFile;if(!file)return toast('Choisis une image');if(!opts.noHistory)checkpoint();
 try{
  const assetId=opts.assetId||await putAsset(file,opts.name||file.name),depth=opts.depth??+$('reliefDepth').value,{bitmap,tex}=await textureAndBitmap(file),aspect=bitmap.width/bitmap.height;
  let geo;
  if(mode==='plane')geo=new THREE.PlaneGeometry(3*aspect,3);
  else{
   const max=56,w=Math.max(4,Math.round(max*Math.min(1,aspect))),h=Math.max(4,Math.round(max*Math.min(1,1/aspect))),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,w,h);const pix=ctx.getImageData(0,0,w,h).data;geo=new THREE.PlaneGeometry(3*aspect,3,w-1,h-1);const p=geo.attributes.position;
   for(let i=0;i<p.count;i++){const ix=i%w,iy=Math.floor(i/w),q=(iy*w+ix)*4,lum=(pix[q]*.2126+pix[q+1]*.7152+pix[q+2]*.0722)/255;p.setZ(i,(lum-.5)*depth)}p.needsUpdate=true;geo.computeVertexNormals()
  }
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.72,metalness:.02,side:THREE.DoubleSide}),o=ensureMeta(new THREE.Mesh(geo,mat));o.name=nameFor(mode==='plane'?'Image 2D':'Relief 3D');o.position.y=1.6;o.userData.generatedImage={id:assetId,name:opts.name||file.name,mode,depth};markShadows(o);scene.add(o);if(opts.transform)applyTransformData(o,opts.transform);if(opts.editorId)o.userData.editorId=opts.editorId;if(opts.keys)keyframes.set(o.userData.editorId,opts.keys);select(o);focusSelected();scheduleAutosave();toast(mode==='plane'?'Image ajoutée':'Relief 3D créé');return o
 }catch(e){console.error(e);toast('Conversion image impossible')}
}
$('imagePlaneBtn').onclick=()=>createFromImage('plane');$('reliefBtn').onclick=()=>createFromImage('relief');

function worldData(){return{background:'#'+scene.background.getHexString(),fog:!!scene.fog,fogDensity:scene.fog?.density||+$('fogDensity').value,ground:ground.visible,groundColor:'#'+ground.material.color.getHexString(),ambient:hemi.intensity,sun:sun.intensity,grid:grid.visible}}
function transformData(o){return snapshotTransform(o)}
function serializeProject(){
 const tracks={};for(const [k,v] of keyframes)tracks[k]=v;
 const objects=editorObjects().map(o=>{
  const base={editorId:o.userData.editorId,name:o.name,transform:transformData(o),keys:tracks[o.userData.editorId]||[]};
  if(o.userData.importAsset)return{...base,kind:'import',asset:o.userData.importAsset};
  if(o.userData.generatedImage)return{...base,kind:'image',asset:o.userData.generatedImage};
  return{...base,kind:'json',json:o.toJSON()}
 });
 return{version:2,duration,currentTime,world:worldData(),objects,settings}
}
async function restoreProject(data,{silent=false}={}){
 historyApplying=true;clearEditable();duration=data.duration||10;$('durationInput').value=duration;range.max=duration;currentTime=Math.min(data.currentTime||0,duration);
 if(data.world){scene.background.set(data.world.background||'#101019');ground.visible=data.world.ground!==false;ground.material.color.set(data.world.groundColor||'#292834');hemi.intensity=data.world.ambient??1.8;sun.intensity=data.world.sun??2.5;grid.visible=data.world.grid!==false;scene.fog=data.world.fog?new THREE.FogExp2(scene.background.getHex(),data.world.fogDensity||.015):null}
 syncWorldUI();
 for(const d of data.objects||[]){
  if(d.kind==='import'){const a=await getAsset(d.asset.id);if(a?.blob)await importModel(a.blob,{name:d.asset.name,assetId:d.asset.id,transform:d.transform,editorId:d.editorId,keys:d.keys,noHistory:true})}
  else if(d.kind==='image'){const a=await getAsset(d.asset.id);if(a?.blob)await createFromImage(d.asset.mode,{file:a.blob,name:d.asset.name,assetId:d.asset.id,depth:d.asset.depth,transform:d.transform,editorId:d.editorId,keys:d.keys,noHistory:true})}
  else if(d.kind==='json'){try{const o=new THREE.ObjectLoader().parse(d.json);ensureMeta(o);o.userData.editorId=d.editorId||o.userData.editorId;o.name=d.name||o.name;applyTransformData(o,d.transform);scene.add(o);if(d.keys?.length)keyframes.set(o.userData.editorId,d.keys)}catch(e){console.warn('restore object',e)}}
 }
 selected=null;transform.detach();refreshTree();syncInspector();renderKeyframes();updateTimelineUI();focusScene();historyApplying=false;if(data.settings){settings={...settings,...data.settings};applySettings()}if(!silent)toast('Projet restauré')
}
function scheduleAutosave(){
 if(historyApplying)return;clearTimeout(saveTimer);$('autosaveState').textContent='Sauvegarde…';$('saveDot').style.background='#ffca64';
 saveTimer=setTimeout(()=>{try{localStorage.setItem('blenderfied-autosave-v2',JSON.stringify(serializeProject()));$('autosaveState').textContent='Sauvegardé '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});$('saveDot').style.background='#5dd28b'}catch(e){$('autosaveState').textContent='Autosave saturé';$('saveDot').style.background='#ff6b82';console.warn(e)}},550)
}
function checkpoint(){if(historyApplying)return;try{undoStack.push(JSON.stringify(serializeProject()));if(undoStack.length>20)undoStack.shift();redoStack.length=0}catch{}}
async function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify(serializeProject()));const s=undoStack.pop();await restoreProject(JSON.parse(s),{silent:true});scheduleAutosave();toast('Annulé')}
async function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify(serializeProject()));const s=redoStack.pop();await restoreProject(JSON.parse(s),{silent:true});scheduleAutosave();toast('Rétabli')}
$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;

function syncWorldUI(){$('worldColor').value='#'+scene.background.getHexString();$('fogToggle').checked=!!scene.fog;$('fogDensity').value=scene.fog?.density||.015;$('groundToggle').checked=ground.visible;$('groundColor').value='#'+ground.material.color.getHexString();$('ambientPower').value=hemi.intensity;$('sunPower').value=sun.intensity;$('toggleGrid').classList.toggle('active',grid.visible)}
$('worldColor').oninput=e=>{scene.background.set(e.target.value);if(scene.fog)scene.fog.color.copy(scene.background);scheduleAutosave()};
$('fogToggle').onchange=e=>{scene.fog=e.target.checked?new THREE.FogExp2(scene.background.getHex(),+$('fogDensity').value):null;scheduleAutosave()};
$('fogDensity').oninput=e=>{if(scene.fog)scene.fog.density=+e.target.value;scheduleAutosave()};
$('groundToggle').onchange=e=>{ground.visible=e.target.checked;scheduleAutosave()};
$('groundColor').oninput=e=>{ground.material.color.set(e.target.value);scheduleAutosave()};
$('ambientPower').oninput=e=>{hemi.intensity=+e.target.value;scheduleAutosave()};
$('sunPower').oninput=e=>{sun.intensity=+e.target.value;scheduleAutosave()};

function buildExportClips(){
 const tracks=[];
 for(const o of editorObjects()){const ks=keyframes.get(o.userData.editorId)||[];if(ks.length<2)continue;const times=ks.map(k=>k.t),pos=ks.flatMap(k=>k.p),scale=ks.flatMap(k=>k.s),quat=[];ks.forEach(k=>quat.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...k.r)).toArray()));tracks.push(new THREE.VectorKeyframeTrack(o.name+'.position',times,pos),new THREE.QuaternionKeyframeTrack(o.name+'.quaternion',times,quat),new THREE.VectorKeyframeTrack(o.name+'.scale',times,scale))}
 const clips=[];if(tracks.length)clips.push(new THREE.AnimationClip('BlenderFied_Timeline',duration,tracks));for(const list of importedClips.values())clips.push(...list);return clips
}
$('exportGlb').onclick=()=>{
 const exportScene=new THREE.Scene();editorObjects().forEach(o=>exportScene.add(o.clone(true)));const clips=buildExportClips();
 new GLTFExporter().parse(exportScene,res=>{const blob=res instanceof ArrayBuffer?new Blob([res],{type:'model/gltf-binary'}):new Blob([JSON.stringify(res)],{type:'model/gltf+json'});download(blob,'BlenderFied_Scene.glb')},e=>toast('Export impossible'),{binary:true,onlyVisible:true,animations:clips})
};
$('saveProject').onclick=()=>download(new Blob([JSON.stringify(serializeProject(),null,2)],{type:'application/json'}),'BlenderFied_Project.json');
$('openProject').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{checkpoint();await restoreProject(JSON.parse(await f.text()));scheduleAutosave()}catch(err){console.error(err);toast('Projet invalide')}};
$('newProject').onclick=()=>{if(confirm('Créer une nouvelle scène ?')){checkpoint();applyScenePreset('studio',true)}};
$('shotBtn').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>b&&download(b,'BlenderFied_Capture.png'),'image/png')};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

const scripts={
 forest:`# Mini forêt
scene empty
lighting day
tree -3 0 -2
tree 0 0 -4
tree 3 0 -1
rock -1 0 1
rock 2 0 2`,
 city:`# Rue rapide
scene empty
lighting day
road 0 0 0
building -4 0 -2
building 4 0 -2
building -4 0 3
building 4 0 3
lamp -2 0 0
lamp 2 0 0`,
 product:`scene studio
lighting studio
cube 0 1 0
scale 2 2 2
color #9b7cff`,
 animation:`cube 0 1 0
color #ff6fae
anim bounce`
};
$('scriptPreset').onchange=e=>{if(e.target.value)$('scriptBox').value=scripts[e.target.value]};
$('runScript').onclick=()=>runScript($('scriptBox').value);
async function runScript(src){
 checkpoint();const lines=src.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 try{
  for(const line of lines){const p=line.match(/"[^"]*"|'[^']*'|\S+/g)||[],cmd=(p.shift()||'').toLowerCase(),n=p.map(x=>isNaN(Number(x))?x.replace(/^["']|["']$/g,''):Number(x));
   if(['cube','sphere','cylinder','plane'].includes(cmd))addPrimitive(cmd,[+(n[0]||0),+(n[1]??.5),+(n[2]||0)],{noHistory:true});
   else if(['tree','rock','building','house','road','lamp','stairs','wall'].includes(cmd))addPrefab(cmd,[+(n[0]||0),+(n[1]||0),+(n[2]||0)],{noHistory:true});
   else if(cmd==='light')addPrimitive('light',[+(n[0]||0),+(n[1]||3),+(n[2]||0)],{noHistory:true});
   else if(cmd==='select'){const q=String(n.join(' ')).toLowerCase(),o=editorObjects().find(o=>o.name.toLowerCase().includes(q));if(o)select(o)}
   else if(cmd==='move'&&selected){selected.position.set(+n[0],+n[1],+n[2])}
   else if(cmd==='rotate'&&selected){selected.rotation.set(THREE.MathUtils.degToRad(+n[0]),THREE.MathUtils.degToRad(+n[1]),THREE.MathUtils.degToRad(+n[2]))}
   else if(cmd==='scale'&&selected){selected.scale.set(+n[0],+n[1],+n[2])}
   else if(cmd==='color'&&selected){const m=getMaterial(selected);if(m)m.color.set(String(n[0]))}
   else if(cmd==='duplicate')duplicateSelected();
   else if(cmd==='key'){currentTime=+n[0]||0;takeKey(currentTime)}
   else if(cmd==='anim')animPreset(String(n[0]));
   else if(cmd==='scene')applyScenePreset(String(n[0]),true);
   else if(cmd==='lighting')setLighting(String(n[0]),true)
  }
  refreshTree();syncInspector();scheduleAutosave();toast('Script exécuté')
 }catch(e){console.error(e);toast('Erreur script : '+e.message)}
}

document.querySelectorAll('.side-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.side-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.side-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('side-'+b.dataset.panel).classList.add('active')});
document.querySelectorAll('.inspector-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.inspector-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.inspector-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('inspect-'+b.dataset.inspector).classList.add('active')});

function loadSettings(){try{return{keys:{...DEFAULT_KEYS,...JSON.parse(localStorage.getItem('blenderfied-keys')||'{}')},highContrast:localStorage.getItem('bf-high')==='1',reduceMotion:localStorage.getItem('bf-motion')==='1',uiScale:+localStorage.getItem('bf-scale')||1}}catch{return{keys:{...DEFAULT_KEYS},highContrast:false,reduceMotion:false,uiScale:1}}}
function saveSettings(){localStorage.setItem('blenderfied-keys',JSON.stringify(settings.keys));localStorage.setItem('bf-high',settings.highContrast?'1':'0');localStorage.setItem('bf-motion',settings.reduceMotion?'1':'0');localStorage.setItem('bf-scale',settings.uiScale);scheduleAutosave()}
function applySettings(){document.body.classList.toggle('high-contrast',!!settings.highContrast);document.body.classList.toggle('reduce-motion',!!settings.reduceMotion);document.documentElement.style.setProperty('--ui',settings.uiScale||1);$('highContrast').checked=!!settings.highContrast;$('reduceMotion').checked=!!settings.reduceMotion;$('uiScale').value=settings.uiScale||1;renderKeymap();updateShortcutHint()}
function renderKeymap(){const names={translate:'Déplacer',rotate:'Rotation',scale:'Échelle',focus:'Cadrer',duplicate:'Dupliquer',delete:'Supprimer',play:'Lecture/Pause',keyframe:'Keyframe',save:'Télécharger projet'};$('keymapEditor').innerHTML=Object.entries(names).map(([k,v])=>'<label class="keyrow"><span>'+v+'</span><input readonly data-keybind="'+k+'" value="'+esc(settings.keys[k])+'"></label>').join('');document.querySelectorAll('[data-keybind]').forEach(inp=>inp.onkeydown=e=>{e.preventDefault();e.stopPropagation();const combo=eventCombo(e);settings.keys[inp.dataset.keybind]=combo;inp.value=combo;saveSettings();updateShortcutHint()})}
function updateShortcutHint(){$('shortcutHint').textContent=settings.keys.translate.toUpperCase()+' déplacer · '+settings.keys.rotate.toUpperCase()+' rotation · '+settings.keys.scale.toUpperCase()+' échelle · '+settings.keys.delete+' supprimer · '+settings.keys.duplicate.toUpperCase()+' dupliquer · '+settings.keys.focus.toUpperCase()+' cadrer · '+settings.keys.keyframe.toUpperCase()+' keyframe'}
function eventCombo(e){let key=e.key.toLowerCase();if(key===' ')key='space';if(key==='control'||key==='shift'||key==='alt'||key==='meta')return key;const parts=[];if(e.ctrlKey)parts.push('ctrl');if(e.altKey)parts.push('alt');if(e.shiftKey&&key.length>1)parts.push('shift');parts.push(key);return parts.join('+')}
$('highContrast').onchange=e=>{settings.highContrast=e.target.checked;saveSettings();applySettings()};$('reduceMotion').onchange=e=>{settings.reduceMotion=e.target.checked;saveSettings();applySettings()};$('uiScale').oninput=e=>{settings.uiScale=+e.target.value;saveSettings();applySettings()};$('resetKeys').onclick=()=>{settings.keys={...DEFAULT_KEYS};saveSettings();applySettings();toast('Raccourcis réinitialisés')};

addEventListener('keydown',e=>{
 if(document.activeElement?.matches('textarea,input:not([readonly])'))return;
 const combo=eventCombo(e),k=settings.keys;
 if(combo===k.save){e.preventDefault();$('saveProject').click();return}
 if(combo===k.translate)setMode('translate');
 else if(combo===k.rotate)setMode('rotate');
 else if(combo===k.scale)setMode('scale');
 else if(combo===k.focus)focusSelected();
 else if(combo===k.duplicate)duplicateSelected();
 else if(combo===k.delete)deleteSelected();
 else if(combo===k.play){e.preventDefault();togglePlay()}
 else if(combo===k.keyframe){checkpoint();takeKey()}
 if(e.key==='Escape')transform.detach()
});

async function restoreAutosave(){
 applySettings();syncWorldUI();
 const raw=localStorage.getItem('blenderfied-autosave-v2');
 if(raw){try{await restoreProject(JSON.parse(raw),{silent:true});$('autosaveState').textContent='Autosave restauré';return}catch(e){console.warn(e)}}
 applyScenePreset('studio',true);scheduleAutosave()
}
restoreAutosave();