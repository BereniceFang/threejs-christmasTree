<template>
  <div class="firework-root" ref="container">
    <div class="ui">
        <button @click="startShow">开始烟花</button>
        <button @click="stopShow">停止</button>
    <button @click="launchPompomManual">花球烟花</button>
    </div>
    <!-- castle image positioned at center-bottom so fireworks appear above it -->
    <img src="/src/assets/castle.webp" class="foreground-castle" alt="castle" />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const container = ref(null)
let renderer, scene, camera, clock
let rockets = [] // ascending sparks
let particles = [] // explosion particles
let rafId = null
let running = true

// Predefined bi-color palettes (inner, outer)
const BI_COLOR_PALETTES = [
  [ new THREE.Color(0x3aa0ff), new THREE.Color(0xff9a3a) ], // blue / orange
  [ new THREE.Color(0x9fe6a5), new THREE.Color(0xffd36b) ], // pale green / warm yellow
  [ new THREE.Color(0xff6bcb), new THREE.Color(0x6bffb8) ], // pink / mint
  [ new THREE.Color(0x8cc9ff), new THREE.Color(0xff8b6b) ], // light blue / coral
  [ new THREE.Color(0xd8a6ff), new THREE.Color(0xffe08a) ]  // lavender / soft gold
]

function rand(min, max) { return Math.random() * (max - min) + min }
// create a circular texture for particles
let circleTexture = null
function createCircleTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  // sharpen the sprite: stronger core, quicker falloff to reduce overlapping soft tails that look like lines
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.15, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.35, 'rgba(255,200,180,0.7)')
  grad.addColorStop(0.6, 'rgba(255,0,0,0.12)')
  grad.addColorStop(1, 'rgba(255,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0,0,size,size)
  return new THREE.CanvasTexture(canvas)
}

class FireworkParticle {
  constructor(pos, color, opts = {}) {
    this.position = pos.clone()
    // default physics values
    const speed = opts.speed ?? rand(80, 420)
    this.color = opts.color ?? new THREE.Color().setHSL(Math.random(), 0.85, 0.45)
    this.shape = opts.shape || null
    // optional: if caller provides a direction vector, use it
    this.makeTrail = opts.makeTrail || false
    this.trailTimer = 0
  // spherical coordinates: theta (azimuth) and phi (polar)
  const theta = rand(0, Math.PI * 2)
  const phi = Math.acos(rand(-1,1))
  let dir = new THREE.Vector3(Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi))
    if (opts.dir && opts.dir.isVector3) {
      dir = opts.dir.clone().normalize()
    }
    this.velocity = dir.multiplyScalar(speed)
    this.life = opts.life ?? rand(1.2, 2.8)
    this.age = 0
    this.color = color.clone()
    // boost initial brightness for explosion particles
    this.color.multiplyScalar(1.5)
  // normal particle defaults
    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.PointsMaterial({
      size: opts.size ?? 6.4,
      color: this.color,
      map: circleTexture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      alphaTest: 0.15
    })
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([this.position.x, this.position.y, this.position.z], 3))
    this.points = new THREE.Points(this.geometry, this.material)
    scene.add(this.points)
  }
  update(dt) {
    this.age += dt
    // special handling for clover-contour particles: anchored scaling (no radial diffusion)
    if (this.isClover) {
      // growth phase: interpolate scale from startScale -> targetScale over growthDuration
  const growthDur = this.growthDuration || 0.7
  const rawT = Math.min(this.age / growthDur, 1)
  // ease-out cubic for more natural fireworks expansion (fast start, slow end)
  const growT = 1 - Math.pow(1 - rawT, 3)
  const curScale = (this.startScale ?? 0) + ((this.targetScale ?? 1) - (this.startScale ?? 0)) * growT
      // base position follows the anchored rel vector (rel is target-position at full scale)
      const center = this.center || new THREE.Vector3(0,0,0)
      const rel = (this.rel && this.rel.clone()) || new THREE.Vector3(0,0,0)
      const pos = center.clone().add(rel.multiplyScalar(curScale))
      // after growth phase, particles fall vertically but do not diffuse radially
      if (this.age > growthDur) {
        const fall = (this.age - growthDur) * (this.cloverFallSpeed ?? 30)
        pos.y -= fall
      }
      this.position.copy(pos)
      // simple linear fade across life
  const t = Math.min(this.age / this.life, 1)
  // faster fade for clover particles to avoid lingering pause
  this.material.opacity = Math.max(0, 1 - t * 1.6)
      this.geometry.attributes.position.array[0] = this.position.x
      this.geometry.attributes.position.array[1] = this.position.y
      this.geometry.attributes.position.array[2] = this.position.z
      this.geometry.attributes.position.needsUpdate = true
      if (this.age >= this.life) {
        scene.remove(this.points)
        try { this.geometry.dispose() } catch(e){}
        try { this.material.dispose() } catch(e){}
        return false
      }
      return true
    }

    // physics-driven particle behavior
    this.velocity.y -= 200 * dt
    this.velocity.multiplyScalar(0.995)
    this.position.addScaledVector(this.velocity, dt)
    // optional trail spawning for fast streak-like particles
    if (this.makeTrail) {
      this.trailTimer += dt
      if (this.trailTimer > 0.02) {
        this.trailTimer = 0
        try {
          const t = new TrailParticle(this.position, this.color)
          particles.push(t)
        } catch (e) {}
      }
    }
    const t = this.age / this.life
    this.material.opacity = Math.max(0, 1 - t * 1.1)
    this.geometry.attributes.position.array[0] = this.position.x
    this.geometry.attributes.position.array[1] = this.position.y
    this.geometry.attributes.position.array[2] = this.position.z
    this.geometry.attributes.position.needsUpdate = true
    if (this.age >= this.life) {
      scene.remove(this.points)
      try { this.geometry.dispose() } catch(e){}
      try { this.material.dispose() } catch(e){}
      return false
    }
    return true
  }
}

