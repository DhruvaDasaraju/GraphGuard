import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RefreshCw } from 'lucide-react';


interface Node3DData {
  id: string;
  name: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  vulnerable?: boolean;
  x: number;
  y: number;
  z: number;
}

const NODES_DATA: Node3DData[] = [
  { id: 'svc-1', name: 'PAYMENT GATEWAY', criticality: 'critical', vulnerable: true, x: 0, y: 0, z: 0 },
  { id: 'svc-2', name: 'CHECKOUT SERVICE', criticality: 'critical', vulnerable: false, x: 2.8, y: 1.2, z: -1.0 },
  { id: 'svc-3', name: 'ORDER DISPATCH', criticality: 'high', vulnerable: false, x: 3.5, y: -1.5, z: 1.2 },
  { id: 'svc-4', name: 'FRAUD DETECTION', criticality: 'high', vulnerable: false, x: -2.5, y: 1.8, z: 0.8 },
  { id: 'svc-5', name: 'USER AUTH API', criticality: 'critical', vulnerable: false, x: -3.2, y: -1.2, z: -1.5 },
  { id: 'svc-6', name: 'INVENTORY REPO', criticality: 'medium', vulnerable: false, x: 1.2, y: 3.0, z: 1.0 },
  { id: 'svc-7', name: 'LEDGER STORAGE', criticality: 'critical', vulnerable: true, x: -1.0, y: -3.0, z: 1.2 },
  { id: 'svc-8', name: 'PUBLIC INGRESS', criticality: 'high', vulnerable: false, x: 0.5, y: 2.2, z: -2.5 },
];

const EDGES_DATA: [string, string][] = [
  ['svc-2', 'svc-1'],
  ['svc-3', 'svc-2'],
  ['svc-4', 'svc-1'],
  ['svc-5', 'svc-1'],
  ['svc-6', 'svc-3'],
  ['svc-7', 'svc-1'],
  ['svc-8', 'svc-2'],
  ['svc-8', 'svc-5'],
];

interface Showroom3DCanvasProps {
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string;
}

