import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { installCampusMaterials, installGrass } from './environment.js';
import { installCampusActors } from './actors.js';
import {
  ArrowUpRight, BadgeInfo, Building2, Focus, Landmark, LocateFixed,
  Maximize, PanelLeft, Rotate3d, Tags, X, createIcons,
} from 'lucide';
import './style.css';

echarts.use([PieChart, CanvasRenderer]);
const iconSet = { ArrowUpRight, BadgeInfo, Building2, Focus, Landmark, LocateFixed, Maximize, PanelLeft, Rotate3d, Tags, X };
createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.7 } });

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loadingState');
const loadingHint = document.querySelector('#loadingHint');
const app = document.querySelector('#application');
const buildingList = document.querySelector('#buildingList');
const toast = document.querySelector('#toast');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#030b1b');
scene.fog = new THREE.Fog('#030b1b', 250, 520);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1600);
camera.position.set(130, 116, 176);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 35;
controls.maxDistance = 850;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 8, 1);

scene.add(new THREE.HemisphereLight(0x8ab8f7, 0x070d1b, 1.45));
const keyLight = new THREE.DirectionalLight(0xd1e2ff, 2.35);
keyLight.position.set(-160, 210, -170);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -220;
keyLight.shadow.camera.right = 220;
keyLight.shadow.camera.top = 220;
keyLight.shadow.camera.bottom = -220;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x279aff, 1.8);
rimLight.position.set(150, 115, 145);
scene.add(rimLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
outline.edgeStrength = 5.0;
outline.edgeGlow = 0.35;
outline.edgeThickness = 2.4;
outline.visibleEdgeColor.set('#7df4ff');
outline.hiddenEdgeColor.set('#24869b');
composer.addPass(outline);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.46, 0.78));
composer.addPass(new OutputPass());

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const roots = new Map();
const buildingData = new Map();
const labels = new Map();
let selectedId = null;
let modelGroup = null;
let chart = null;
let loadToken = 0;
let toastTimer = 0;
let isDragging = false;
let labelsVisible = true;
let autoRotate = false;
let transition = null;
let environmentReady = false;
let environmentUpdate = () => {};
let actorUpdate = () => {};
let animationTime = 0;
const downPoint = new THREE.Vector2();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

function makeLabel(item) {
  const element = document.createElement('button');
  element.className = 'building-label';
  element.dataset.buildingId = item.id;
  element.type = 'button';
  element.innerHTML = `<span class="label-pin"></span><span class="label-text"><b>${item.name}</b><small>${item.index} / TEACHING</small></span>`;
  element.addEventListener('click', () => selectBuilding(item.id, true));
  app.append(element);
  labels.set(item.id, element);
}

function setSelected(id) {
  selectedId = id;
  document.querySelectorAll('.building-row').forEach((row) => row.classList.toggle('selected', row.dataset.buildingId === id));
  labels.forEach((label, labelId) => label.classList.toggle('selected', labelId === id));
  const info = buildingData.get(id);
  if (!info) return;
  document.querySelector('#buildingIndex').textContent = info.index;
  document.querySelector('#buildingName').textContent = info.name;
  document.querySelector('#buildingType').textContent = `${info.category} · 外观模型`;
  document.querySelector('#floorCount').textContent = info.floors;
  document.querySelector('#dimensions').textContent = `${info.dimensions[0]} × ${info.dimensions[1]} m`;
  document.querySelector('.source-note').textContent = info.summary || '建筑资料待现场核对。';
  outline.selectedObjects = [];
  roots.get(id)?.traverse((object) => { if (object.isMesh) outline.selectedObjects.push(object); });
  if (chart) {
    const demo = [42, 35, 48][Number(info.index) - 1];
    chart.setOption({ series: [{ data: [{ value: demo, itemStyle: { color: '#51d8e6' } }, { value: 100 - demo, itemStyle: { color: 'rgba(132,177,184,.14)' } }] }] });
    document.querySelector('.chart-center strong').innerHTML = `${demo}<small>%</small>`;
  }
}