class TrailParticle {
  constructor(pos, color) {
    this.position = pos.clone()
    // trail particles inherit a bit of the parent's position and slowly fade
    this.velocity = new THREE.Vector3(rand(-10,10), rand(-20,10), 0)
    this.life = rand(0.14, 0.5)
    this.age = 0
    this.color = color.clone().multiplyScalar(0.8)
    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.PointsMaterial({
      size: 3.2,
      color: this.color,
      map: circleTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      alphaTest: 0.15
    })
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([this.position.x, this.position.y, this.position.z], 3))
    this.points = new THREE.Points(this.geometry, this.material)
    scene.add(this.points)
  }
  update(dt) {
    this.velocity.y -= 80 * dt
    this.velocity.multiplyScalar(0.99)
    this.position.addScaledVector(this.velocity, dt)
    this.age += dt
    const t = this.age / this.life
    this.material.opacity = Math.max(0, 0.8 * (1 - t))
    this.geometry.attributes.position.array[0] = this.position.x
    this.geometry.attributes.position.array[1] = this.position.y
    this.geometry.attributes.position.array[2] = this.position.z
    this.geometry.attributes.position.needsUpdate = true
    if (this.age >= this.life) {
      scene.remove(this.points)
      try { this.geometry.dispose() } catch(e){}
      try { this.material.dispose() } catch(e){}
      return false
    }
    return true
  }
}

