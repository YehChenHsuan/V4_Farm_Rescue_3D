/**
 * FARM RESCUE 3D · 牧場場景引擎 (Three.js 3D Engine)
 * 升級功能：
 * 1. 滿版全螢幕 3D 牧場，具備立體穀倉、柵欄、果樹、河流與糖果光影
 * 2. 射線拾取 (Raycaster) 支援點擊動物：觸發 Squash & Stretch 彈跳動態與計數
 * 3. 3D 慶祝金星粒子爆破系統與平滑視角插值旋轉 (Lerp)
 */

import * as THREE from './vendor/three.module.js';

const holder = document.querySelector('#scene-container');

export function createFarm() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#93c5fd'); // 晴朗粉藍色天空
  scene.fog = new THREE.FogExp2('#93c5fd', 0.012);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  holder.replaceChildren(renderer.domElement);

  // 雙色柔和環境光 + 太陽平行光 (PBR 糖果光感)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x86efac, 1.8));
  const sun = new THREE.DirectionalLight(0xfffae6, 2.6);
  sun.position.set(-12, 24, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 20, bottom: -18, near: 0.5, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // 局部點光源 (穀倉前暖光)
  const barnLight = new THREE.PointLight(0xfef08a, 1.2, 25);
  barnLight.position.set(-6, 4, -2);
  scene.add(barnLight);

  const materials = new Map();
  function mat(color, roughness = 0.7, metalness = 0.1) {
    const key = `${color}_${roughness}_${metalness}`;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }
    return materials.get(key);
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 16, 14);
  const cone = new THREE.ConeGeometry(1, 1, 14);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);

  function mesh(parent, geo, color, pos, scale, rot = [0, 0, 0]) {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(...pos);
    m.scale.set(...scale);
    m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // 1. 牧場立體浮島草地路面
  const island = new THREE.Group();
  mesh(island, box, '#4ade80', [0, -0.6, 0], [28, 1.2, 22]); // 主草皮
  mesh(island, box, '#78350f', [0, -2.4, 0], [27.6, 2.4, 21.6]); // 泥土斷層
  scene.add(island);

  // 2. 牧場農舍紅穀倉 (Red Barn)
  const barn = new THREE.Group();
  mesh(barn, box, '#e11d48', [-8, 2.2, -6], [4.5, 4.0, 3.8]); // 主牆面
  const roof = mesh(barn, cone, '#065f46', [-8, 5.0, -6], [3.6, 2.4, 3.6], [0, Math.PI / 4, 0]);
  mesh(barn, box, '#fef08a', [-8, 1.4, -4.05], [1.8, 2.4, 0.1]); // 穀倉木門
  mesh(barn, box, '#ffffff', [-8, 3.4, -4.05], [1.0, 1.0, 0.1]); // 頂部白窗
  scene.add(barn);

  // 3. 風車與圍欄
  const windmill = new THREE.Group();
  mesh(windmill, cylinder, '#f8fafc', [9, 3.5, -6], [0.9, 1.4, 7]);
  const blades = new THREE.Group();
  blades.position.set(9, 6.5, -4.8);
  for (let b = 0; b < 4; b++) {
    const blade = mesh(blades, box, '#d97706', [0, 1.2, 0], [0.3, 2.4, 0.05], [0, 0, (b * Math.PI) / 2]);
  }
  windmill.add(blades);
  scene.add(windmill);

  // 四周木質圍欄
  for (let x = -12; x <= 12; x += 2.5) {
    mesh(scene, box, '#fcd34d', [x, 0.6, -9], [0.2, 1.4, 0.2]);
  }
  for (const y of [0.4, 1.0]) {
    mesh(scene, box, '#f59e0b', [0, y, -9], [25, 0.14, 0.14]);
  }

  // 牧場果樹與草叢
  const treePositions = [[-10, 4], [10, 4], [-11, -2], [11, -1]];
  treePositions.forEach(([tx, tz]) => {
    mesh(scene, cylinder, '#78350f', [tx, 1.2, tz], [0.35, 0.45, 2.4]);
    mesh(scene, sphere, '#22c55e', [tx, 2.8, tz], [1.6, 1.6, 1.6]);
    mesh(scene, sphere, '#4ade80', [tx - 0.4, 3.5, tz], [1.1, 1.1, 1.1]);
  });

  // 4. 動物族群與互動管理
  const herd = new THREE.Group();
  scene.add(herd);
  let animals = [];
  let currentAngle = 0;
  let targetAngle = 0;
  let paused = false;
  let celebrate = false;
  let clock = 0;

  // 粒子系統池
  const particles = [];
  function spawnConfetti(pos, color = 0xfacc15, count = 30) {
    const pGeo = new THREE.DodecahedronGeometry(0.18, 0);
    for (let i = 0; i < count; i++) {
      const pMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.2
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      particles.push({
        mesh: pMesh,
        vx: Math.cos(angle) * speed,
        vy: 4 + Math.random() * 5,
        vz: Math.sin(angle) * speed,
        life: 1.0
      });
      scene.add(pMesh);
    }
  }

  function animal(kind) {
    const g = new THREE.Group();
    g.userData.kind = kind;
    g.userData.bounceTime = 0;

    const color = {
      cat: '#dfaa63',
      rooster: '#d89843',
      donkey: '#8c9698',
      pig: '#eda5a2',
      horse: '#a87248',
      dog: '#ead4ad',
      goat: '#eee7cf',
      bull: '#745449'
    }[kind] || '#dfaa63';

    if (kind === 'rooster') {
      mesh(g, sphere, color, [0, 0.8, 0], [0.45, 0.6, 0.5]);
      mesh(g, sphere, '#f1cb69', [0, 1.45, 0.18], [0.27, 0.3, 0.27]);
      mesh(g, cone, '#e29b26', [0, 1.4, 0.53], [0.18, 0.3, 0.18], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) mesh(g, sphere, '#b63e34', [0, 1.73, 0.02 + i * 0.12], [0.09, 0.16, 0.1]);
      for (const x of [-0.18, 0.18]) mesh(g, box, '#b77a28', [x, 0.2, 0], [0.08, 0.4, 0.08]);
      for (let i = 0; i < 3; i++) mesh(g, sphere, '#315b43', [(i - 1) * 0.14, 1, -0.5], [0.12, 0.55, 0.18]);
    } else {
      mesh(g, sphere, color, [0, 0.72, 0], [0.48, 0.42, 0.7]);
      mesh(g, sphere, color, [0, 1.12, 0.55], [0.37, 0.38, 0.35]);
      for (const x of [-0.3, 0.3]) for (const z of [-0.4, 0.4]) mesh(g, box, color, [x, 0.3, z], [0.17, 0.6, 0.18]);
      const long = ['donkey', 'horse'].includes(kind);
      for (const x of [-0.23, 0.23]) {
        const ear = mesh(g, cone, color, [x, long ? 1.72 : 1.5, 0.5], [0.17, long ? 0.65 : 0.3, 0.17]);
        ear.rotation.z = x * 0.7;
      }
      mesh(g, sphere, kind === 'pig' ? '#d47b83' : color, [0, 1.02, 0.82], [kind === 'pig' ? 0.27 : 0.23, 0.2, 0.18]);
      if (['bull', 'goat'].includes(kind)) for (const x of [-0.38, 0.38]) {
        const h = mesh(g, cone, '#f5ddb1', [x, 1.53, 0.48], [0.12, 0.5, 0.12]);
        h.rotation.z = -x * 1.4;
      }
      if (kind === 'goat') mesh(g, cone, '#e0d7ba', [0, 0.76, 0.77], [0.12, 0.3, 0.12], [Math.PI, 0, 0]);
      if (kind === 'dog') for (const x of [-0.36, 0.36]) mesh(g, sphere, '#71523e', [x, 1.12, 0.49], [0.12, 0.3, 0.17]);
      mesh(g, sphere, color, [0, 0.95, -0.73], [0.09, 0.32, 0.09], [-0.5, 0, 0]);
    }
    const ey = kind === 'rooster' ? 1.5 : 1.2, ex = kind === 'rooster' ? 0.16 : 0.18, ez = kind === 'rooster' ? 0.4 : 0.83;
    for (const x of [-ex, ex]) mesh(g, sphere, '#24362f', [x, ey, ez], [0.045, 0.06, 0.04]);
    return g;
  }

  function populate(kind, count) {
    herd.clear();
    animals = [];
    const columns = Math.min(count, 5);
    const rows = Math.ceil(count / 5);

    for (let i = 0; i < count; i++) {
      const g = animal(kind);
      const row = Math.floor(i / 5);
      const n = Math.min(5, count - row * 5);
      g.position.set((i % 5 - (n - 1) / 2) * 2.2, 0, row * 2.5 - (rows - 1) * 1.25 + 1.2);
      
      // 出場彈跳縮放 (Spawn Animation)
      g.scale.set(0.01, 0.01, 0.01);
      if (typeof gsap !== 'undefined') {
        gsap.to(g.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.5,
          delay: i * 0.05,
          ease: 'back.out(1.8)'
        });
      } else {
        g.scale.set(1, 1, 1);
      }

      herd.add(g);
      animals.push(g);
    }
    celebrate = false;
    targetAngle = 0;
  }

  // 射線點擊互動 (Raycasting for Interactive Counting)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(herd.children, true);

    if (intersects.length > 0) {
      let root = intersects[0].object;
      while (root.parent && root.parent !== herd) root = root.parent;
      if (root) {
        // 果凍彈跳 (Squash & Stretch)
        root.userData.bounceTime = 1.0;
        spawnConfetti(root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xfacc15, 15);
        if (window.onAnimalClicked) window.onAnimalClicked(root.userData.kind);
      }
    }
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  populate('pig', 7);

  // 主渲染迴圈
  renderer.setAnimationLoop(() => {
    if (document.hidden) return;

    // 平滑視角旋轉 (Lerp Angle)
    currentAngle += (targetAngle - currentAngle) * 0.1;
    camera.position.set(Math.sin(currentAngle) * 22, 14.5, Math.cos(currentAngle) * 22);
    camera.lookAt(0, 0.2, 0);

    // 風車轉動
    blades.rotation.z += 0.015;

    if (!paused) {
      clock += 0.03;
      animals.forEach((a, i) => {
        // 點擊彈跳回復
        if (a.userData.bounceTime > 0) {
          a.userData.bounceTime -= 0.05;
          const s = Math.sin(a.userData.bounceTime * Math.PI);
          a.scale.set(1 + s * 0.3, 1 - s * 0.2, 1 + s * 0.3);
          a.position.y = s * 0.8;
        } else if (celebrate) {
          // 通關全體慶祝大跳躍
          a.position.y = Math.abs(Math.sin(clock * 3.5 + i * 0.35)) * 0.8;
          a.rotation.y = Math.sin(clock * 2 + i) * 0.3;
        } else {
          a.position.y = 0;
          a.rotation.y = 0;
          a.scale.set(1, 1, 1);
        }
      });
    }

    // 粒子更新
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.025;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 9.8 * 0.025;
      p.mesh.position.x += p.vx * 0.025;
      p.mesh.position.y += p.vy * 0.025;
      p.mesh.position.z += p.vz * 0.025;
      p.mesh.scale.set(p.life, p.life, p.life);
    }

    renderer.render(scene, camera);
  });

  return {
    populate,
    rotate(d) {
      targetAngle = THREE.MathUtils.clamp(targetAngle + d, -0.65, 0.65);
    },
    resetView() {
      targetAngle = 0;
    },
    pause(v) {
      paused = v;
    },
    celebrate() {
      celebrate = true;
      animals.forEach(a => {
        spawnConfetti(a.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xfacc15, 20);
      });
    },
    stats() {
      return { animals: animals.length, calls: renderer.info.render.calls };
    }
  };
}