function fitCamera() {
  if (!modelGroup) return;
  const box = new THREE.Box3().setFromObject(modelGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const distance = Math.max(size.x / (2 * verticalTangent * camera.aspect), size.y / (2 * verticalTangent), size.z / (2 * verticalTangent)) * 1.18;
  const direction = new THREE.Vector3(1.15, 1.0, 1.55).normalize();
  animateCamera(center.clone().addScaledVector(direction, distance), center.clone().add(new THREE.Vector3(0, 3, 0)), 900);
}

function animateCamera(position, target, duration = 700) {
  transition = {
    start: performance.now(), duration,
    fromPosition: camera.position.clone(), toPosition: position,
    fromTarget: controls.target.clone(), toTarget: target,
  };
}

function selectBuilding(id, focus = false) {
  const root = roots.get(id);
  if (!root) return;
  setSelected(id);
  document.querySelector('#detailPanel').classList.remove('mobile-hidden');
  if (focus) {
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const distance = Math.max(size.x / (2 * verticalTangent * camera.aspect), size.y / (2 * verticalTangent), size.z / (2 * verticalTangent)) * 1.4;
    const direction = new THREE.Vector3(1.15, 1.0, 1.8).normalize();
    animateCamera(center.clone().addScaledVector(direction, distance), center.clone().add(new THREE.Vector3(0, size.y * 0.25, 0)));
  }
  document.querySelector('#buildingPanel').classList.remove('mobile-open');
  document.querySelector('#mobileScrim').classList.remove('visible');
}

function renderList(items) {
  buildingList.innerHTML = '';
  document.querySelector('#teachingCount').textContent = `${String(items.length).padStart(2, '0')} NODES`;
  items.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'building-row';
    button.dataset.buildingId = item.id;
    button.type = 'button';
    button.innerHTML = `<span class="row-index">${item.index}</span><span class="row-copy"><strong>${item.name}</strong><small>${item.category} <i></i> ${item.floors} 层估算</small></span><span class="row-arrow"><i data-lucide="arrow-up-right"></i></span>`;
    button.addEventListener('click', () => selectBuilding(item.id, true));
    buildingList.append(button);
  });
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.7 } });
}

function resolveBuilding(object) {
  let current = object;
  while (current && current !== modelGroup) {
    const id = current.userData?.buildingId || current.userData?.extras?.buildingId;
    if (id && roots.has(id)) return id;
    current = current.parent;
  }
  return null;
}

function attachModel(gltf, items) {
  const nextGroup = gltf.scene;
  nextGroup.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material.side = THREE.FrontSide;
    const id = resolveInTree(object, items);
    if (id) object.userData.buildingId = id;
  });
  modelGroup = nextGroup;
  scene.add(modelGroup);
  roots.clear();
  modelGroup.traverse((object) => {
    const id = object.userData?.buildingId || object.userData?.extras?.buildingId;
    if (id && !object.isMesh && items.some((item) => item.id === id)) roots.set(id, object);
  });
  items.forEach((item) => {
    const node = roots.get(item.id);
    if (node) {
      const world = node.getWorldPosition(new THREE.Vector3());
      item.position = [world.x, world.y, world.z];
      makeLabel(item);
    }
  });
  if (roots.size !== items.length) {
    loadingHint.textContent = `模型楼栋识别异常（${roots.size}/${items.length}），请重新加载。`;
    document.querySelector('#retryLoad').hidden = false;
    return false;
  }
  fitCamera();
  return true;
}

function resolveInTree(object, items) {
  let current = object;
  while (current) {
    const extras = current.userData?.extras || current.userData || {};
    const id = extras.buildingId;
    if (id && items.some((item) => item.id === id)) return id;
    current = current.parent;
  }
  return null;
}