class Rocket {
  constructor(posX, opts = {}) {
    this.position = new THREE.Vector3(posX, -window.innerHeight/2 + 100, 0)
    this.velocity = new THREE.Vector3(rand(-20,20), rand(700,900), 0)
    this.lightness = 0.1
    this.color = opts.color ?? new THREE.Color().setHSL(Math.random(), 0.85, 0.45)
    this.shape = opts.shape || null
    this.alive = true
    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.PointsMaterial({
      size: 9.6,
      color: this.color,
      map: circleTexture,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      sizeAttenuation: false,
      alphaTest: 0.15
    })
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([this.position.x, this.position.y, this.position.z], 3))
    this.points = new THREE.Points(this.geometry, this.material)
    scene.add(this.points)
    this.trailTimer = 0
  }
  update(dt) {
    // gravity
    this.velocity.y -= 980 * dt
    // air drag
    this.velocity.multiplyScalar(0.999)
    this.position.addScaledVector(this.velocity, dt)
    this.geometry.attributes.position.array[0] = this.position.x
    this.geometry.attributes.position.array[1] = this.position.y
    this.geometry.attributes.position.array[2] = this.position.z
    this.geometry.attributes.position.needsUpdate = true
    // brighten slightly while ascending
    this.material.opacity = 0.2 + Math.min(0.9, this.material.opacity + dt * 0.6)

    // spawn trail particles periodically
    this.trailTimer += dt
    if (this.trailTimer > 0.02) {
      this.trailTimer = 0
      const t = new TrailParticle(this.position, this.color)
      particles.push(t) // reuse particles array for easy update
    }

    if (this.velocity.y < 200) {
      // explode with increased, randomized count
      this.alive = false
      explode(this.position, this.color, this.shape)
      scene.remove(this.points)
    }
  }
  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

function explode(position, color, shape = null) {
  // increase explosion particles by at least 2x and randomness
  const base = Math.floor(rand(80, 220))
  const extra = Math.floor(rand(0, base * 0.8))
  const count = base + extra
  // localized flash near explosion
  try { localFlash(position, color, Math.min(0.92, 0.18 + count / 480), 220, count) } catch(e) {}
  // standard explosion
  if (shape === 'clover') {
    explodeClover(position, color, count)
    return
  }
  if (shape === 'bicolor') {
    explodeBicolor(position, color, count)
    return
  }
  if (shape === 'pompom') {
    explodePompom(position, color, count)
    return
  }
  for (let i = 0; i < count; i++) {
    const p = new FireworkParticle(position, color, { size: rand(3.2,8), life: rand(1.0, 3.2), speed: rand(80, 520) })
    particles.push(p)
  }
}

