import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Film,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Send,
  X,
} from 'lucide-react';
import { askCareerMentor } from '../api/client';
import { CareerVideoJourney } from './CareerVideoJourney';
import { VoiceMentorPanel } from './VoiceMentorPanel';
import type {
  CareerDefinition,
  CareerMission,
  MentorMessage,
  MissionEvaluationResult,
  RoadmapStage,
  StudentProfile,
} from '../types';

interface CareerWorld3DProps {
  career: CareerDefinition;
  profile?: StudentProfile | null;
  roadmap: RoadmapStage[];
  completedMissionIds: string[];
  watchedVideoSessionIds?: string[];
  completed3DActivityIds?: string[];
  missionResults: Record<string, MissionEvaluationResult>;
  skills: Record<string, number>;
  mentorHistory: MentorMessage[];
  initialFocusBuildingId?: string | null;
  onUpdateMentorHistory: (messages: MentorMessage[]) => void;
  onMarkSessionWatched?: (watchId: string) => void;
  onComplete3DActivity?: (activityId: string) => void;
  onLaunchMission: (mission: CareerMission, stage: RoadmapStage) => void;
  onExitToRoadmap: () => void;
}

const BUILDING_TO_VIDEO_KEY: Record<string, string> = {
  'building-mentor': 'career-overview',
  'building-admissions': 'after-12th',
  'building-foundations': 'college-years',
  'building-innovation': 'skills-internships',
  'building-placement': 'daily-job',
  'building-workplace': 'future-scope',
};

interface BuildingMeta {
  id: string;
  label: string;
  stageNumber: number | null;
  position: [number, number, number];
  cameraOffset: [number, number, number];
  lookOffset: [number, number, number];
  description: string;
}

const BUILDINGS: BuildingMeta[] = [
  {
    id: 'building-mentor',
    label: 'AI Career Mentor Observatory',
    stageNumber: null,
    position: [0, 0, 0],
    cameraOffset: [11, 8, 13],
    lookOffset: [0, 2.2, 0],
    description: 'Central campus hub. Speak with your AI Career Mentor for personalized advice across any stage or skill gap.',
  },
  {
    id: 'building-admissions',
    label: 'Admissions & Exam Pavilion',
    stageNumber: 1,
    position: [-15, 0, 12],
    cameraOffset: [-6, 8, 24],
    lookOffset: [-15, 2, 12],
    description: 'Stage 01 · 12th Standard eligibility checks, entrance exam prep, college selection, and counselling strategy.',
  },
  {
    id: 'building-foundations',
    label: 'Foundations Academic Hall',
    stageNumber: 2,
    position: [15, 0, 12],
    cameraOffset: [25, 8, 24],
    lookOffset: [15, 2.2, 12],
    description: 'Stage 02 · First Year interactive learning studios and foundational academic practicals.',
  },
  {
    id: 'building-innovation',
    label: 'Innovation & Internship Lab',
    stageNumber: 3,
    position: [17, 0, -12],
    cameraOffset: [27, 9, -2],
    lookOffset: [17, 2.5, -12],
    description: 'Stage 03 · Second & Third Year project capstones and realistic internship simulations.',
  },
  {
    id: 'building-placement',
    label: 'Placement & Interview Center',
    stageNumber: 4,
    position: [-17, 0, -12],
    cameraOffset: [-27, 9, -2],
    lookOffset: [-17, 2.8, -12],
    description: 'Stage 04 · Final Year placement prep, live interview simulation, and job offer decision gate.',
  },
  {
    id: 'building-workplace',
    label: 'Executive Industry Tower',
    stageNumber: 5,
    position: [0, 0, -23],
    cameraOffset: [12, 13, -10],
    lookOffset: [0, 4.5, -23],
    description: 'Stage 05 · Workplace responsibilities, domain specializations, and advanced leadership missions.',
  },
];

// Pre-allocated math helpers outside render loop (zero GC)
const _camGoalPos = new THREE.Vector3(24, 18, 28);
const _camGoalLook = new THREE.Vector3(0, 1.5, -2);
const _rayMouse = new THREE.Vector2();

