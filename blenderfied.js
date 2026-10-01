import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const viewport=document.getElementById('viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x11111a);
const camera=new THREE.PerspectiveCamera(50,1,.1,2000); camera.position.set(6,4.5,7);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace; viewport.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement); orbit.enableDamping=true; orbit.target.set(0,1,0);
const transform=new TransformControls(camera,renderer.domElement); transform.setSize(.85); scene.add(transform.getHelper()); transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value); transform.addEventListener('objectChange',()=>{syncInspector();renderKeyframes()});

const hemi=new THREE.HemisphereLight(0xc9d4ff,0x282035,1.8); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.5); sun.position.set(5,8,4); sun.castShadow=true; sun.name='Sun'; scene.add(sun);
const grid=new THREE.GridHelper(30,30,0x6c5a9e,0x2a2938); scene.add(grid);

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
let selected=null, snap=false, playing=false, playStart=0, currentTime=0, duration=10;
const keyframes=new Map();

function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)} addEventListener('resize',resize); resize();
function animate(now){requestAnimationFrame(animate);orbit.update();if(playing){currentTime=(now-playStart)/1000;if(currentTime>duration){currentTime=0;playStart=now}applyAnimation(currentTime);updateTimelineUI()}renderer.render(scene,camera)}requestAnimationFrame(animate);

function basicMat(color){return new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.05})}
function nameFor(type){const base={cube:'Cube',sphere:'Sphère',cylinder:'Cylindre',plane:'Plan',light:'Lumière',camera:'Caméra'}[type]||'Objet';let n=1,label=base;while(scene.getObjectByName(label))label=base+'.'+String(n++).padStart(3,'0');return label}
function addPrimitive(type){
 let o;
 if(type==='cube')o=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),basicMat(0x8e72ff));
 if(type==='sphere')o=new THREE.Mesh(new THREE.SphereGeometry(.7,40,24),basicMat(0x69b7ff));
 if(type==='cylinder')o=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.4,32),basicMat(0xff8db0));
 if(type==='plane'){o=new THREE.Mesh(new THREE.PlaneGeometry(3,3),basicMat(0x626271));o.rotation.x=-Math.PI/2}
 if(type==='light'){o=new THREE.PointLight(0xffffff,6,20);o.add(new THREE.Mesh(new THREE.SphereGeometry(.12,16,10),new THREE.MeshBasicMaterial({color:0xffe7a0})));o.position.set(2,3,2)}
 if(type==='camera'){o=new THREE.PerspectiveCamera(45,16/9,.1,1000);const helper=new THREE.CameraHelper(o);helper.userData.helperFor=o.uuid;scene.add(helper);o.position.set(3,2,3)}
 if(!o)return;o.name=nameFor(type);o.userData.editable=true;if(o.isMesh){o.castShadow=true;o.receiveShadow=true}scene.add(o);select(o);refreshTree();toast(o.name+' ajouté');
}
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addPrimitive(b.dataset.add));

function selectableRoot(o){while(o&&o.parent&&o.parent!==scene){if(o.parent.userData?.editable)o=o.parent;else break}return o?.userData?.editable?o:null}
renderer.domElement.addEventListener('pointerdown',e=>{if(transform.dragging)return;const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(scene.children,true).filter(h=>!h.object.isGridHelper&&!h.object.isCameraHelper);const o=hits.map(h=>selectableRoot(h.object)).find(Boolean);if(o)select(o)});

function select(o){selected=o;transform.detach();if(o&&!o.isLight&&!o.isCamera)transform.attach(o);refreshTree();syncInspector();renderKeyframes()}
function refreshTree(){const el=document.getElementById('sceneTree');const items=scene.children.filter(o=>o.userData?.editable);el.innerHTML='';items.forEach(o=>{const d=document.createElement('div');d.className='scene-item'+(selected===o?' active':'');d.innerHTML='<span class="type">'+(o.isLight?'✦':o.isCamera?'◉':'◆')+'</span><span>'+escapeHtml(o.name)+'</span>';d.onclick=()=>select(o);el.appendChild(d)})}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

const ids=['objName','px','py','pz','rx','ry','rz','sx','sy','sz','matColor','metalness','roughness','lightIntensity'];const ui=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
function syncInspector(){const box=document.getElementById('inspector'),empty=document.getElementById('emptyInspector');if(!selected){box.hidden=true;empty.hidden=false;return}box.hidden=false;empty.hidden=true;ui.objName.value=selected.name;['x','y','z'].forEach((a,i)=>ui['p'+a].value=selected.position[a].toFixed(3));['x','y','z'].forEach(a=>ui['r'+a].value=THREE.MathUtils.radToDeg(selected.rotation[a]).toFixed(2));['x','y','z'].forEach(a=>ui['s'+a].value=selected.scale[a].toFixed(3));const mat=getMaterial(selected);document.getElementById('materialPanel').hidden=!mat;if(mat){ui.matColor.value='#'+mat.color.getHexString();ui.metalness.value=mat.metalness??0;ui.roughness.value=mat.roughness??.5}document.getElementById('lightPanel').hidden=!selected.isLight;if(selected.isLight)ui.lightIntensity.value=selected.intensity}
function getMaterial(o){if(o.isMesh&&o.material?.color)return o.material;let m=null;o.traverse?.(c=>{if(!m&&c.isMesh&&c.material?.color)m=c.material});return m}

