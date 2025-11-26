import * as THREE from 'three'
import particleVertexShader from '../shader/particle/vertex.glsl?raw'
import particleFragmentShader from '../shader/particle/fragment.glsl?raw'

export class Christmastreewithoutlight {
  constructor(scene, params = {}) {
    this.scene = scene
    this.params = Object.assign({
      粒子数量: 3000,
      粒子大小: 0.04,
      树高: 4,
      树宽: 2.0,
      旋转速度: 0.001
    }, params)

    this.time = 0
    this.treePoints = null
    this.petals = null

    this.particleTexture = this.createCircleTexture()

    this.createTree()
    this.createPetals()
  }

  createCircleTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    const cx = 32, cy = 32, r = 18
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.6, 'rgba(255, 192, 203, 0.9)')
    grad.addColorStop(1, 'rgba(255, 192, 203, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    return new THREE.CanvasTexture(canvas)
  }

  createTree() {
    const count = this.params.粒子数量
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const scales = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const heightRatio = Math.random()
      const y = heightRatio * this.params.树高
      const radius = (1 - heightRatio) * this.params.树宽 * (0.6 + Math.random() * 0.6)
      const angle = Math.random() * Math.PI * 2
      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = y
      positions[i3 + 2] = Math.sin(angle) * radius

      scales[i] = Math.random() * 0.8 + 0.2

      // 粉色系颜色混合（保留用于微光）
      const r = 1.0
      const g = 0.6 + Math.random() * 0.25
      const b = 0.7 + Math.random() * 0.3
      colors[i3] = r
      colors[i3 + 1] = g
      colors[i3 + 2] = b
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        size: { value: this.params.粒子大小 },
        opacity: { value: 0.95 },
        color: { value: new THREE.Color(0xffb6c1) },
        glowSize: { value: 1.0 }
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    })

    this.treePoints = new THREE.Points(geometry, material)
    this.treePoints.name = 'christmastreewithoutlightParticles'
    this.scene.add(this.treePoints)
  }

  createPetals() {
    // 花瓣为飘落粒子，使用 CPU 更新位置
    const count = 800
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const rotations = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 12
      positions[i3 + 1] = Math.random() * 6 + 1
      positions[i3 + 2] = (Math.random() - 0.5) * 12
      speeds[i] = 0.01 + Math.random() * 0.005
      rotations[i] = Math.random() * Math.PI * 2
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.petalsSpeeds = speeds
    this.petalsRot = rotations

    const material = new THREE.PointsMaterial({
      size: 0.08,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.95,
      color: 0xffffff,
      depthWrite: false,
      blending: THREE.NormalBlending
    })

    this.petals = new THREE.Points(geometry, material)
    this.petals.name = 'christmastreewithoutlightPetals'
    this.scene.add(this.petals)
  }

  update() {
    this.time += 0.016
    if (this.treePoints && this.treePoints.material.uniforms) {
      this.treePoints.material.uniforms.time.value = this.time
      // optional: animate glowSize slightly
      if (this.treePoints.material.uniforms.glowSize) {
        this.treePoints.material.uniforms.glowSize.value = 0.8 + 0.2 * Math.sin(this.time * 0.5)
      }
      this.treePoints.rotation.y += this.params.旋转速度
    }

    // 更新花瓣位置
    if (this.petals) {
      const positions = this.petals.geometry.attributes.position.array
      const count = positions.length / 3
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        positions[i3 + 1] -= this.petalsSpeeds[i]
        positions[i3] += Math.sin(this.time * 0.5 + i) * 0.002
        positions[i3 + 2] += Math.cos(this.time * 0.45 + i * 0.7) * 0.002

        // 重置
        if (positions[i3 + 1] < -0.2) {
          positions[i3] = (Math.random() - 0.5) * 12
          positions[i3 + 1] = Math.random() * 6 + 4
          positions[i3 + 2] = (Math.random() - 0.5) * 12
        }
      }
      this.petals.geometry.attributes.position.needsUpdate = true
    }
  }
}