function explodeClover(position, color, count) {
  // Parameters
  const startDiameterPx = 50 // initial small diameter
  const targetDiameterPx = rand(300, 900) // random final diameter (reduced to make clover smaller)
  const baseRadius = targetDiameterPx / 2
  // Reduce per-petal sample density so the contour doesn't look like a continuous line.
  // Use fewer samples but add a small perpendicular jitter to give the contour some thickness.
  const perPetal = Math.max(12, Math.floor(count / 10))
  const samples = perPetal * 4
  // sample heart curve densely and compute cumulative arc length
  const pts = []
  // sample the heart curve at moderate resolution and then resample by arc-length
  const N = 1024
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const hx = 16 * Math.pow(Math.sin(t), 3)
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push({ t, hx, hy })
  }
  // compute positions scaled to target diameter
  // compute actual max radius of the sampled heart to normalize precisely
  const rawPositions = pts.map(p => new THREE.Vector3(p.hx, p.hy, 0))
  let maxR = 0
  for (let v of rawPositions) maxR = Math.max(maxR, v.length())
  const scale = baseRadius / maxR
  const positions = rawPositions.map(v => v.clone().multiplyScalar(scale))
  // cumulative lengths
  const cum = [0]
  for (let i = 1; i < positions.length; i++) {
    cum.push(cum[i-1] + positions[i].distanceTo(positions[i-1]))
  }
  // close loop (distance from last to first)
  const wrapDist = positions[0].distanceTo(positions[positions.length - 1])
  cum.push(cum[cum.length - 1] + wrapDist)
  // append first position to facilitate interpolation across wrap
  positions.push(positions[0].clone())
  const totalLen = cum[cum.length - 1]
  // function to get point at arc-length s via linear lookup
  function pointAt(s) {
    // wrap s into [0, totalLen)
    s = ((s % totalLen) + totalLen) % totalLen
    // binary search
    let lo = 0, hi = cum.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (cum[mid] < s) lo = mid + 1
      else hi = mid
    }
    const i = Math.max(1, lo)
    const s0 = cum[i-1], s1 = cum[i]
    const f = (s - s0) / (s1 - s0 || 1)
    return positions[i-1].clone().lerp(positions[i], f)
  }

  // generate samples distributed evenly along the full heart curve, then rotate per petal
  const startScale = startDiameterPx / targetDiameterPx
  const growthDuration = rand(0.5, 1.5)
  // shorten the post-growth life so clover disappears faster (reduce lingering)
  const lifeExtra = 0.45

  // remove existing non-clover particles near explosion so only clover edge remains
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]
    if (q && !q.isClover) {
      const dx = (q.position.x || 0) - position.x
      const dy = (q.position.y || 0) - position.y
      if (Math.sqrt(dx*dx + dy*dy) < baseRadius * 1.05) {
        // remove and dispose
        try { scene.remove(q.points) } catch(e) {}
        try { q.geometry && q.geometry.dispose() } catch(e) {}
        try { q.material && q.material.dispose() } catch(e) {}
        particles.splice(i, 1)
      }
    }
  }
  // Sample the full heart contour evenly by arc-length but at reduced density.
  const contourSamples = []
  const totalSamples = Math.max(64, perPetal * 1)
  for (let i = 0; i < totalSamples; i++) {
    const s = (i + 0.5) * (totalLen / totalSamples)
    contourSamples.push(pointAt(s))
  }

  // find tip point in the original positions (minimum y)
  let tipIndex = 0
  let minY = Infinity
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].y < minY) { minY = positions[i].y; tipIndex = i }
  }
  const tipVec = positions[tipIndex].clone()

  // Create 4 identical hearts by translating so the tip is at the center, then rotating for each quadrant.
  // pick a random final scale factor (reduced) to limit maximum size while keeping randomness
  const finalScaleFactor = rand(0.15, 0.18) // reduced max size to shrink clover overall
  // For each petal, create fewer particles and add a small perpendicular jitter to each
  // sample so the contour appears with thickness instead of a single-pixel line.
  for (let pet = 0; pet < 4; pet++) {
    const baseAngle = - pet * Math.PI / 2
    const cosA = Math.cos(baseAngle), sinA = Math.sin(baseAngle)
    for (let i = 0; i < contourSamples.length; i++) {
      // shift sample so heart's tip maps to origin and rotate to petal orientation
      const raw = contourSamples[i].clone()
      const shifted = raw.clone().sub(tipVec)
      const rx = shifted.x * cosA - shifted.y * sinA
      const ry = shifted.x * sinA + shifted.y * cosA
      const rel = new THREE.Vector3(rx, ry, 0)

      // compute a small perpendicular jitter in heart-space to give contour thickness
      // tangent approximation: small offset along curve
      const ds = totalLen / (totalSamples * 8 + 1)
      const forward = pointAt(((i + 1) + 0.5) * (totalLen / totalSamples))
      const backward = pointAt(((i - 1 + totalSamples) + 0.5) * (totalLen / totalSamples))
      const tang = forward.clone().sub(backward)
      // perpendicular (normal) in 2D
      const norm = new THREE.Vector3(-tang.y, tang.x, 0).normalize()
      // jitter amount in pixels scaled to the target diameter - small value so petals stay crisp
      const jitterPx = rand(-6, 6)
      const jitter = norm.multiplyScalar(jitterPx * (baseRadius / targetDiameterPx) * 2)
      rel.add(jitter)

      const initialPos = new THREE.Vector3(position.x, position.y, 0).add(rel.clone().multiplyScalar(startScale))
      // slightly smaller sizes and small per-particle scale variance
  const pSize = rand(2.4, 5.12)
      const p = new FireworkParticle(initialPos, color, { size: pSize, life: growthDuration + lifeExtra, speed: 0 })
      p.isClover = true
      p.center = position.clone()
      p.rel = rel.clone()
      p.startScale = startScale
      // give each particle tiny variation in final scale so the edge looks organic
      p.targetScale = finalScaleFactor * rand(0.92, 1.12)
      p.growthDuration = growthDuration
      p.cloverFallSpeed = 30
      particles.push(p)
    }
  }
}