['px','py','pz'].forEach(id=>ui[id].onchange=()=>{if(!selected)return;selected.position[id[1]]=+ui[id].value});
['rx','ry','rz'].forEach(id=>ui[id].onchange=()=>{if(!selected)return;selected.rotation[id[1]]=THREE.MathUtils.degToRad(+ui[id].value)});
['sx','sy','sz'].forEach(id=>ui[id].onchange=()=>{if(!selected)return;selected.scale[id[1]]=Math.max(.001,+ui[id].value)});
ui.objName.onchange=()=>{if(selected){selected.name=ui.objName.value.trim()||'Objet';refreshTree()}};
ui.matColor.oninput=()=>{const m=getMaterial(selected);if(m)m.color.set(ui.matColor.value)};
ui.metalness.oninput=()=>{const m=getMaterial(selected);if(m&&'metalness'in m)m.metalness=+ui.metalness.value};
ui.roughness.oninput=()=>{const m=getMaterial(selected);if(m&&'roughness'in m)m.roughness=+ui.roughness.value};
ui.lightIntensity.oninput=()=>{if(selected?.isLight)selected.intensity=+ui.lightIntensity.value};

function setMode(mode){transform.setMode(mode);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.getElementById('toggleGrid').onclick=e=>{grid.visible=!grid.visible;e.currentTarget.classList.toggle('active',grid.visible)};
document.getElementById('toggleSnap').onclick=e=>{snap=!snap;transform.setTranslationSnap(snap?.5:null);transform.setRotationSnap(snap?THREE.MathUtils.degToRad(15):null);transform.setScaleSnap(snap?.1:null);e.currentTarget.classList.toggle('active',snap)};
document.getElementById('focusBtn').onclick=focusSelected;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function setView(v){const t=selected?selected.position:new THREE.Vector3();const d=7;if(v==='front')camera.position.set(t.x,t.y,t.z+d);if(v==='side')camera.position.set(t.x+d,t.y,t.z);if(v==='top')camera.position.set(t.x,t.y+d,t.z+.001);orbit.target.copy(t);orbit.update()}
function focusSelected(){if(!selected)return;const box=new THREE.Box3().setFromObject(selected);const c=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3()).length()||1;orbit.target.copy(c);camera.position.copy(c.clone().add(new THREE.Vector3(s,s*.7,s)));orbit.update()}

function deleteSelected(){if(!selected)return;transform.detach();keyframes.delete(selected.uuid);scene.remove(selected);selected=null;refreshTree();syncInspector();renderKeyframes()}
function duplicateSelected(){if(!selected)return;const c=selected.clone(true);c.name=selected.name+' Copy';c.position.x+=.5;c.userData.editable=true;scene.add(c);select(c);refreshTree()}
document.getElementById('deleteBtn').onclick=deleteSelected;document.getElementById('duplicateBtn').onclick=duplicateSelected;

function takeKey(){if(!selected)return;const list=keyframes.get(selected.uuid)||[];const k={t:+currentTime.toFixed(3),p:selected.position.toArray(),r:[selected.rotation.x,selected.rotation.y,selected.rotation.z],s:selected.scale.toArray()};const i=list.findIndex(x=>Math.abs(x.t-k.t)<.03);if(i>=0)list[i]=k;else list.push(k);list.sort((a,b)=>a.t-b.t);keyframes.set(selected.uuid,list);renderKeyframes();toast('Keyframe à '+k.t.toFixed(2)+'s')}
document.getElementById('keyframeBtn').onclick=takeKey;
function renderKeyframes(){const tr=document.getElementById('keyframeTrack');tr.innerHTML='';if(!selected)return;(keyframes.get(selected.uuid)||[]).forEach(k=>{const d=document.createElement('div');d.className='key-dot';d.style.left=(k.t/duration*100)+'%';d.title=k.t.toFixed(2)+' s';d.onclick=()=>{currentTime=k.t;applyAnimation(currentTime);updateTimelineUI()};tr.appendChild(d)})}
function applyAnimation(t){scene.children.filter(o=>o.userData?.editable).forEach(o=>{const list=keyframes.get(o.uuid)||[];if(!list.length)return;let a=list[0],b=list[list.length-1];for(let i=0;i<list.length-1;i++)if(t>=list[i].t&&t<=list[i+1].t){a=list[i];b=list[i+1];break}const f=a===b?0:THREE.MathUtils.clamp((t-a.t)/(b.t-a.t),0,1);o.position.fromArray(a.p).lerp(new THREE.Vector3().fromArray(b.p),f);o.scale.fromArray(a.s).lerp(new THREE.Vector3().fromArray(b.s),f);const qa=new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.r)),qb=new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.r));o.quaternion.copy(qa).slerp(qb,f)});syncInspector()}
const range=document.getElementById('timeRange');range.oninput=()=>{currentTime=+range.value;applyAnimation(currentTime);updateTimelineUI(false)};
function updateTimelineUI(setRange=true){if(setRange)range.value=currentTime;document.getElementById('timeLabel').textContent=currentTime.toFixed(2)+'s'}
document.getElementById('durationInput').onchange=e=>{duration=Math.max(1,+e.target.value||10);range.max=duration;renderKeyframes()};
document.getElementById('playBtn').onclick=()=>{playing=!playing;playStart=performance.now()-currentTime*1000;document.getElementById('playBtn').textContent=playing?'❚❚':'▶'};
document.getElementById('stopBtn').onclick=()=>{playing=false;currentTime=0;document.getElementById('playBtn').textContent='▶';applyAnimation(0);updateTimelineUI()};