function createSignTexture(title: string, subtitle: string, _accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2D2B55';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#F4A62A';
  ctx.fillRect(0, 0, 14, 160);
  ctx.fillStyle = '#F0D9B5';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(title.slice(0, 26), 34, 68);
  ctx.fillStyle = '#D6C7DF';
  ctx.font = '20px sans-serif';
  ctx.fillText(subtitle.slice(0, 36), 34, 114);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGroundGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1A1A1F';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(166, 120, 185, 0.2)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createStoneNoiseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const shade = 165 + ((i * 29) % 70);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createBrickTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#efefef';
  const rows = 8;
  const cols = 4;
  const h = 256 / rows;
  const w = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : w / 2;
    for (let c = -1; c <= cols; c++) {
      ctx.fillRect(c * w + offset + 3, r * h + 3, w - 6, h - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.36)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.14)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const CareerWorld3D: React.FC<CareerWorld3DProps> = ({
  career,
  profile = null,
  roadmap,
  completedMissionIds,
  watchedVideoSessionIds = [],
  completed3DActivityIds = [],
  missionResults,
  skills,
  mentorHistory,
  initialFocusBuildingId,
  onUpdateMentorHistory,
  onMarkSessionWatched,
  onComplete3DActivity,
  onLaunchMission,
  onExitToRoadmap,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    initialFocusBuildingId || 'building-admissions'
  );
  const [drawerMode, setDrawerMode] = useState<'none' | 'building' | 'mentor'>(
    initialFocusBuildingId ? 'building' : 'none'
  );
  const [showPavilionVideo, setShowPavilionVideo] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Mentor chat state
  const [mentorInput, setMentorInput] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);

  // Refs synced for Three.js animation loop without tearing down WebGL
  const roadmapRef = useRef(roadmap);
  const completedRef = useRef(completedMissionIds);
  const selectedIdRef = useRef(selectedBuildingId);
  const cameraFlyingRef = useRef(false);
  const onBuildingClickRef = useRef<(id: string) => void>(() => {});

  roadmapRef.current = roadmap;
  completedRef.current = completedMissionIds;
  selectedIdRef.current = selectedBuildingId;

  const flyToPreset = (pos: [number, number, number], look: [number, number, number]) => {
    _camGoalPos.set(pos[0], pos[1], pos[2]);
    _camGoalLook.set(look[0], look[1], look[2]);
    cameraFlyingRef.current = true;
  };

  const focusBuilding = (buildingId: string, openDrawer = true) => {
    const meta = BUILDINGS.find((b) => b.id === buildingId);
    if (!meta) return;
    setSelectedBuildingId(buildingId);
    setShowPavilionVideo(false);
    if (openDrawer) {
      setDrawerMode(buildingId === 'building-mentor' ? 'mentor' : 'building');
      onComplete3DActivity?.(`${career.id}:${buildingId}`);
    }
    flyToPreset(meta.cameraOffset, meta.lookOffset);
  };

  onBuildingClickRef.current = (id: string) => {
    focusBuilding(id, true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setDockCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection (only used for rendering cost)
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1f);
    scene.fog = new THREE.FogExp2(0x1a1a1f, 0.0072);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 260);
    camera.position.set(24, 18, 28);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // 2. Mandatory RoomEnvironment reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3. Twilight Observatory Architectural 3-Point Rig (Cream Hemisphere + Golden Key + Violet Rim)
    const hemiLight = new THREE.HemisphereLight(0xf0d9b5, 0x2d2b55, 0.9);
    hemiLight.position.set(0, 45, 0);
    scene.add(hemiLight);

    const keySun = new THREE.DirectionalLight(0xfef3dc, 1.85);
    keySun.position.set(28, 42, 24);
    keySun.castShadow = !isSoftwareGl;
    keySun.shadow.mapSize.width = 2048;
    keySun.shadow.mapSize.height = 2048;
    keySun.shadow.camera.near = 5;
    keySun.shadow.camera.far = 110;
    keySun.shadow.camera.left = -38;
    keySun.shadow.camera.right = 38;
    keySun.shadow.camera.top = 38;
    keySun.shadow.camera.bottom = -38;
    keySun.shadow.bias = -0.0005;
    keySun.shadow.normalBias = 0.02;
    scene.add(keySun);

    const rimLight = new THREE.DirectionalLight(0xa678b9, 0.95);
    rimLight.position.set(-25, 18, -32);
    scene.add(rimLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 68;
    controls.target.set(0, 1.5, -2);
    controls.addEventListener('start', () => {
      cameraFlyingRef.current = false;
    });

    // Materials library (varied roughness >= 0.25 and metalness)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const gridTex = createGroundGridTexture();
    gridTex.anisotropy = maxAniso;
    const stoneBumpTex = createStoneNoiseTexture();
    const brickBumpTex = createBrickTexture();
    const contactShadowTex = createContactShadowTexture();

    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    const stonePlinthMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      bumpMap: stoneBumpTex,
      bumpScale: 0.04,
      roughnessMap: stoneBumpTex,
      roughness: 0.82,
      metalness: 0.04,
    });
    const warmBrickMat = new THREE.MeshStandardMaterial({
      color: 0xc2856c,
      bumpMap: brickBumpTex,
      bumpScale: 0.06,
      roughness: 0.85,
      metalness: 0.02,
    });
    const slateWallMat = new THREE.MeshStandardMaterial({
      color: 0x2d2b55,
      roughness: 0.52,
      metalness: 0.22,
    });
    const brushedMetalMat = new THREE.MeshStandardMaterial({
      color: 0xf0d9b5,
      roughness: 0.25,
      metalness: 0.85,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xa678b9,
      roughness: 0.08,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: true,
      opacity: isSoftwareGl ? 0.42 : 0.92,
      ior: 1.5,
      thickness: 0.4,
      depthWrite: false,
    });
    const accentColor = new THREE.Color('#F4A62A');
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.45,
    });
    const walkwayMat = new THREE.MeshStandardMaterial({
      color: 0x2d2b55,
      roughness: 0.58,
      metalness: 0.25,
    });

    // 4. Extended Natural Terrain (never boxed void)
    const terrainGeo = new THREE.PlaneGeometry(240, 240, 36, 36);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const dist = Math.hypot(x, z);
      if (dist > 38) {
        const hill =
          Math.sin(x * 0.06) * Math.cos(z * 0.06) * 2.8 +
          Math.min(9, (dist - 38) * 0.09);
        posAttr.setY(i, hill - 0.15);
      } else {
        posAttr.setY(i, -0.04);
      }
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x222042,
      roughness: 0.88,
      metalness: 0.08,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Central Campus Paved Ground Disc (offset +0.04 so zero Z-fighting)
    const plazaGeo = new THREE.CylinderGeometry(32, 32.5, 0.16, 64);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.82,
      metalness: 0.05,
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.y = 0.04;
    plaza.receiveShadow = true;
    scene.add(plaza);

    // Reflecting Pond beside Mentor Plaza
    const pondBorder = new THREE.Mesh(
      new THREE.RingGeometry(4.8, 5.4, 48),
      stonePlinthMat
    );
    pondBorder.rotation.x = -Math.PI / 2;
    pondBorder.position.set(7.5, 0.14, 1.5);
    scene.add(pondBorder);

    const pondWater = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 48),
      new THREE.MeshPhysicalMaterial({
        color: 0x6a5acd,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
      })
    );
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.position.set(7.5, 0.13, 1.5);
    scene.add(pondWater);

    // Walkways + sculptural TubeGeometry solar archways connecting central observatory to pavilions
    BUILDINGS.filter((b) => b.id !== 'building-mentor').forEach((b) => {
      const len = Math.hypot(b.position[0], b.position[2]);
      const angle = Math.atan2(b.position[0], b.position[2]);
      const pathMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, len), walkwayMat);
      pathMesh.position.set(b.position[0] / 2, 0.14, b.position[2] / 2);
      pathMesh.rotation.y = angle;
      pathMesh.receiveShadow = true;
      scene.add(pathMesh);

      const dirX = b.position[0] / len;
      const dirZ = b.position[2] / len;
      const perpX = -dirZ;
      const perpZ = dirX;
      const midDist = len * 0.52;
      const cx = dirX * midDist;
      const cz = dirZ * midDist;
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx - perpX * 1.45, 0.16, cz - perpZ * 1.45),
        new THREE.Vector3(cx - perpX * 1.05, 2.35, cz - perpZ * 1.05),
        new THREE.Vector3(cx, 3.05, cz),
        new THREE.Vector3(cx + perpX * 1.05, 2.35, cz + perpZ * 1.05),
        new THREE.Vector3(cx + perpX * 1.45, 0.16, cz + perpZ * 1.45),
      ]);
      const archMesh = new THREE.Mesh(
        new THREE.TubeGeometry(archCurve, 28, 0.09, 10, false),
        brushedMetalMat
      );
      archMesh.castShadow = !isSoftwareGl;
      scene.add(archMesh);
    });

    // InstancedMesh Outer Tree Grove (per-instance scale & color tint variation)
    const treeCount = 68;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 7);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
    const canopyGeo = new THREE.IcosahedronGeometry(1.55, 1);
    canopyGeo.translate(0, 3.1, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    trunks.castShadow = !isSoftwareGl;
    canopies.castShadow = !isSoftwareGl;

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.18;
      const radius = 35 + (i % 5) * 4.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const sc = 0.85 + ((i * 37) % 30) / 100;
      dummy.position.set(x, 0, z);
      dummy.scale.set(sc, sc * (0.95 + (i % 4) * 0.08), sc);
      dummy.rotation.y = i * 1.1;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      canopies.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0.36 + (i % 5) * 0.015, 0.34, 0.42 + (i % 4) * 0.04);
      canopies.setColorAt(i, tint);
    }
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    scene.add(trunks, canopies);

    // 5. Composite 3–12 Part Procedural Buildings + Interactive Raycast Proxies
    const clickableProxies: THREE.Mesh[] = [];
    const beaconMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const buildingGroups = new Map<string, THREE.Group>();

    const addShadowAndPivot = (group: THREE.Group, id: string, meta: BuildingMeta) => {
      group.position.set(meta.position[0], 0.12, meta.position[2]);
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = !isSoftwareGl;
          child.receiveShadow = true;
        }
      });
      scene.add(group);
      buildingGroups.set(id, group);

      // Soft radial contact shadow plane beneath building
      const shadowSize = id === 'building-workplace' ? 12 : 10.5;
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(shadowSize, shadowSize),
        contactShadowMat
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(meta.position[0], 0.13, meta.position[2]);
      scene.add(contactShadow);

      // Invisible simplified raycast proxy box on layer 1
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(8, id === 'building-workplace' ? 14 : 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.position.set(meta.position[0], id === 'building-workplace' ? 7 : 4, meta.position[2]);
      proxy.userData.buildingId = id;
      proxy.layers.set(1);
      scene.add(proxy);
      clickableProxies.push(proxy);
    };

    // --- Building 0: AI Career Mentor Observatory (Central) ---
    {
      const meta = BUILDINGS[0];
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 32), stonePlinthMat);
      base.position.y = 0.3;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 1.8, 24), slateWallMat);
      drum.position.y = 1.5;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(3.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        glassMat
      );
      dome.position.y = 2.4;
      dome.renderOrder = 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.14, 12, 48), brushedMetalMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.4;

      // TubeGeometry meridian orbital ribs around observatory dome
      for (let m = 0; m < 2; m++) {
        const ribCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-3.35, 2.4, 0),
          new THREE.Vector3(-2.3, 4.7, 0),
          new THREE.Vector3(0, 5.75, 0),
          new THREE.Vector3(2.3, 4.7, 0),
          new THREE.Vector3(3.35, 2.4, 0),
        ]);
        const rib = new THREE.Mesh(
          new THREE.TubeGeometry(ribCurve, 32, 0.075, 8, false),
          brushedMetalMat
        );
        rib.rotation.y = (m * Math.PI) / 2;
        g.add(rib);
      }

      // LatheGeometry crown finial atop the glass dome
      const finialPoints = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.42, 0),
        new THREE.Vector2(0.32, 0.25),
        new THREE.Vector2(0.14, 0.55),
        new THREE.Vector2(0.24, 0.72),
        new THREE.Vector2(0.05, 1.35),
        new THREE.Vector2(0, 1.45),
      ];
      const crownFinial = new THREE.Mesh(new THREE.LatheGeometry(finialPoints, 24), brushedMetalMat);
      crownFinial.position.y = 5.45;

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xf4a62a,
        emissive: 0xf4a62a,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      });
      beaconMaterials.set(meta.id, beaconMat);
      const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.08, 10, 48), beaconMat);
      beaconRing.rotation.x = Math.PI / 2;
      beaconRing.position.y = 0.12;

      // Sign plate
      const signTex = createSignTexture('AI Career Mentor', 'Central Observatory', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.0, 0.14),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
      );
      sign.position.set(0, 1.6, 3.45);

      g.add(base, drum, dome, ring, crownFinial, beaconRing, sign);
      addShadowAndPivot(g, meta.id, meta);
    }

    // Floating Multi-Part AI Career Mentor Drone above Observatory + soft contact shadow
    const mentorDrone = new THREE.Group();
    const droneCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.65, 1),
      new THREE.MeshStandardMaterial({ color: 0xf0d9b5, roughness: 0.2, metalness: 0.7 })
    );
    const droneEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf4a62a, emissive: 0xf4a62a, emissiveIntensity: 1.25 })
    );
    droneEye.position.z = 0.52;
    const droneRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 32), brushedMetalMat);
    const droneRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.04, 8, 32), accentMat);
    droneRing2.rotation.x = Math.PI / 3;
    mentorDrone.add(droneCore, droneEye, droneRing1, droneRing2);
    mentorDrone.position.set(0, 7.6, 0);
    scene.add(mentorDrone);

    const droneShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), contactShadowMat);
    droneShadow.rotation.x = -Math.PI / 2;
    droneShadow.position.set(0, 0.16, 0);
    scene.add(droneShadow);

    // --- Building 1: Admissions & Exam Pavilion ---
    {
      const meta = BUILDINGS[1];
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 5.8), stonePlinthMat);
      plinth.position.y = 0.3;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.2, 4.4), warmBrickMat);
      hall.position.y = 2.2;
      for (let x = -2.2; x <= 2.2; x += 1.1) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 12), stonePlinthMat);
        col.position.set(x, 2.2, 2.55);
        g.add(col);
      }
      // Beveled ExtrudeGeometry pediment cornice
      const pedShape = new THREE.Shape();
      pedShape.moveTo(-3.3, 0);
      pedShape.lineTo(3.3, 0);
      pedShape.lineTo(0, 0.95);
      pedShape.closePath();
      const pedimentGeo = new THREE.ExtrudeGeometry(pedShape, {
        depth: 5.2,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.06,
        bevelSegments: 2,
      });
      pedimentGeo.translate(0, 0, -2.6);
      const roof = new THREE.Mesh(pedimentGeo, slateWallMat);
      roof.position.y = 3.85;

      const skylight = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 2.4), glassMat);
      skylight.position.y = 4.55;
      const signTex = createSignTexture('01. Admissions Pavilion', '12th & Entrance Prep', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.1, 0.15),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
      );
      sign.position.set(0, 4.75, 2.8);

      const bMat = new THREE.MeshStandardMaterial({ color: 0x059669, emissive: 0x059669, emissiveIntensity: 0.6 });
      beaconMaterials.set(meta.id, bMat);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.1, 10, 40), bMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = 0.12;

      g.add(plinth, hall, roof, skylight, sign, beacon);
      addShadowAndPivot(g, meta.id, meta);
    }

    // --- Building 2: Foundations Academic Hall ---
    {
      const meta = BUILDINGS[2];
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.5, 6.2), stonePlinthMat);
      plinth.position.y = 0.25;
      const wingA = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 3.2), slateWallMat);
      wingA.position.set(0, 2.4, -0.6);
      const wingB = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 2.6), warmBrickMat);
      wingB.position.set(-1.5, 2.0, 1.5);
      const glassBay = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 2.4), glassMat);
      glassBay.position.set(1.6, 1.9, 1.5);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.28, 3.5), brushedMetalMat);
      trim.position.set(0, 4.4, -0.6);
      const signTex = createSignTexture('02. Academic Hall', '1st Year Learning World', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.1, 0.15),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
      );
      sign.position.set(0, 4.9, 1.2);

      const bMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0.2 });
      beaconMaterials.set(meta.id, bMat);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.1, 10, 40), bMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = 0.12;

      g.add(plinth, wingA, wingB, glassBay, trim, sign, beacon);
      addShadowAndPivot(g, meta.id, meta);
    }

    // --- Building 3: Innovation & Internship Lab ---
    {
      const meta = BUILDINGS[3];
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.5, 6.4), stonePlinthMat);
      plinth.position.y = 0.25;
      const lowerLab = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.6, 4.6), slateWallMat);
      lowerLab.position.y = 1.8;
      const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.0, 3.6), accentMat);
      upperDeck.position.set(0.5, 4.1, -0.2);
      const workshopBay = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.2, 1.6), glassMat);
      workshopBay.position.set(0, 1.6, 2.5);
      // Solar Louvers
      for (let i = -2; i <= 2; i++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 3.0), brushedMetalMat);
        louver.position.set(i * 1.25 + 0.4, 5.3, -0.2);
        louver.rotation.x = 0.25;
        g.add(louver);
      }
      const signTex = createSignTexture('03. Innovation Lab', 'Projects & Internships', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.1, 0.15),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
      );
      sign.position.set(0, 4.2, 1.7);

      const bMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0.2 });
      beaconMaterials.set(meta.id, bMat);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.1, 10, 40), bMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = 0.12;

      g.add(plinth, lowerLab, upperDeck, workshopBay, sign, beacon);
      addShadowAndPivot(g, meta.id, meta);
    }

    // --- Building 4: Placement & Interview Center ---
    {
      const meta = BUILDINGS[4];
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.9, 0.6, 32), stonePlinthMat);
      plinth.position.y = 0.3;
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 3.0, 24), slateWallMat);
      tier1.position.y = 2.1;
      const glassTier = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 2.2, 24), glassMat);
      glassTier.position.y = 4.7;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.4, 24), brushedMetalMat);
      crown.position.y = 5.95;
      // LatheGeometry turned architectural spire
      const spirePts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.95, 0),
        new THREE.Vector2(0.55, 0.35),
        new THREE.Vector2(0.45, 0.85),
        new THREE.Vector2(0.18, 1.55),
        new THREE.Vector2(0.05, 2.35),
        new THREE.Vector2(0, 2.5),
      ];
      const spire = new THREE.Mesh(new THREE.LatheGeometry(spirePts, 24), accentMat);
      spire.position.y = 6.15;

      const signTex = createSignTexture('04. Placement Center', 'Interview & Job Gate', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.1, 0.15),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
      );
      sign.position.set(0, 2.8, 3.65);

      const bMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0.2 });
      beaconMaterials.set(meta.id, bMat);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(4.9, 0.1, 10, 40), bMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = 0.12;

      g.add(plinth, tier1, glassTier, crown, spire, sign, beacon);
      addShadowAndPivot(g, meta.id, meta);
    }

    // --- Building 5: Executive Industry Tower ---
    {
      const meta = BUILDINGS[5];
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.7, 6.8), stonePlinthMat);
      plinth.position.y = 0.35;
      const towerCore = new THREE.Mesh(new THREE.BoxGeometry(4.4, 9.2, 4.0), slateWallMat);
      towerCore.position.y = 5.3;
      const glassFacade = new THREE.Mesh(new THREE.BoxGeometry(4.7, 8.2, 3.2), glassMat);
      glassFacade.position.y = 5.2;
      const finLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10.2, 4.6), brushedMetalMat);
      finLeft.position.set(-2.5, 5.8, 0);
      const finRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10.2, 4.6), brushedMetalMat);
      finRight.position.set(2.5, 5.8, 0);
      const skyDeck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 5.0), accentMat);
      skyDeck.position.y = 10.0;

      const signTex = createSignTexture('05. Industry Tower', 'Workplace & Growth', career.accentColor);
      signTex.anisotropy = maxAniso;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 1.15, 0.16),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
      );
      sign.position.set(0, 3.0, 2.3);

      const bMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0.2 });
      beaconMaterials.set(meta.id, bMat);
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.11, 10, 44), bMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = 0.12;

      g.add(plinth, towerCore, glassFacade, finLeft, finRight, skyDeck, sign, beacon);
      addShadowAndPivot(g, meta.id, meta);
    }

    // Raycaster for hover + click on buildings
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateMouse = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 6) return; // drag orbit, not click
      updateMouse(e);
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const bId = hits[0].object.userData.buildingId as string;
        if (bId) onBuildingClickRef.current(bId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updateMouse(e);
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Pre-warm shaders on hardware WebGL
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateSceneState(delta: number, elapsed: number) {
      // Animate AI Mentor Drone + dynamically scale its grounded contact shadow
      const hoverOffset = Math.sin(elapsed * 1.8) * 0.35;
      mentorDrone.position.y = 7.6 + hoverOffset;
      mentorDrone.rotation.y = elapsed * 0.65;
      droneRing1.rotation.z = elapsed * 1.2;
      droneRing2.rotation.y = -elapsed * 1.0;
      const shadowScale = 1 - hoverOffset * 0.18;
      droneShadow.scale.set(shadowScale, shadowScale, 1);

      // Update building beacon colors based on live roadmap & completion state
      const currentRoadmap = roadmapRef.current;
      const completedSet = new Set(completedRef.current);
      const activeId = selectedIdRef.current;

      BUILDINGS.forEach((b) => {
        const mat = beaconMaterials.get(b.id);
        if (!mat) return;
        if (b.stageNumber === null) {
          mat.color.setHex(activeId === b.id ? 0xf4a62a : 0xa678b9);
          mat.emissive.setHex(activeId === b.id ? 0xf4a62a : 0x6a5acd);
          mat.emissiveIntensity = activeId === b.id ? 1.15 : 0.7;
          return;
        }
        const st = currentRoadmap.find((r) => r.stageNumber === b.stageNumber);
        const isDone = st && st.missions.every((m) => completedSet.has(m.id));
        if (isDone) {
          mat.color.setHex(0x059669);
          mat.emissive.setHex(0x059669);
          mat.emissiveIntensity = activeId === b.id ? 1.1 : 0.7;
        } else if (st?.unlocked) {
          mat.color.setHex(activeId === b.id ? 0xf4a62a : 0x6a5acd);
          mat.emissive.setHex(activeId === b.id ? 0xf4a62a : 0x6a5acd);
          mat.emissiveIntensity = activeId === b.id ? 1.15 : 0.75;
        } else {
          mat.color.setHex(0x4b4870);
          mat.emissive.setHex(0x2d2b55);
          mat.emissiveIntensity = 0.25;
        }
      });

      // Frame-rate independent exponential camera damping
      if (cameraFlyingRef.current) {
        const camAlpha = 1 - Math.exp(-4.8 * delta);
        const targetAlpha = 1 - Math.exp(-5.4 * delta);
        camera.position.lerp(_camGoalPos, camAlpha);
        controls.target.lerp(_camGoalLook, targetAlpha);

        if (
          camera.position.distanceTo(_camGoalPos) < 0.15 &&
          controls.target.distanceTo(_camGoalLook) < 0.15
        ) {
          cameraFlyingRef.current = false;
        }
      }

      controls.update();
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      updateSceneState(delta, elapsed);
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Initial focus if directed from Roadmap
    if (initialFocusBuildingId) {
      const targetMeta = BUILDINGS.find((b) => b.id === initialFocusBuildingId);
      if (targetMeta) {
        _camGoalPos.set(...targetMeta.cameraOffset);
        _camGoalLook.set(...targetMeta.lookOffset);
        cameraFlyingRef.current = true;
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      envTexture.dispose();
      gridTex.dispose();
      stoneBumpTex.dispose();
      brickBumpTex.dispose();
      contactShadowTex.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [career.accentColor, initialFocusBuildingId]);

  const activeBuildingMeta = BUILDINGS.find((b) => b.id === selectedBuildingId) || BUILDINGS[0];
  const buildingStages = roadmap.filter((s) => s.buildingId === activeBuildingMeta.id);
  const activeStage =
    buildingStages[0] ||
    (activeBuildingMeta.stageNumber
      ? roadmap.find((s) => s.stageNumber === activeBuildingMeta.stageNumber) || null
      : null);
  const pavilionVideoKey = BUILDING_TO_VIDEO_KEY[activeBuildingMeta.id] || 'after-12th';

  const handleSendMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = mentorInput.trim();
    if (!q || mentorLoading) return;
    setMentorInput('');

    const studentMsg: MentorMessage = {
      id: `mm_s_${Date.now()}`,
      role: 'student',
      content: q,
      buildingContext: activeBuildingMeta.label,
      timestamp: new Date().toISOString(),
    };
    const nextHist = [...mentorHistory, studentMsg];
    onUpdateMentorHistory(nextHist);
    setMentorLoading(true);

    try {
      const res = await askCareerMentor({
        careerId: career.id,
        buildingName: activeBuildingMeta.label,
        activeMissionTitle: activeStage?.missions[0]?.title,
        question: q,
        skills,
      });
      const mentorMsg: MentorMessage = {
        id: `mm_a_${Date.now() + 1}`,
        role: 'mentor',
        content: res.reply,
        buildingContext: activeBuildingMeta.label,
        timestamp: new Date().toISOString(),
      };
      onUpdateMentorHistory([...nextHist, mentorMsg]);
    } catch {
      onUpdateMentorHistory([
        ...nextHist,
        {
          id: `mm_err_${Date.now()}`,
          role: 'mentor',
          content: 'I could not reach the mentor service right now. Please try again in a moment.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setMentorLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] min-h-[600px] overflow-hidden bg-[#1A1A1F] select-none">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1A1A1F] text-[#F0D9B5] p-6 text-center">
          <div>
            <p className="text-lg font-display font-bold">3D Graphics Context Suspended</p>
            <p className="mt-1 text-sm text-[#D6C7DF]">
              Restoring WebGL canvas or switch back to Roadmap view.
            </p>
            <button
              type="button"
              onClick={onExitToRoadmap}
              className="mt-4 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F]"
            >
              Return to Roadmap
            </button>
          </div>
        </div>
      )}

      {/* Top-Left Minimal Spec Strip (Solid rgba, zero backdrop-filter over WebGL) */}
      <div
        className="absolute top-4 left-4 z-10 pointer-events-auto flex items-center gap-3 rounded-2xl text-[#F0D9B5] px-4 py-2.5 border border-[#6A5ACD]/55 shadow-lg"
        style={{ backgroundColor: 'rgba(26, 26, 31, 0.94)' }}
      >
        <Compass className="w-4 h-4 text-[#F4A62A] shrink-0" />
        <div className="text-xs">
          <div className="font-display font-semibold text-[#F0D9B5] whitespace-nowrap">{career.title}</div>
          <div className="text-xs text-[#D6C7DF] whitespace-nowrap">
            Click any pavilion · Drag to orbit · Scroll to zoom
          </div>
        </div>
      </div>

      {/* Contextual Building / AI Mentor Drawer (Only visible when opened by user click) */}
      {drawerMode !== 'none' && (
        <aside
          className={`absolute top-4 right-4 bottom-24 z-20 ${
            showPavilionVideo ? 'w-[460px]' : 'w-[380px]'
          } max-w-[92vw] rounded-2xl text-[#F0D9B5] border border-[#6A5ACD]/55 shadow-2xl flex flex-col overflow-hidden pointer-events-auto transition-all`}
          style={{ backgroundColor: 'rgba(26, 26, 31, 0.96)' }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#6A5ACD]/40 px-5 py-4 bg-[#2D2B55]">
            <div>
              <div className="text-xs font-mono font-medium text-[#F4A62A]">
                {drawerMode === 'mentor'
                  ? 'AI Career Mentor'
                  : activeStage
                    ? `Level 0${activeStage.stageNumber} · ${activeStage.environmentName}`
                    : 'Central Observatory'}
              </div>
              <h2 className="mt-0.5 text-base font-display font-bold text-[#F0D9B5]">
                {drawerMode === 'mentor' ? 'AI Career Mentor Guide' : activeBuildingMeta.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setDrawerMode('none')}
              aria-label="Close panel"
              className="rounded-xl p-1.5 text-[#D6C7DF] hover:bg-[#6A5ACD]/25 hover:text-[#F0D9B5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {drawerMode === 'mentor' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-[#6A5ACD]/35 bg-[#222042] shrink-0">
                <VoiceMentorPanel
                  contextMode={activeBuildingMeta.label}
                  careerTitle={career.title}
                  dark={true}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                {mentorHistory.length === 0 ? (
                  <div className="rounded-lg bg-[#2D2B55] border border-[#6A5ACD]/45 p-4 text-[#D6C7DF] leading-relaxed">
                    Hello! I am your AI Career Mentor inside the {career.title} world. Ask me about entrance exams, college labs, internship trade-offs, or how to close any skill gaps.
                  </div>
                ) : (
                  mentorHistory.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg p-3 leading-relaxed ${
                        m.role === 'student'
                          ? 'bg-[#F4A62A] text-[#1A1A1F] font-medium ml-6'
                          : 'bg-[#2D2B55] border border-[#6A5ACD]/45 text-[#F0D9B5] mr-4'
                      }`}
                    >
                      {m.content}
                    </div>
                  ))
                )}
                {mentorLoading && (
                  <div className="flex items-center gap-2 text-[#D6C7DF]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F4A62A]" />
                    <span>Mentor thinking...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMentor} className="p-3 border-t border-[#6A5ACD]/35 flex gap-2 bg-[#2D2B55]">
                <input
                  type="text"
                  value={mentorInput}
                  onChange={(e) => setMentorInput(e.target.value)}
                  placeholder="Ask your AI Career Mentor..."
                  className="flex-1 rounded-lg bg-[#1A1A1F] border border-[#6A5ACD]/50 px-3 py-2 text-xs text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-1 focus:ring-[#F4A62A]"
                />
                <button
                  type="submit"
                  disabled={mentorLoading || !mentorInput.trim()}
                  className="rounded-lg bg-[#F4A62A] px-3 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[#D6C7DF] leading-relaxed">{activeBuildingMeta.description}</p>
              </div>

              {/* Embedded Career Journey Video Trigger */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPavilionVideo((prev) => !prev)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 font-semibold transition-colors ${
                    showPavilionVideo
                      ? 'border-[#F4A62A] bg-[#F4A62A] text-[#1A1A1F]'
                      : 'border-[#F4A62A]/60 bg-[#2D2B55] text-[#F4A62A] hover:bg-[#F4A62A]/15'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{showPavilionVideo ? 'Hide Pavilion Video' : 'Watch Stage Animated Video'}</span>
                </button>
                <span className="text-[11px] font-mono text-[#A678B9]">
                  {completed3DActivityIds.filter((id) => id.startsWith(`${career.id}:`)).length} visited
                </span>
              </div>

              {showPavilionVideo && (
                <CareerVideoJourney
                  career={career}
                  profile={profile}
                  watchedVideoSessionIds={watchedVideoSessionIds}
                  onMarkSessionWatched={(watchId) => onMarkSessionWatched?.(watchId)}
                  initialSessionKey={pavilionVideoKey}
                  autoGenerateFirstSession={false}
                  compact={true}
                />
              )}

              {buildingStages.length > 0 ? (
                buildingStages.map((stageItem) => (
                  <div key={stageItem.id} className="space-y-3 pt-2 border-t border-[#6A5ACD]/30">
                    <div className="text-[11px] font-mono font-semibold text-[#F4A62A]">
                      {stageItem.title}
                    </div>
                    <div className="rounded-lg bg-[#2D2B55] border border-[#6A5ACD]/45 p-3.5 space-y-2">
                      <div className="font-semibold text-[#F0D9B5]">Building Checkpoints</div>
                      {stageItem.milestones.map((ms) => (
                        <div key={ms.id} className="flex items-start gap-2 text-[#D6C7DF]">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              ms.completed ? 'text-emerald-400' : 'text-[#6A5ACD]'
                            }`}
                          />
                          <span>{ms.title}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2.5">
                      <div className="font-semibold text-[#F0D9B5]">Interactive Tasks</div>
                      {stageItem.missions.map((mission) => {
                        const done = completedMissionIds.includes(mission.id);
                        const lastRes = missionResults[mission.id];
                        return (
                          <div
                            key={mission.id}
                            className="rounded-lg bg-[#2D2B55] border border-[#6A5ACD]/45 p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#F0D9B5]">{mission.title}</span>
                              {done && (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-mono tabular-nums font-semibold shrink-0">
                                  <Award className="w-3.5 h-3.5" />
                                  <span>{lastRes?.score ?? 85}%</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[#D6C7DF] leading-relaxed">{mission.summary}</p>
                            <button
                              type="button"
                              onClick={() => onLaunchMission(mission, stageItem)}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F4A62A] px-3.5 py-2 font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{done ? 'Replay Mission' : 'Perform Interactive Task'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setDrawerMode('mentor')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F4A62A] px-4 py-2.5 font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open AI Career Mentor Chat</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDrawerMode('mentor')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-4 py-2 font-medium text-[#F0D9B5] hover:bg-[#6A5ACD]/30 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#F4A62A]" />
                <span>Meet AI Career Mentor</span>
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion, Zero backdrop-filter) */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-auto transition-transform duration-200"
        style={{
          width: 'min(940px, 94vw)',
          transform: dockCollapsed ? 'translate(-50%, calc(100% - 34px))' : 'translate(-50%, 0)',
        }}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-t-xl text-[#F0D9B5] border border-b-0 border-[#6A5ACD]/55 px-3.5 py-1 text-xs font-medium hover:text-[#F4A62A]"
          style={{ backgroundColor: 'rgba(26, 26, 31, 0.94)' }}
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
        </button>

        <div
          className="w-full rounded-2xl border border-[#6A5ACD]/55 shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: 'rgba(26, 26, 31, 0.94)' }}
        >
          {/* Building / Environment Stage Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {BUILDINGS.map((b) => {
              const st = b.stageNumber ? roadmap.find((r) => r.stageNumber === b.stageNumber) : null;
              const unlocked = !st || st.unlocked;
              const done = st && st.missions.every((m) => completedMissionIds.includes(m.id));
              const active = selectedBuildingId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => focusBuilding(b.id, true)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#F4A62A] text-[#1A1A1F] font-semibold'
                      : unlocked
                        ? 'bg-[#2D2B55] text-[#F0D9B5] hover:bg-[#6A5ACD]/35 border border-[#6A5ACD]/45'
                        : 'bg-[#1A1A1F] text-[#A678B9]/55 border border-[#6A5ACD]/25'
                  }`}
                >
                  {!unlocked ? (
                    <Lock className="w-3 h-3" />
                  ) : done ? (
                    <CheckCircle2 className={`w-3 h-3 ${active ? 'text-[#1A1A1F]' : 'text-emerald-400'}`} />
                  ) : null}
                  <span className="font-mono tabular-nums">{b.stageNumber ? `Stage 0${b.stageNumber}` : 'Mentor'}</span>
                </button>
              );
            })}
          </div>

          {/* Camera Presets & Mentor Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => flyToPreset([24, 18, 28], [0, 1.5, -2])}
              className="rounded-xl border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 text-xs font-medium text-[#F0D9B5] hover:bg-[#6A5ACD]/35 whitespace-nowrap"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => flyToPreset([0, 38, 12], [0, 0, -4])}
              className="rounded-xl border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 text-xs font-medium text-[#F0D9B5] hover:bg-[#6A5ACD]/35 whitespace-nowrap"
            >
              Aerial Map
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBuildingId('building-mentor');
                setDrawerMode('mentor');
                flyToPreset([11, 8, 13], [0, 2.2, 0]);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Mentor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