export function Showroom3DCanvas({ onSelectNode, selectedNodeId = 'svc-1' }: Showroom3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3DData | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group containing all graph objects
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff0055, 2.0);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // Node Meshes
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeMap = new Map<string, THREE.Vector3>();

    NODES_DATA.forEach((node) => {
      const pos = new THREE.Vector3(node.x, node.y, node.z);
      nodeMap.set(node.id, pos);

      const isVuln = node.vulnerable;
      const isSelected = node.id === selectedNodeId;

      // Color based on status
      const color = isVuln ? 0xff0055 : (node.criticality === 'critical' ? 0xffe600 : 0x00f0ff);

      // Chamfered box geometry for neo-brutalist tech look
      const size = isVuln || isSelected ? 0.75 : 0.55;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.2,
        roughness: 0.3,
        emissive: isVuln ? 0xff0055 : (isSelected ? 0xffe600 : 0x000000),
        emissiveIntensity: isVuln ? 0.6 : (isSelected ? 0.4 : 0.0),
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      mesh.userData = node;

      // Wireframe outline for neo-brutalist border vibe
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x050505, linewidth: 2 })
      );
      mesh.add(line);

      graphGroup.add(mesh);
      nodeMeshes.push(mesh);
    });

    // Edges (Lines between dependent nodes)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
      linewidth: 1.5,
    });

    const edgePoints: THREE.Vector3[] = [];
    EDGES_DATA.forEach(([srcId, tgtId]) => {
      const p1 = nodeMap.get(srcId);
      const p2 = nodeMap.get(tgtId);
      if (p1 && p2) {
        edgePoints.push(p1, p2);
      }
    });

    const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const lineSegments = new THREE.LineSegments(edgeGeometry, lineMaterial);
    graphGroup.add(lineSegments);

    // Particle flow spheres along edges
    const flowCount = 14;
    const flowSpheres: { mesh: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; progress: number; speed: number }[] = [];
    const flowGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const flowMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });

    for (let i = 0; i < flowCount; i++) {
      const pair = EDGES_DATA[i % EDGES_DATA.length];
      const p1 = nodeMap.get(pair[0]);
      const p2 = nodeMap.get(pair[1]);
      if (p1 && p2) {
        const mesh = new THREE.Mesh(flowGeo, flowMat);
        graphGroup.add(mesh);
        flowSpheres.push({
          mesh,
          start: p1,
          end: p2,
          progress: Math.random(),
          speed: 0.006 + Math.random() * 0.008,
        });
      }
    }

    // Raycaster for hover & clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMousePos.x;
        const deltaY = e.clientY - prevMousePos.y;
        graphGroup.rotation.y += deltaX * 0.008;
        graphGroup.rotation.x += deltaY * 0.008;
        prevMousePos = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes, false);
      if (intersects.length > 0) {
        const clickedData = intersects[0].object.userData as Node3DData;
        if (onSelectNode) {
          onSelectNode(clickedData.id);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousemove', onPointerMove);
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('click', onClick);

    // Resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        graphGroup.rotation.y += 0.0035;
      }

      // Update flow pulses
      flowSpheres.forEach((f) => {
        f.progress += f.speed;
        if (f.progress > 1) f.progress = 0;
        f.mesh.position.lerpVectors(f.start, f.end, f.progress);
      });

      // Hover detection
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes, false);
      if (intersects.length > 0) {
        const found = intersects[0].object.userData as Node3DData;
        setHoveredNode(found);
        dom.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        dom.style.cursor = isDragging ? 'grabbing' : 'grab';
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('mousemove', onPointerMove);
      dom.removeEventListener('mousedown', onPointerDown);
      dom.removeEventListener('click', onClick);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [selectedNodeId, onSelectNode, autoRotate]);

  return (
    <div className="relative w-full h-[360px] sm:h-[440px] border-[3.5px] border-[#050505] bg-[#edf2fb] dark:bg-[#080914] shadow-[8px_8px_0px_#050505] overflow-hidden select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Showroom HUD Overlay - Top Left */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-[#0c1022] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-[11px] font-black uppercase tracking-wider text-[#050505] dark:text-white">
          <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-ping" />
          <span>REAL-TIME 3D MICROSERVICE TOPOLOGY</span>
        </div>
        <div className="text-[10px] font-mono font-bold text-[#050505]/60 dark:text-white/60">
          DRAG TO ROTATE · CLICK NODE TO ISOLATE BLAST RADIUS
        </div>
      </div>

      {/* Showroom Controls - Top Right */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2.5 py-1 text-xs font-mono font-black uppercase border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] transition-all ${
            autoRotate
              ? 'bg-[#FFE600] text-[#050505]'
              : 'bg-white dark:bg-[#12172f] text-[#050505] dark:text-white'
          }`}
          title="Toggle 3D orbit rotation"
        >
          <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${autoRotate ? 'animate-spin-slow' : ''}`} />
          {autoRotate ? 'ORBIT: ON' : 'ORBIT: PAUSED'}
        </button>
      </div>

      {/* Hovered Node Tooltip HUD - Bottom Left */}
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 bg-[#FFE600] text-[#050505] border-[2.5px] border-[#050505] shadow-[4px_4px_0px_#050505] p-3 max-w-xs pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between gap-3 text-[10px] font-mono font-black uppercase">
            <span>NODE // {hoveredNode.id}</span>
            <span
              className={`px-1.5 py-0.2 border border-[#050505] ${
                hoveredNode.vulnerable ? 'bg-[#FF0055] text-white' : 'bg-[#00FF66] text-[#050505]'
              }`}
            >
              {hoveredNode.vulnerable ? 'ALERT: VULNERABLE' : 'STABLE'}
            </span>
          </div>
          <div className="font-display font-black text-base uppercase leading-tight mt-1">
            {hoveredNode.name}
          </div>
          <div className="text-[11px] font-mono mt-1 text-[#050505]/80">
            Criticality: <span className="font-bold uppercase">{hoveredNode.criticality}</span> · Multi-hop dependencies mapped.
          </div>
        </div>
      )}

      {/* Legend - Bottom Right */}
      <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#0c1022] border-[2px] border-[#050505] shadow-[3px_3px_0px_#050505] text-[10px] font-mono font-black uppercase text-[#050505] dark:text-white">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-[#FF0055] border border-[#050505]" />
          CRITICAL VULN
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-[#FFE600] border border-[#050505]" />
          CRITICAL SERVICE
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-[#00F0FF] border border-[#050505]" />
          DEPENDENT
        </span>
      </div>
    </div>
  );
}