const input=document.getElementById('modelInput'),drop=document.getElementById('dropzone');drop.onclick=()=>input.click();input.onchange=()=>input.files[0]&&loadModel(input.files[0]);['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>e.dataTransfer.files[0]&&loadModel(e.dataTransfer.files[0]));
async function loadModel(file){const ext=file.name.split('.').pop().toLowerCase(),url=URL.createObjectURL(file);try{let o;if(ext==='glb'||ext==='gltf'){const g=await new GLTFLoader().loadAsync(url);o=g.scene}else if(ext==='fbx')o=await new FBXLoader().loadAsync(url);else if(ext==='obj')o=await new OBJLoader().loadAsync(url);else throw Error('Format non pris en charge');o.name=file.name.replace(/\.[^.]+$/,'');o.userData.editable=true;o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true}});scene.add(o);select(o);refreshTree();toast('Import réussi : '+file.name)}catch(e){console.error(e);toast('Import impossible')}finally{URL.revokeObjectURL(url)}}

document.getElementById('exportGlb').onclick=()=>{const exportScene=new THREE.Scene();scene.children.filter(o=>o.userData?.editable).forEach(o=>exportScene.add(o.clone(true)));new GLTFExporter().parse(exportScene,res=>{const blob=res instanceof ArrayBuffer?new Blob([res],{type:'model/gltf-binary'}):new Blob([JSON.stringify(res)],{type:'model/gltf+json'});download(blob,'blenderfied-scene.glb')},e=>toast('Export impossible'),{binary:true,onlyVisible:true})};
document.getElementById('saveProject').onclick=()=>{const data={version:1,duration,objects:scene.children.filter(o=>o.userData?.editable).map(o=>({uuid:o.uuid,name:o.name,type:o.userData.sourceType||inferType(o),position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],scale:o.scale.toArray(),color:getMaterial(o)?'#'+getMaterial(o).color.getHexString():null,intensity:o.isLight?o.intensity:null,keyframes:keyframes.get(o.uuid)||[]}))};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'blenderfied-project.json')};
document.getElementById('openProject').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());clearEditable();duration=data.duration||10;document.getElementById('durationInput').value=duration;range.max=duration;for(const d of data.objects||[]){addPrimitive(d.type||'cube');const o=selected;o.name=d.name;o.position.fromArray(d.position);o.rotation.set(...d.rotation);o.scale.fromArray(d.scale);const m=getMaterial(o);if(m&&d.color)m.color.set(d.color);if(o.isLight&&d.intensity!=null)o.intensity=d.intensity;if(d.keyframes?.length)keyframes.set(o.uuid,d.keyframes)}refreshTree();toast('Projet chargé')}catch{toast('Projet invalide')}};
document.getElementById('newProject').onclick=()=>{if(confirm('Créer une nouvelle scène ?')){clearEditable();keyframes.clear();selected=null;syncInspector();refreshTree()}};
function inferType(o){if(o.isLight)return'light';if(o.isCamera)return'camera';const n=o.geometry?.type||'';if(n.includes('Sphere'))return'sphere';if(n.includes('Cylinder'))return'cylinder';if(n.includes('Plane'))return'plane';return'cube'}
function clearEditable(){[...scene.children].filter(o=>o.userData?.editable).forEach(o=>scene.remove(o));transform.detach()}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}

addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.key.toLowerCase()==='g')setMode('translate');if(e.key.toLowerCase()==='r')setMode('rotate');if(e.key.toLowerCase()==='s')setMode('scale');if(e.key.toLowerCase()==='f')focusSelected();if(e.key==='Delete')deleteSelected();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected()}if(e.key==='Escape')transform.detach()});
addPrimitive('cube');selected.position.y=.5;syncInspector();