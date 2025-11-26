import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

let renderer, scene, camera, controls, raf
let resources = { objects: [], geometries: [], materials: [] }

function createSprite(size = 128, color = '#ffffff') {
  const DPR = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.floor(size * DPR)
  const ctx = canvas.getContext('2d')
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx)
  grad.addColorStop(0, color)
  grad.addColorStop(0.35, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  resources.materials.push(tex)
  return tex
}

function gaussianRandom(mean = 0, std = 1) {
  // Box-Muller transform
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return z * std + mean
}

export function init(container) {
  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 5000)
  camera.position.set(0, 120, 600)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x000000)
  container.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = 120
  controls.maxDistance = 4000

  // Stars (large spherical background so camera always inside star field)
  // increase star density to make the background feel richer
  const starCount = 34000
  const positions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1)
    const theta = 2 * Math.PI * Math.random()
    // extend stars to a much larger radius so there is no visible boundary
    const r = Math.pow(Math.random(), 1 / 3) * 7000
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // per-star randomness for subtle twinkle
  const starRand = new Float32Array(starCount)
  const starSize = new Float32Array(starCount)
  for (let i = 0; i < starCount; i++) {
    starRand[i] = Math.random()
  // slightly larger base size so stars are more visible
  starSize[i] = 2.6 + Math.random() * 2.8
  }
  geom.setAttribute('aRandom', new THREE.BufferAttribute(starRand, 1))
  geom.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1))
  resources.geometries.push(geom)
  const starTex = createSprite(64, '#ffffff')
  // star shader: subtle per-particle flicker driven by uTime and per-vertex randomness
  const starVert = `
  attribute float aRandom;
  attribute float aSize;
  uniform float uTime;
  varying float vAlpha;
  varying float vRange;
  varying float vRand;
    void main() {
      float flick = 0.85 + 0.22 * sin(uTime * (0.5 + aRandom * 1.8) + aRandom * 12.0);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        // use full 3D distance so side proximity also increases visibility
        float dist = length(mvPos.xyz) + 0.0001;
        // scale points by view distance so items remain visible when zoomed in
  float scale = clamp(160.0 / dist, 0.6, 10.0);
        // slightly reduce flick amplitude at extreme distances
        float flickScale = clamp(pow(160.0 / dist, 0.12), 0.85, 2.6);
  vAlpha = flick * flickScale;
  vRand = aRandom;
  vRange = scale;
      gl_Position = projectionMatrix * mvPos;
      // size attenuation: scale by aSize, view scale, and a mild flicker
      gl_PointSize = aSize * scale * (1.0 + 0.25 * sin(uTime * (0.6 + aRandom * 1.5) + aRandom * 5.0));
    }
  `
  const starFrag = `
    uniform sampler2D map;
    uniform float opacity;
    uniform float uMinOpacity;
    varying float vAlpha;
    varying float vRange;
    varying float vRand;
    void main() {
      vec4 tex = texture2D(map, gl_PointCoord);
      // subtle tint variation per-star
      vec3 tint = mix(vec3(1.0, 0.98, 0.95), vec3(0.9, 0.95, 1.0), vRand);
  // compress alpha but keep stars punchy; soften viewBoost effect
  float raw = tex.a * vAlpha * opacity;
  float vb = clamp(vRange / 3.0, 0.7, 3.5);
  float viewBoost = mix(1.0, vb, 0.45);
  raw *= viewBoost;
  float a = clamp(pow(raw, 1.05), 0.0, 0.96);
  // ensure a minimum visible alpha so points remain seen at closest zooms
  a = max(a, uMinOpacity * opacity);
      gl_FragColor = vec4(tex.rgb * tint, a);
    }
  `
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: starTex }, opacity: { value: 0.9 }, uMinOpacity: { value: 0.09 } },
    vertexShader: starVert,
    fragmentShader: starFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(starMat, starTex)
  const stars = new THREE.Points(geom, starMat)
  resources.objects.push(stars)
  scene.add(stars)

  // Galaxy cloud: generate a spindle / band-shaped distribution
  // Galaxy cloud: larger, smoother spindle without hard edge
  // Generate a single ellipsoid volume with soft edges
  // Scale the nebula area by +300% (area x4). Linear dimensions scale by 2.0.
  const _scaleLinear = 2.0; // linear x2 -> area x4 (300% increase from original)
  // increase cloud particle density within the scaled nebula (50% more particles)
  const cloudCount = Math.round(30000 * _scaleLinear * 1.5)
  const cpos = new Float32Array(cloudCount * 3)
  const baseR = 900 * _scaleLinear
  // increase radialSpread to create a long soft tail
  const radialSpread = 2100 * _scaleLinear
  const thickness = 360 * _scaleLinear
  // ellipsoid parameters (rx, ry, rz) - rx/rz around horizontal plane, ry is vertical (thickness)
  // adjust to make ellipsoid fuller from all angles: increase ry and reduce extreme flattening
  // make the cloud slightly flatter vertically
  const rx = baseR * 1.6
  const ry = thickness * 1.2 // slightly reduced vertical thickness
  const rz = baseR * 1.25
  // density falloff exponent (higher -> more concentrated core). Increase to concentrate center more
  const densityPow = 1.40
  // edge blur scale (how much extra jitter near the edge)
  const edgeBlur = baseR * 0.12
  const maxTries = 4000
  for (let i = 0; i < cloudCount; i++) {
    let x = 0, y = 0, z = 0
    let accepted = false
    for (let tries = 0; tries < maxTries; tries++) {
      x = (Math.random() * 2 - 1) * rx
      y = (Math.random() * 2 - 1) * ry
      z = (Math.random() * 2 - 1) * rz
      const s = (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz)
      if (s > 1) continue
      const p = Math.pow(1 - s, densityPow) // density weight
      if (Math.random() < p) {
        // add soft edge jitter proportional to how close to edge (larger near edge)
        const edgeFactor = Math.sqrt(s)
        const blur = edgeBlur * (0.4 + 0.9 * edgeFactor)
        x += gaussianRandom(0, blur * 0.6)
        y += gaussianRandom(0, blur * 0.5)
        z += gaussianRandom(0, blur * 0.6)
        accepted = true
        break
      }
    }
    if (!accepted) {
      // fallback: sample a point near center with small jitter
      x = gaussianRandom(0, rx * 0.35)
      y = gaussianRandom(0, ry * 0.35)
      z = gaussianRandom(0, rz * 0.35)
    }
    cpos[i * 3] = x
    cpos[i * 3 + 1] = y
    cpos[i * 3 + 2] = z
  }
  const cg = new THREE.BufferGeometry()
  cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3))
  // per-cloud particle color attribute (r,g,b)
  const cloudColor = new Float32Array(cloudCount * 3)
  // per-cloud particle randomness and base size for subtle twinkle
  const cloudRand = new Float32Array(cloudCount)
  const cloudSizeArr = new Float32Array(cloudCount)
  for (let i = 0; i < cloudCount; i++) {
    cloudRand[i] = Math.random()
  // slightly larger cloud particle base size so mid/far field cloud reads better
  cloudSizeArr[i] = 2.6 + Math.random() * 3.6
    // color gradient: blue -> violet with small randomness, bias brighter toward center
    const px = cpos[i * 3]
    const nx = Math.max(-1, Math.min(1, px / (rx * 1.1)))
    let t = (nx + 1) * 0.5 // 0..1 across horizontal
    // center bias (t around 0.5 will be slightly brighter)
    const centerBias = 1.0 - Math.abs((px) / (rx * 0.9))
    // palette: deep violet, vivid blue, pale magenta
    const deep = [0.42, 0.36, 0.92]
    const vivid = [0.58, 0.65, 1.0]
    const mag = [0.88, 0.6, 0.98]
    const rnd = (Math.random() - 0.5) * 0.12
    // mix between vivid and deep across t, add magenta tint for small t range
    const mix1 = 1.0 - t
    const mix2 = t
    const r = Math.max(0.0, Math.min(1.0, deep[0] * mix1 + vivid[0] * mix2 + (mag[0] - vivid[0]) * Math.pow(t, 2.2) * 0.2 + rnd + 0.06 * centerBias))
    const g = Math.max(0.0, Math.min(1.0, deep[1] * mix1 + vivid[1] * mix2 + (mag[1] - vivid[1]) * Math.pow(t, 2.0) * 0.12 + rnd * 0.6 + 0.04 * centerBias))
    const b = Math.max(0.0, Math.min(1.0, deep[2] * mix1 + vivid[2] * mix2 + (mag[2] - vivid[2]) * Math.pow(t, 1.6) * 0.25 + rnd * 0.8 + 0.08 * centerBias))
    cloudColor[i * 3] = r
    cloudColor[i * 3 + 1] = g
    cloudColor[i * 3 + 2] = b
  }
  cg.setAttribute('aRandom', new THREE.BufferAttribute(cloudRand, 1))
  cg.setAttribute('aSize', new THREE.BufferAttribute(cloudSizeArr, 1))
  cg.setAttribute('color', new THREE.BufferAttribute(cloudColor, 3))
  resources.geometries.push(cg)
  // slightly darker/desaturated cloud texture to reduce core saturation
  const cloudTex = createSprite(300, 'rgba(190,180,210,1)')
  // cloud shader: size + alpha modulated by time and per-particle randomness for gentle flicker
  const cloudVert = `
  attribute float aRandom;
  attribute float aSize;
  attribute vec3 color;
  uniform float uTime;
  varying float vFlick;
  varying float vRange;
  varying float vRand;
  varying vec3 vColor;
  varying vec3 vWorldPos;
    void main() {
      float flick = 0.78 + 0.30 * sin(uTime * (0.25 + aRandom * 1.6) + aRandom * 7.0);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        float dist = length(mvPos.xyz) + 0.0001;
        // larger base scale for cloud so it reads when close
  float scale = clamp(220.0 / dist, 0.7, 12.0);
        float flickScale = clamp(pow(220.0 / dist, 0.14), 0.85, 2.8);
  vFlick = flick * flickScale;
  vRange = scale;
  vColor = color;
      gl_Position = projectionMatrix * mvPos;
      gl_PointSize = aSize * scale * (1.0 + 0.28 * sin(uTime * (0.4 + aRandom * 1.2) + aRandom * 3.0));
    }
  `
  const cloudFrag = `
    uniform sampler2D map;
    uniform float opacity;
    uniform float uMinOpacity;
    uniform vec3 uCameraPos;
    uniform float uNearRadius;
    uniform float uNearBoost;
    varying float vFlick;
    varying float vRange;
    varying float vRand;
    varying vec3 vColor;
    varying vec3 vWorldPos;
    void main() {
      vec4 tex = texture2D(map, gl_PointCoord);
      // subtle tint variation for cloud microstructure
      vec3 tint = mix(vec3(0.93,0.88,0.98), vec3(0.82,0.86,1.0), vRand);
      float raw = tex.a * vFlick * opacity;
      // soften viewBoost effect so opacity changes with distance are gentler
      float vb = clamp(vRange / 3.0, 0.8, 2.2);
      float viewBoost = mix(1.0, vb, 0.42);
      raw *= viewBoost;
      // near-camera boost: increase raw when camera is within uNearRadius
      float d = length(uCameraPos - vWorldPos);
      float nearFactor = clamp(1.0 - d / uNearRadius, 0.0, 1.0);
      // smooth the nearFactor for gentle falloff
      nearFactor = pow(nearFactor, 0.9);
      raw *= (1.0 + nearFactor * uNearBoost);
      // reduce alpha compression exponent to brighten overall cloud
      float a = clamp(pow(raw, 1.30), 0.0, 0.92);
      a = max(a, uMinOpacity * opacity);
      vec3 col = tex.rgb * vColor * tint;
      gl_FragColor = vec4(col, a);
    }
  `
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: cloudTex }, opacity: { value: 0.44 }, uMinOpacity: { value: 0.14 }, uCameraPos: { value: new THREE.Vector3() }, uNearRadius: { value: 220.0 }, uNearBoost: { value: 1.45 } },
    vertexShader: cloudVert,
    fragmentShader: cloudFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(cloudMat, cloudTex)
  const cloud = new THREE.Points(cg, cloudMat)
  // micro-core layer: small, dense center to add perceived volume from any angle
  // increase micro core particle count slightly to keep perceived density after scaling
  const microCount = Math.round(22000 * _scaleLinear)
  const microPos = new Float32Array(microCount * 3)
  for (let m = 0; m < microCount; m++) {
    microPos[m * 3] = gaussianRandom(0, rx * 0.22)
    microPos[m * 3 + 1] = gaussianRandom(0, ry * 0.20)
    microPos[m * 3 + 2] = gaussianRandom(0, rz * 0.22)
  }
  const microG = new THREE.BufferGeometry()
  microG.setAttribute('position', new THREE.BufferAttribute(microPos, 3))
  // micro particle colors (biased warm in core)
  const microColor = new Float32Array(microCount * 3)
  for (let m = 0; m < microCount; m++) {
    const px = microPos[m * 3]
    const nx = Math.max(-1, Math.min(1, px / (rx * 0.9)))
    const t = Math.abs(nx)
    // bias toward cool blue/purple near core
    microColor[m * 3] = 0.58 - 0.18 * t + (Math.random() - 0.5) * 0.06
    microColor[m * 3 + 1] = 0.62 - 0.12 * t + (Math.random() - 0.5) * 0.05
    microColor[m * 3 + 2] = 0.95 - 0.06 * t + (Math.random() - 0.5) * 0.06
  }
  microG.setAttribute('color', new THREE.BufferAttribute(microColor, 3))
  // micro layer attributes
  const microRand = new Float32Array(microCount)
  const microSizeArr = new Float32Array(microCount)
  for (let m = 0; m < microCount; m++) {
    microRand[m] = Math.random()
  // slightly larger micro particles to help mid/far readability while keeping count high
  microSizeArr[m] = 1.0 + Math.random() * 2.0
  }
  microG.setAttribute('aRandom', new THREE.BufferAttribute(microRand, 1))
  microG.setAttribute('aSize', new THREE.BufferAttribute(microSizeArr, 1))
  resources.geometries.push(microG)
  // darker micro texture to avoid bright hot spots
  const microTex = createSprite(120, 'rgba(210,205,220,1)')
  const microVert = `
  attribute float aRandom;
  attribute float aSize;
  attribute vec3 color;
  uniform float uTime;
  varying float vFlick;
  varying float vRange;
  varying float vRand;
  varying vec3 vColor;
  varying vec3 vWorldPos;
    void main() {
      float flick = 0.8 + 0.34 * sin(uTime * (0.6 + aRandom * 1.9) + aRandom * 9.0);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        float dist = length(mvPos.xyz) + 0.0001;
  float scale = clamp(180.0 / dist, 0.6, 8.0);
        float flickScale = clamp(pow(180.0 / dist, 0.13), 0.85, 2.4);
  vFlick = flick * flickScale;
  vRange = scale;
  vColor = color;
      gl_Position = projectionMatrix * mvPos;
      gl_PointSize = aSize * scale * (1.0 + 0.36 * sin(uTime * (0.7 + aRandom * 1.4) + aRandom * 4.0));
    }
  `
  const microFrag = `
    uniform sampler2D map;
    uniform float opacity;
    uniform float uMinOpacity;
    uniform vec3 uCameraPos;
    uniform float uNearRadius;
    uniform float uNearBoost;
    varying float vFlick;
    varying float vRange;
    varying float vRand;
    varying vec3 vColor;
    varying vec3 vWorldPos;
    void main() {
      vec4 tex = texture2D(map, gl_PointCoord);
      vec3 tint = mix(vec3(0.97,0.94,1.0), vec3(0.88,0.9,0.98), vRand);
      float raw = tex.a * vFlick * opacity;
      float vb = clamp(vRange / 3.0, 0.85, 2.2);
      float viewBoost = mix(1.0, vb, 0.40);
      raw *= viewBoost;
      // near-camera boost for micro layers
      float d = length(uCameraPos - vWorldPos);
      float nearFactor = clamp(1.0 - d / uNearRadius, 0.0, 1.0);
      nearFactor = pow(nearFactor, 0.9);
      raw *= (1.0 + nearFactor * uNearBoost);
      float a = clamp(pow(raw, 1.35), 0.0, 0.82);
      a = max(a, uMinOpacity * opacity);
      vec3 col = tex.rgb * vColor * tint;
      gl_FragColor = vec4(col, a);
    }
  `
  const microMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: microTex }, opacity: { value: 0.46 }, uMinOpacity: { value: 0.09 }, uCameraPos: { value: new THREE.Vector3() }, uNearRadius: { value: 180.0 }, uNearBoost: { value: 1.6 } },
    vertexShader: microVert,
    fragmentShader: microFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(microMat, microTex)
  const microCloud = new THREE.Points(microG, microMat)
  // add a large low-opacity glow to make the cloud read at any zoom level
  const glowGeom = new THREE.BufferGeometry()
  const glowPos = new Float32Array(3)
  glowPos[0] = 0; glowPos[1] = 0; glowPos[2] = 0
  glowGeom.setAttribute('position', new THREE.BufferAttribute(glowPos, 3))
  const glowTex = createSprite(700, 'rgba(200,180,255,1)')
  // further reduce glow to avoid linear saturated blob
  // disable glow to avoid large saturated core; keep texture in case it's useful later
  const glowMat = new THREE.PointsMaterial({ size: 900, map: glowTex, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
  resources.materials.push(glowMat, glowTex)
  const glow = new THREE.Points(glowGeom, glowMat)
  // filament layer: subtle, more dispersed filaments (much fewer & smaller)
  const filamentCount = 80
  const filamentPos = new Float32Array(filamentCount * 3)
  for (let f = 0; f < filamentCount; f++) {
    // distribute filaments across the cloud volume with more randomness
    filamentPos[f * 3] = (Math.random() - 0.5) * rx * (0.9 + Math.random() * 0.6) + gaussianRandom(0, rx * 0.12)
    filamentPos[f * 3 + 1] = gaussianRandom(0, ry * 0.30) + (Math.random() - 0.5) * 40
    filamentPos[f * 3 + 2] = (Math.random() - 0.5) * rz * (0.6 + Math.random() * 0.8) + gaussianRandom(0, rz * 0.11)
  }
  const filamentG = new THREE.BufferGeometry()
  filamentG.setAttribute('position', new THREE.BufferAttribute(filamentPos, 3))
  const filamentRand = new Float32Array(filamentCount)
  const filamentSize = new Float32Array(filamentCount)
  for (let f = 0; f < filamentCount; f++) {
    filamentRand[f] = Math.random()
    // much smaller filaments
    filamentSize[f] = 40 + Math.random() * 80
  }
  filamentG.setAttribute('aRandom', new THREE.BufferAttribute(filamentRand, 1))
  filamentG.setAttribute('aSize', new THREE.BufferAttribute(filamentSize, 1))
  resources.geometries.push(filamentG)
  const filamentTex = createSprite(220, 'rgba(220,200,255,1)')
  const filamentMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: filamentTex }, opacity: { value: 0.04 }, uMinOpacity: { value: 0.02 } },
    vertexShader: `
      attribute float aRandom;
      attribute float aSize;
      uniform float uTime;
      varying float vRand;
      varying float vRange;
      void main(){
        vec4 mvPos = modelViewMatrix * vec4(position,1.0);
        float dist = length(mvPos.xyz) + 0.0001;
        // slightly lower max so filaments don't blow out at distance
        float scale = clamp(260.0 / dist, 0.7, 10.0);
        vRange = scale;
        vRand = aRandom;
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = aSize * scale * (0.5 + 0.5 * (0.5 + 0.5 * sin(uTime * (0.2 + aRandom))));
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      varying float vRand;
      varying float vRange;
      void main(){
        vec4 tex = texture2D(map, gl_PointCoord);
        vec3 tint = mix(vec3(0.95,0.9,1.0), vec3(0.88,0.86,1.0), vRand);
        // tighter view boost cap and lower alpha cap to prevent streaks
        float raw = tex.a * opacity * clamp(vRange / 3.0, 0.7, 1.8);
        float a = clamp(pow(raw, 1.05), 0.0, 0.12);
        gl_FragColor = vec4(tex.rgb * tint, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(filamentMat, filamentTex)
  const filament = new THREE.Points(filamentG, filamentMat)
  resources.objects.push(filament)

  const cloudGroup = new THREE.Group()
  // micro-core dense layer: very small, numerous blue-tinted particles to strengthen center density
  const microCoreCount = Math.round(12000 * _scaleLinear)
  const microCorePos = new Float32Array(microCoreCount * 3)
  for (let k = 0; k < microCoreCount; k++) {
    microCorePos[k * 3] = gaussianRandom(0, rx * 0.08)
    microCorePos[k * 3 + 1] = gaussianRandom(0, ry * 0.06)
    microCorePos[k * 3 + 2] = gaussianRandom(0, rz * 0.08)
  }
  const microCoreG = new THREE.BufferGeometry()
  microCoreG.setAttribute('position', new THREE.BufferAttribute(microCorePos, 3))
  const microCoreColor = new Float32Array(microCoreCount * 3)
  const microCoreSize = new Float32Array(microCoreCount)
  for (let k = 0; k < microCoreCount; k++) {
    microCoreColor[k * 3] = 0.48 + (Math.random() - 0.5) * 0.06
    microCoreColor[k * 3 + 1] = 0.56 + (Math.random() - 0.5) * 0.05
    microCoreColor[k * 3 + 2] = 0.95 + (Math.random() - 0.5) * 0.03
    microCoreSize[k] = 0.6 + Math.random() * 1.0
  }
  microCoreG.setAttribute('color', new THREE.BufferAttribute(microCoreColor, 3))
  microCoreG.setAttribute('aSize', new THREE.BufferAttribute(microCoreSize, 1))
  resources.geometries.push(microCoreG)
  const microCoreTex = createSprite(64, 'rgba(180,190,255,1)')
  const microCoreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, map: { value: microCoreTex }, opacity: { value: 0.58 }, uMinOpacity: { value: 0.12 }, uCameraPos: { value: new THREE.Vector3() }, uNearRadius: { value: 120.0 }, uNearBoost: { value: 2.0 } },
    vertexShader: microVert,
    fragmentShader: microFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(microCoreMat, microCoreTex)
  const microCore = new THREE.Points(microCoreG, microCoreMat)

  cloudGroup.add(cloud)
  cloudGroup.add(microCloud)
  cloudGroup.add(microCore)
  // add filaments slightly before the main glow so they appear integrated
  cloudGroup.add(filament)
  cloudGroup.add(glow)
  // give a stronger initial tilt so cloud won't look perfectly aligned
  // increased ranges so the galaxy shows a more pronounced tilt on load
  const tiltX = 0.55 + (Math.random() - 0.5) * 0.50
  const tiltY = 0.18 + (Math.random() - 0.5) * 0.26
  // ensure right side (positive X) is higher than left: make tiltZ positive in a controlled range
  const tiltZ = 0.22 + Math.random() * 0.33 // ~0.22 .. 0.55
  cloudGroup.rotation.set(tiltX, tiltY, tiltZ)
  resources.objects.push(cloud, cloudGroup)
  scene.add(cloudGroup)

  // Meteors (shader trails)
  const meteors = []
  // meteor shader: draw a trail fading from head (uv.x ~ 1) to tail (uv.x ~ 0)
  const meteorVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  const meteorFrag = `
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      float t = vUv.x; // along the length
      // head at t ~ 1.0, tail at 0.0
      float a = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t));
      a *= pow(t, 0.6); // bias toward the head
      gl_FragColor = vec4(color, a * opacity);
    }
  `
  const meteorProtoMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xfff4d9) }, opacity: { value: 1.0 } },
    vertexShader: meteorVert,
    fragmentShader: meteorFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  resources.materials.push(meteorProtoMat)

  function spawnMeteor() {
    // smaller variable length to make trails subtler
    const baseLength = 100 + Math.random() * 140
    const baseHeight = 1.0 + Math.random() * 1.6 // thinner trails
    const geo = new THREE.PlaneGeometry(baseLength, baseHeight)
    resources.geometries.push(geo)
  // clone material per meteor so we can fade independently and dispose later
  const mat = meteorProtoMat.clone()
  // give each meteor a slightly different initial opacity for variation
  const initOpacity = 0.6 + Math.random() * 0.4
  if (mat.uniforms && mat.uniforms.opacity) mat.uniforms.opacity.value = initOpacity
  resources.materials.push(mat)
  const m = new THREE.Mesh(geo, mat)
  // small per-meteor scale variance for more randomness, then enlarge by ~30%
  let sx = 0.6 + Math.random() * 1.4
  let sy = 0.6 + Math.random() * 1.0
  sx *= 1.3
  sy *= 1.3
  m.scale.set(sx, sy, 1)
    // spawn region: left (-1200 to -600), top (200 to 700), depth slightly varied
    m.position.set(-1200 + Math.random() * 700, 250 + Math.random() * 600, -900 + Math.random() * 800)
    const ang = 0.25 + Math.random() * 0.35 // ~0.25-0.6 radians
    // rotate so plane local +X corresponds to meteor head direction
    m.rotation.z = -ang
    scene.add(m)
    // lower speed and add variation
    const speed = 20 + Math.random() * 120
    const vx = Math.cos(ang)
    const vy = -Math.sin(ang)
    const vz = (Math.random() - 0.5) * 0.25
    const vel = new THREE.Vector3(vx * speed, vy * speed, vz * speed)
    // life depends on length/speed so fade feels natural; add jitter
    const life = Math.max(30, Math.floor((baseLength * sx) / (speed * 0.35))) + Math.floor(Math.random() * 40)
    meteors.push({ mesh: m, life, initialLife: life, vel, initOpacity })
    resources.objects.push(m)
  }

  function animate() {
    controls.update()
    // update shader time uniform for subtle twinkle/flicker
    const t = performance.now() * 0.001
    try {
      if (stars.material && stars.material.uniforms && stars.material.uniforms.uTime) stars.material.uniforms.uTime.value = t
    } catch (e) {}
    try {
      if (cloud.material && cloud.material.uniforms && cloud.material.uniforms.uTime) cloud.material.uniforms.uTime.value = t
    } catch (e) {}
    try {
      if (microCloud.material && microCloud.material.uniforms && microCloud.material.uniforms.uTime) microCloud.material.uniforms.uTime.value = t
    } catch (e) {}
    try {
      if (typeof filament !== 'undefined' && filament.material && filament.material.uniforms && filament.material.uniforms.uTime) filament.material.uniforms.uTime.value = t
    } catch (e) {}
    // update camera position uniforms for near-boosting cloud layers
    try {
      if (cloud.material && cloud.material.uniforms && cloud.material.uniforms.uCameraPos) cloud.material.uniforms.uCameraPos.value.copy(camera.position)
    } catch (e) {}
    try {
      if (microCloud.material && microCloud.material.uniforms && microCloud.material.uniforms.uCameraPos) microCloud.material.uniforms.uCameraPos.value.copy(camera.position)
    } catch (e) {}
    try {
      if (typeof microCore !== 'undefined' && microCore.material && microCore.material.uniforms && microCore.material.uniforms.uCameraPos) microCore.material.uniforms.uCameraPos.value.copy(camera.position)
    } catch (e) {}
    // much slower rotation to make the galaxy feel tranquil
    cloudGroup.rotation.y += 0.00028
    cloudGroup.rotation.x += 0.00003
    // reduce meteor frequency slightly
    if (Math.random() < 0.006) spawnMeteor()
    for (let i = meteors.length - 1; i >= 0; i--) {
      const o = meteors[i]
      o.mesh.position.add(o.vel)
      o.life -= 1
      // update material uniform opacity if available, scale by initial opacity so each meteor fades from its own starting alpha
      try {
        const lifeRatio = Math.max(0, (o.life / (o.initialLife || 100)))
        const curOpacity = (o.initOpacity || 1.0) * lifeRatio
        if (o.mesh.material && o.mesh.material.uniforms && o.mesh.material.uniforms.opacity) {
          o.mesh.material.uniforms.opacity.value = curOpacity
        } else if (o.mesh.material) {
          o.mesh.material.opacity = curOpacity
        }
      } catch (e) {}
      if (o.life <= 0) {
        scene.remove(o.mesh)
        try { if (o.mesh.geometry) o.mesh.geometry.dispose() } catch(e) {}
        try { if (o.mesh.material) o.mesh.material.dispose() } catch(e) {}
        meteors.splice(i, 1)
      }
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }

  animate()

  function onResize() {
    const W = container.clientWidth || window.innerWidth
    const H = container.clientHeight || window.innerHeight
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    renderer.setSize(W, H)
  }

  window.addEventListener('resize', onResize)

  // save references for cleanup
  resources._renderer = renderer
  resources._container = container
  resources._onResize = onResize
  resources._raf = () => raf
  resources._meteors = meteors
}

export function dispose() {
  if (resources._raf) {
    const id = resources._raf()
    if (id) cancelAnimationFrame(id)
  }
  if (resources._onResize) window.removeEventListener('resize', resources._onResize)
  if (resources._container && resources._renderer && resources._container.contains(resources._renderer.domElement)) {
    resources._container.removeChild(resources._renderer.domElement)
  }

  // dispose objects
  resources.objects.forEach(obj => {
    try {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    } catch (e) {
      // ignore
    }
    try { if (obj.parent) obj.parent.remove(obj) } catch (e) {}
  })

  resources.geometries.forEach(g => { try { g.dispose() } catch(e) {} })
  resources.materials.forEach(m => { try { if (m.dispose) m.dispose(); } catch(e) {} })

  // reset
  renderer = scene = camera = controls = raf = null
  resources = { objects: [], geometries: [], materials: [] }
}

export default { init, dispose }
