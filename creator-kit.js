import * as THREE from 'https://esm.sh/three@0.180.0';
import {GLTFLoader} from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const host=document.getElementById('creatorViewer');
if(!host) throw new Error('Creator viewer not found');
const shell=document.getElementById('creatorDrop'),input=document.getElementById('creatorSkinInput'),status=document.getElementById('creatorAnimStatus');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,.01,1000);camera.position.set(0,1.3,4);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.6;controls.maxDistance=10;controls.target.set(0,1,0);
scene.add(new THREE.HemisphereLight(0xe8e2ff,0x291e3e,2.25));
const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(3,5,4);key.castShadow=true;scene.add(key);
const rim=new THREE.DirectionalLight(0xb267ff,2.2);rim.position.set(-4,2,-3);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.8,64),new THREE.MeshStandardMaterial({color:0x17131f,roughness:.82,metalness:.12,transparent:true,opacity:.82}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
let model=null,mixer=null,clips=[],action=null,nextTimer=0,procedural=false,modeIndex=0,lastMode=0,bones={},baseBones=new Map();
const procModes=['Idle','Présentation','Salutation','Danse légère','Look around'];

function resize(){const w=host.clientWidth||400,h=host.clientHeight||350;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}new ResizeObserver(resize).observe(host);resize();
const clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;controls.update();if(mixer)mixer.update(dt);if(procedural)animateProcedural(t);renderer.render(scene,camera)}frame();

function clearModel(){if(model){scene.remove(model);model.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];a.forEach(m=>m.dispose?.())}})}model=null;mixer=null;clips=[];action=null;procedural=false;baseBones.clear();bones={};shell.classList.remove('has-model')}
function fitModel(){if(!model)return;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;model.position.sub(center);model.position.y+=size.y/2;const dist=max/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*0.66;camera.position.set(max*.28,size.y*.52,dist);controls.target.set(0,size.y*.48,0);controls.minDistance=max*.45;controls.maxDistance=max*5;controls.update()}
function collectBones(){bones={};model?.traverse(o=>{if(o.isBone){bones[o.name]=o;baseBones.set(o.uuid,o.quaternion.clone())}})}
function resetBones(){Object.values(bones).forEach(b=>{const q=baseBones.get(b.uuid);if(q)b.quaternion.copy(q)})}
function applyBone(name,euler){const b=bones[name];if(!b)return;const base=baseBones.get(b.uuid);if(!base)return;b.quaternion.copy(base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)))}
function animateProcedural(t){const mode=procModes[modeIndex%procModes.length];resetBones();const s=Math.sin(t*2.1),slow=Math.sin(t*.85);
 applyBone('mixamorigSpine',[.025*s,0,.025*slow]);applyBone('mixamorigHead',[.03*Math.sin(t*1.2),.09*Math.sin(t*.55),0]);
 if(mode==='Présentation'){applyBone('mixamorigLeftArm',[0,0,-.65]);applyBone('mixamorigLeftForeArm',[0,0,-.55]);applyBone('mixamorigRightArm',[0,0,.18])}
 else if(mode==='Salutation'){applyBone('mixamorigRightArm',[0,0,.9]);applyBone('mixamorigRightForeArm',[0,0,1.15+.18*s]);applyBone('mixamorigRightHand',[0,.32*s,0])}
 else if(mode==='Danse légère'){applyBone('mixamorigLeftArm',[.12*s,0,-.72-.2*s]);applyBone('mixamorigRightArm',[-.12*s,0,.72+.2*s]);applyBone('mixamorigLeftUpLeg',[.08*s,0,0]);applyBone('mixamorigRightUpLeg',[-.08*s,0,0]);model.rotation.y=.12*Math.sin(t*.9)}
 else if(mode==='Look around'){applyBone('mixamorigHead',[.02,Math.sin(t*.8)*.42,0]);applyBone('mixamorigSpine2',[0,Math.sin(t*.8)*.12,0])}
 else{applyBone('mixamorigLeftArm',[0,0,-.08+.025*s]);applyBone('mixamorigRightArm',[0,0,.08-.025*s])}
 if(t-lastMode>5.5){lastMode=t;modeIndex=(modeIndex+1)%procModes.length;status.textContent='Procédural · '+procModes[modeIndex]}}
function playRandomClip(force=false){if(!clips.length)return;clearTimeout(nextTimer);let pool=clips.filter(c=>!action||c!==action.getClip());let clip=pool[Math.floor(Math.random()*pool.length)]||clips[0];if(action)action.fadeOut(.35);action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.35).play();status.textContent='Animation · '+(clip.name||'Sans nom');const d=Math.max(1.5,clip.duration);nextTimer=setTimeout(()=>playRandomClip(),(d+.75)*1000)}
async function loadBlob(blob,name='skin.glb',persist=true){clearModel();status.textContent='Chargement du skin…';try{const ab=await blob.arrayBuffer();const gltf=await new Promise((ok,no)=>new GLTFLoader().parse(ab,'',ok,no));model=gltf.scene;clips=gltf.animations||[];model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(model);shell.classList.add('has-model');fitModel();collectBones();if(clips.length){mixer=new THREE.AnimationMixer(model);mixer.addEventListener('finished',()=>playRandomClip());playRandomClip()}else{procedural=true;lastMode=clock.elapsedTime;status.textContent='Rig détecté · animations procédurales';}if(persist)await saveSkin(blob,name);document.getElementById('creatorEmpty').hidden=true}catch(e){console.error(e);status.textContent='Skin incompatible ou fichier GLTF externe manquant'}}
async function openDb(){return await new Promise((resolve,reject)=>{const r=indexedDB.open('rlxCreatorKit',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveSkin(blob,name){try{const db=await openDb(),tx=db.transaction('assets','readwrite');tx.objectStore('assets').put({blob,name,at:Date.now()},'creator-skin');await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=()=>j(tx.error)})}catch(e){console.warn('Skin persistence unavailable',e)}}
async function restore(){try{const db=await openDb(),tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').get('creator-skin');const x=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});if(x?.blob)await loadBlob(x.blob,x.name,false)}catch{}}
input.onchange=()=>input.files?.[0]&&loadBlob(input.files[0],input.files[0].name,true);
['dragenter','dragover'].forEach(ev=>shell.addEventListener(ev,e=>{e.preventDefault();shell.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>shell.addEventListener(ev,e=>{e.preventDefault();shell.classList.remove('drag')}));
shell.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(f&&/gltf|glb/i.test(f.name))loadBlob(f,f.name,true)});
document.getElementById('creatorNextAnim').onclick=()=>{if(clips.length)playRandomClip(true);else{modeIndex=(modeIndex+1)%procModes.length;lastMode=clock.elapsedTime;status.textContent='Procédural · '+procModes[modeIndex]}};
document.getElementById('creatorResetView').onclick=fitModel;
restore();