async function loadScene() {
  const token = ++loadToken;
  document.querySelector('#retryLoad').hidden = true;
  loading.classList.remove('failed');
  loadingHint.textContent = '连接本地三维模型…';
  loading.classList.remove('hidden');
  try {
    const [dataResponse] = await Promise.all([fetch(`${import.meta.env.BASE_URL}data/buildings.json`)]);
    if (!dataResponse.ok) throw new Error('建筑信息读取失败');
    const data = await dataResponse.json();
    if (token !== loadToken) return;
    data.buildings.forEach((item) => buildingData.set(item.id, item));
    renderList(data.buildings);
    document.querySelector('#campusBuildingCount').textContent = data.campusOverview?.totalBuildingMasses ?? data.buildings.length;
    document.querySelector('#buildingPanel .panel-foot > span:nth-child(2)').textContent = '校园整体示意 · 待测绘校核';
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/university-campus-demo.glb`);
    if (token !== loadToken) return;
    if (!attachModel(gltf, data.buildings)) throw new Error('GLB 楼栋节点与数据编号不匹配');
    installCampusMaterials(THREE, modelGroup, renderer);
    if (!environmentReady) {
      const environment = installGrass(THREE, scene, renderer, () => showToast('草地纹理载入失败，继续显示场地底色'));
      environmentUpdate = environment.update;
      const actors = installCampusActors(THREE, scene);
      actorUpdate = actors.update;
      environmentReady = true;
    }
    createChart();
    setSelected(data.buildings[0].id);
    window.setTimeout(() => loading.classList.add('hidden'), 450);
  } catch (error) {
    console.error(error);
    if (token !== loadToken) return;
    loading.classList.add('failed');
    loadingHint.textContent = error.message || '检查本地模型文件后重试。';
    document.querySelector('#retryLoad').hidden = false;
  }
}

function createChart() {
  chart = echarts.init(document.querySelector('#coverageChart'), null, { renderer: 'canvas' });
  chart.setOption({
    animationDuration: 500,
    series: [{
      type: 'pie', radius: ['72%', '88%'], center: ['50%', '50%'],
      startAngle: 90, silent: true, label: { show: false },
      data: [
        { value: 42, itemStyle: { color: '#51d8e6', borderRadius: 3 } },
        { value: 58, itemStyle: { color: 'rgba(132,177,184,.14)' } },
      ],
    }],
  });
}

function resize() {
  const width = app.clientWidth;
  const height = app.clientHeight;
  camera.fov = width < 760 ? 42 : 34;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  outline.setSize(width, height);
  chart?.resize();
}

function updateLabels() {
  const rect = canvas.getBoundingClientRect();
  labels.forEach((element, id) => {
    if (!labelsVisible) { element.hidden = true; return; }
    const root = roots.get(id);
    if (!root) return;
    const box = new THREE.Box3().setFromObject(root);
    const point = box.getCenter(new THREE.Vector3());
    point.y = box.max.y + 1.2;
    point.project(camera);
    const visible = point.z < 1 && point.x > -1.1 && point.x < 1.1 && point.y > -1.1 && point.y < 1.1;
    element.hidden = !visible;
    if (visible) {
      element.style.left = `${rect.left + (point.x * 0.5 + 0.5) * rect.width}px`;
      element.style.top = `${rect.top + (-point.y * 0.5 + 0.5) * rect.height}px`;
    }
  });
  document.querySelectorAll('.landmark-label').forEach((element) => {
    if (!labelsVisible) { element.hidden = true; return; }
    const [x, y, z] = element.dataset.position.split(',').map(Number);
    const point = new THREE.Vector3(x, y, -z).project(camera);
    const visible = point.z < 1 && point.x > -1.1 && point.x < 1.1 && point.y > -1.1 && point.y < 1.1;
    element.hidden = !visible;
    if (visible) {
      element.style.left = `${rect.left + (point.x * 0.5 + 0.5) * rect.width}px`;
      element.style.top = `${rect.top + (-point.y * 0.5 + 0.5) * rect.height}px`;
    }
  });
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  downPoint.set(event.clientX, event.clientY);
  isDragging = false;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 6) isDragging = true;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(modelGroup?.children || [], true);
  const id = hits.map((hit) => resolveBuilding(hit.object)).find(Boolean);
  if (id) selectBuilding(id, false);
});
renderer.domElement.addEventListener('pointercancel', () => { isDragging = false; });

document.querySelector('#overviewButton').addEventListener('click', () => { fitCamera(); showToast('已回到校园总览'); });
document.querySelector('#locateBuilding').addEventListener('click', () => selectBuilding(selectedId, true));
document.querySelector('#autoRotateButton').addEventListener('click', (event) => {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 0.55;
  event.currentTarget.classList.toggle('is-on', autoRotate);
});
document.querySelector('#labelsButton').addEventListener('click', (event) => {
  labelsVisible = !labelsVisible;
  event.currentTarget.classList.toggle('is-on', labelsVisible);
  updateLabels();
});
document.querySelector('#fullscreenButton').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await app.requestFullscreen();
  } catch { showToast('当前浏览器无法切换全屏'); }
});
document.querySelector('#retryLoad').addEventListener('click', () => loadScene());
document.querySelector('#menuToggle').addEventListener('click', () => {
  document.querySelector('#buildingPanel').classList.add('mobile-open');
  document.querySelector('#mobileScrim').classList.add('visible');
});
document.querySelector('#mobileScrim').addEventListener('click', () => {
  document.querySelector('#buildingPanel').classList.remove('mobile-open');
  document.querySelector('#mobileScrim').classList.remove('visible');
});
document.querySelector('#closeDetail').addEventListener('click', () => document.querySelector('#detailPanel').classList.add('mobile-hidden'));
window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', resize);

const clock = new THREE.Clock();
function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(clock.getDelta(), 0.05);
  animationTime += delta;
  controls.update(delta);
  if (transition) {
    const t = Math.min((now - transition.start) / transition.duration, 1);
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    if (t >= 1) transition = null;
  }
  const viewDistance = camera.position.distanceTo(controls.target);
  scene.fog.near = Math.max(140, viewDistance * 0.78);
  scene.fog.far = Math.max(440, viewDistance * 1.95);
  environmentUpdate(animationTime);
  actorUpdate(delta, animationTime);
  composer.render();
  updateLabels();
}

resize();
loadScene();
requestAnimationFrame(frame);