function explodeBicolor(position, color, count) {
  // Create an inner core and an outer ring with different colors.
  // Determine split ratio: proportion of particles in the inner core.
  const innerRatio = 0.28 // ~28% particles in the bright core
  const innerCount = Math.max(8, Math.floor(count * innerRatio))
  const outerCount = Math.max(8, count - innerCount)

  // pick a random palette and optionally flip it to increase variety
  const pal = BI_COLOR_PALETTES[Math.floor(Math.random() * BI_COLOR_PALETTES.length)]
  let innerColor = pal[0].clone()
  let outerColor = pal[1].clone()
  if (Math.random() < 0.22) { // ~22% chance to flip inner/outer
    const tmp = innerColor; innerColor = outerColor; outerColor = tmp
  }
  // slight random perturbation to hue/brightness for organic variation
  innerColor.offsetHSL(rand(-0.02, 0.02), rand(-0.04, 0.04), rand(-0.06, 0.06))
  outerColor.offsetHSL(rand(-0.02, 0.02), rand(-0.04, 0.04), rand(-0.06, 0.06))
  innerColor.multiplyScalar(1.5)

  // localized flash uses the inner color for perceived brightness
  try { localFlash(position, innerColor, Math.min(0.96, 0.2 + count / 420), 260, count) } catch(e) {}

  // inner particles: compact, slower and smaller (half-size overall)
  for (let i = 0; i < innerCount; i++) {
    const speed = rand(5, 60)
    const life = rand(0.6, 1.2)
  const size = rand(2.56, 4.48)
    const p = new FireworkParticle(position, innerColor, { size, life, speed })
    particles.push(p)
  }

  // outer particles: generate directional spikes (streaks) to match attachment image.
  // create several long spikes; each spike will spawn a stream of trail particles
  // increase number of long spikes (more, thinner rays)
  const spikeCount = Math.max(20, Math.floor(outerCount / 4))
  for (let s = 0; s < spikeCount; s++) {
    const angle = (s / spikeCount) * Math.PI * 2 + rand(-0.06, 0.06)
    const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 0.9 + rand(-0.12, 0.12), Math.sin(angle) * rand(-0.08,0.08)).normalize()
    const spikesPer = Math.max(2, Math.floor(outerCount / spikeCount))
    for (let k = 0; k < spikesPer; k++) {
      // reduce speed & size roughly by half to shrink overall visual scale
      const speed = rand(120, 390)
      const life = rand(0.45, 0.9)
  const size = rand(0.96, 2.08)
      const p = new FireworkParticle(position, outerColor, { size, life, speed, dir, makeTrail: true })
      particles.push(p)
    }
  }
}

function launchBicolorManual() {
  const x = rand(-window.innerWidth/2 + 50, window.innerWidth/2 - 50)
  // pick a random palette for the manual launcher so it shows variety
  const pal = BI_COLOR_PALETTES[Math.floor(Math.random() * BI_COLOR_PALETTES.length)]
  const baseColor = pal[0].clone()
  const r = new Rocket(x, { color: baseColor, shape: 'bicolor' })
  rockets.push(r)
}

function launchBicolor(x) {
  const pal = BI_COLOR_PALETTES[Math.floor(Math.random() * BI_COLOR_PALETTES.length)]
  const baseColor = pal[0].clone()
  const r = new Rocket(x, { color: baseColor, shape: 'bicolor' })
  rockets.push(r)
}

function explodePompom(position, color, count) {
  // Pompom: lots of radial spikes with slightly tapered ends. We'll create
  // N spikes and along each spike spawn a few particles with decreasing size.
  const spikeCount = Math.max(24, Math.floor(count / 8))
  const perSpike = Math.max(6, Math.floor(count / spikeCount))
  // pick palette (use existing palettes for variety)
  const pal = BI_COLOR_PALETTES[Math.floor(Math.random() * BI_COLOR_PALETTES.length)]
  const core = pal[0].clone().multiplyScalar(1.4)
  const tip = pal[1].clone()
  try { localFlash(position, core, Math.min(0.92, 0.18 + count / 480), 200, count) } catch(e) {}

  for (let s = 0; s < spikeCount; s++) {
    const angle = (s / spikeCount) * Math.PI * 2 + rand(-0.03, 0.03)
    // slight curvature factor so spikes are not perfectly straight
    const curve = rand(-0.06, 0.06)
    for (let j = 0; j < perSpike; j++) {
      const frac = (j + rand(0,0.6)) / perSpike
      const dist = frac * rand(180, 420) * 0.6 // control overall size
      const dir = new THREE.Vector3(Math.cos(angle + curve * frac), Math.sin(angle + curve * frac), rand(-0.03, 0.03)).normalize()
      const speed = dist * rand(0.8, 1.3)
      const life = Math.max(0.4, frac * 1.6)
  const size = Math.max(0.96, (1 - frac) * rand(2.56, 5.12))
      // color interpolation: near root use core, towards tip use tip color
      const c = core.clone().lerp(tip, frac * 0.9)
      const p = new FireworkParticle(position, c, { size, life, speed, dir, makeTrail: true })
      particles.push(p)
    }
  }
}

function launchPompomManual() {
  const x = rand(-window.innerWidth/2 + 50, window.innerWidth/2 - 50)
  const pal = BI_COLOR_PALETTES[Math.floor(Math.random() * BI_COLOR_PALETTES.length)]
  const baseColor = pal[0].clone()
  const r = new Rocket(x, { color: baseColor, shape: 'pompom' })
  rockets.push(r)
}

// end explode

function localFlash(worldPos, color, intensity = 0.6, duration = 200, count = 120) {
  const root = container.value
  if (!root) return
  // convert world (orthographic) position to screen coords relative to container
  const w = window.innerWidth
  const h = window.innerHeight
  const x = Math.round(worldPos.x + w/2)
  const y = Math.round(h/2 - worldPos.y)
  // size depends on explosion size
  const size = Math.min(320, 80 + Math.floor(count / 1.5))
  const el = document.createElement('div')
  el.className = 'flash-spot'
  // color string from THREE.Color
  const colorStr = color && typeof color.getStyle === 'function' ? color.getStyle() : 'rgb(255,255,255)'
  const rgba = colorStr.replace('rgb', 'rgba').replace(')', `, ${Math.min(1, intensity)})`)
  el.style.left = `${x - size/2}px`
  el.style.top = `${y - size/2}px`
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.background = `radial-gradient(circle at 50% 40%, ${rgba} 0%, rgba(0,0,0,0) 60%)`
  el.style.opacity = '1'
  el.style.pointerEvents = 'none'
  root.appendChild(el)
  // fade out
  requestAnimationFrame(() => {
    el.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`
    el.style.opacity = '0'
    el.style.transform = 'scale(1.2)'
  })
  setTimeout(() => { try { root.removeChild(el) } catch(e) {} }, duration + 40)
}

function initScene(root) {
  scene = new THREE.Scene()
  const w = window.innerWidth
  const h = window.innerHeight
  // ensure circle texture exists before creating any PointsMaterial
  if (!circleTexture) {
    circleTexture = createCircleTexture()
    circleTexture.minFilter = THREE.LinearFilter
    circleTexture.magFilter = THREE.LinearFilter
    circleTexture.needsUpdate = true
  }
  camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, -1000, 2000)
  camera.position.z = 1000
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(window.devicePixelRatio)
  root.appendChild(renderer.domElement)
  // background gradient via CSS on container
  clock = new THREE.Clock()
}

function animate() {
  const dt = clock.getDelta()
  // update rockets
  for (let i = rockets.length -1; i >=0; i--) {
    const r = rockets[i]
    r.update(dt)
    if (!r.alive) {
      r.dispose()
      rockets.splice(i,1)
    }
  }
  // update particles
  for (let i = particles.length -1; i >=0; i--) {
    const p = particles[i]
    const alive = p.update(dt)
    if (!alive) particles.splice(i,1)
  }
  renderer.render(scene, camera)
  if (running) rafId = requestAnimationFrame(animate)
}

function launchRocket(x) {
  const r = new Rocket(x)
  rockets.push(r)
}

function launchClover() {
  const x = rand(-window.innerWidth/2 + 50, window.innerWidth/2 - 50)
  const paleGreen = new THREE.Color(0x9fe6a5)
  const r = new Rocket(x, { color: paleGreen, shape: 'clover' })
  rockets.push(r)
}

function startShow() {
  running = true
  if (!rafId) animate()
  // spawn rockets regularly
  spawnInterval = setInterval(() => {
    const x = rand(-window.innerWidth/2 + 50, window.innerWidth/2 - 50)
    const r = Math.random()
    if (r < 0.3) {
      // 30% chance: bicolor
      launchBicolor(x)
    } else if (r < 0.42) {
      // 12% chance: pompom
      launchPompomManual()
    } else if (r < 0.45) {
      // 3% chance: clover
      launchClover()
    } else {
      // otherwise normal rocket
      launchRocket(x)
    }
  }, 400)
}

function stopShow() {
  running = false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  if (spawnInterval) clearInterval(spawnInterval)
}

// no launchClover

let spawnInterval = null

onMounted(() => {
  if (container.value) {
    initScene(container.value)
    startShow()
    window.addEventListener('resize', onResize)
  }
})

onBeforeUnmount(() => {
  stopShow()
  window.removeEventListener('resize', onResize)
  // dispose remaining
  rockets.forEach(r => { try { r.dispose() } catch(e){} })
  particles.forEach(p => { try { p.geometry.dispose(); p.material.dispose() } catch(e){} })
  if (renderer) {
    try { renderer.dispose() } catch (e) {}
    if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
})

function onResize() {
  if (!renderer || !camera) return
  const w = window.innerWidth
  const h = window.innerHeight
  camera.left = -w/2
  camera.right = w/2
  camera.top = h/2
  camera.bottom = -h/2
  camera.updateProjectionMatrix()
  renderer.setSize(w,h)
}
</script>

<style scoped>
.firework-root{position:fixed;inset:0;/* linear top->bottom darker gradient: black -> deep blue -> purple -> pink */
  background: linear-gradient(180deg,
    rgba(2,2,8,1) 0%,       /* near-black at very top */
    rgba(6,12,36,1) 28%,    /* deep navy */
    rgba(36,8,64,1) 60%,    /* deep purple */
    rgba(76,24,84,1) 78%,   /* slightly deeper purple for smoother transition */
    rgba(220,110,170,0.55) 100% /* desaturated, more transparent night pink at bottom */
  );
  overflow:hidden;
}
.firework-root .ui{position:fixed;left:18px;top:18px;display:flex;gap:8px;z-index:30}
.firework-root button{padding:8px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:#fff;backdrop-filter: blur(6px);cursor:pointer}
.flash-spot{position:absolute;border-radius:999px;mix-blend-mode:screen;filter:blur(10px);pointer-events:none;will-change:opacity,transform;z-index:20}
.foreground-castle{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:36%;max-width:820px;opacity:0.98;pointer-events:none;filter:drop-shadow(0 18px 28px rgba(0,0,0,0.7));z-index:25}
</style>
