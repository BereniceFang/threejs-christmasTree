import * as THREE from 'three'
import particleVertexShader from '../shader/particle/vertex.glsl?raw'
import particleFragmentShader from '../shader/particle/fragment.glsl?raw'

export class SakuraCloudTree {
  constructor(scene, params = {}) {
    this.scene = scene
    // 根据用户视觉要求默认调参：更大树形、更多粒子、树干高 4、树冠直径 15
    // 放大为用户指定的巨型参数（注意：这会非常消耗渲染性能，建议在低配设备上降低粒子数或使用 GPU instancing）
    this.params = Object.assign({
      粒子数量: 120000,
      粒子大小: 1.0,
      云朵簇数: 3,
      冠层直径: 12000,
      花瓣数量: 5000,
      花瓣大小: 1.0,
      旋转速度: 0.0004,
      树干高: 5000,
      树干底径: 1500,
      树干顶径: 80,
      树冠高: 3000
    }, params)

  this.time = 0
    this.cloudPoints = []
    this.petals = null

  // 世界尺度缩放因子：把用户给的大尺寸参数缩放到场景相机可见范围
  // 例如：scale 0.001 将 5000 -> 5 个单位，这样与默认相机(near/far)匹配
  // 默认缩放放大到 0.01（5000 -> 50 单位），便于默认相机可以看到树
  this.scale = params.scale || 0.01

  this.particleTexture = this.createPetalTexture()

    this.createTrunkParticles()
    this.createCloudCrown()
    this.createPetals()
  }

  // 画一个类似花瓣的纹理：椭圆 + 渐变高光
  createPetalTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 128, 128)
    // 花瓣形状路径
    ctx.translate(64, 64)
    ctx.rotate(-0.5)
    ctx.beginPath()
    ctx.moveTo(0, -36)
    ctx.bezierCurveTo(30, -32, 40, 6, 0, 40)
    ctx.bezierCurveTo(-40, 6, -30, -32, 0, -36)
    ctx.closePath()
    // 渐变填充（深粉到粉白）
    const g = ctx.createLinearGradient(-20, -36, 20, 40)
    g.addColorStop(0, 'rgba(255,90,140,1)')
    g.addColorStop(0.6, 'rgba(255,200,230,0.95)')
    g.addColorStop(1, 'rgba(255,255,255,0.9)')
    ctx.fillStyle = g
    ctx.fill()
    // 外沿泛光
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(0, -4, 10, 0, -4, 48)
    glow.addColorStop(0, 'rgba(255,180,210,0.25)')
    glow.addColorStop(1, 'rgba(255,180,210,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(0, -4, 42, 42, 0, 0, Math.PI * 2)
    ctx.fill()
    const tex = new THREE.CanvasTexture(canvas)
    tex.encoding = THREE.sRGBEncoding
    return tex
  }

  // 用粒子勾勒树干轮廓，粒子密度随高度变化以模拟树皮纹理
  createTrunkParticles() {
    const old = this.scene.children.find((c) => c.name === 'sakuraCloudTrunkParticles')
    if (old) this.scene.remove(old)
  // 使用缩放因子将巨型尺寸转为相机可见的单位
  const height = this.params.树干高 * this.scale
  const bottomRadius = (this.params.树干底径 / 2) * this.scale
  const topRadius = (this.params.树干顶径 / 2) * this.scale
    // 粒子数按高度放大，注意性能：可视情况调小
    const segments = Math.min(120000, Math.floor(height * 12))

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(segments * 3)
    const colors = new Float32Array(segments * 3)
    const scales = new Float32Array(segments)

    for (let i = 0; i < segments; i++) {
      const i3 = i * 3
        // 粗糙树皮：用簇和枝桠使形状不规则
        // 更多粒子集中于中下部，h 的分布偏向底部
        const h = Math.pow(Math.random(), 0.7) * (height + 4 * this.scale)
        const t = Math.min(1, h / Math.max(0.0001, height))
        // 基础半径随高度收窄，再加随机簇偏移
        const radius = bottomRadius * (1 - t) + topRadius * t
        const angle = Math.random() * Math.PI * 2
        // 簇状偏移：在低部更粗糙，高部更平滑
        const clusterStrength = (1 - t) * 2.5 + Math.random() * 1.5
        const jitter = (Math.random() - 0.5) * clusterStrength * this.scale
        let x = Math.cos(angle) * (radius + jitter)
        let y = h
        let z = Math.sin(angle) * (radius + jitter)

        // 随机生成小枝桠（少量粒子会远离躯干一点）
        if (Math.random() < 0.035) {
          const protrude = 0.8 + Math.random() * 2.5
          const a2 = angle + (Math.random() - 0.5) * 0.6
          x += Math.cos(a2) * protrude * this.scale * (1 + (1 - t) * 6)
          z += Math.sin(a2) * protrude * this.scale * (1 + (1 - t) * 6)
          y += (Math.random() - 0.4) * 0.6 * this.scale
        }

        positions[i3] = x
        positions[i3 + 1] = y
        positions[i3 + 2] = z

        // 深棕色，并带随机亮暗以表现树皮纹理
        const brownBase = 0.28 + Math.random() * 0.2
        colors[i3] = brownBase * 0.35
        colors[i3 + 1] = brownBase * 0.22
        colors[i3 + 2] = brownBase * 0.16
        // 尺寸体现簇密度与视觉重量，靠近底部粒子略大
        scales[i] = (0.6 + Math.random() * 2.6) * (1 + (1 - t) * 3) * this.scale * 100.0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1))

    const material = new THREE.PointsMaterial({
  size: this.params.粒子大小 * 1.2 * this.scale * 100.0,
      map: this.particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending
    })

    const points = new THREE.Points(geometry, material)
    points.name = 'sakuraCloudTrunkParticles'
    points.position.y = 0
    this.scene.add(points)
    this.trunk = points
  }

  // 生成层次分明的云朵树冠（按层排列，层越高半径越小）
  createCloudCrown() {
  // 重新实现树冠：巨大伞状，分为底层/中层/顶层
  const layers = 3
  const total = this.params.粒子数量
  const crownDiameter = this.params.冠层直径 || 12000
  const baseRadius = (crownDiameter / 2) * this.scale
    // 将粒子按层分配，每层粒子数略不相等，中层稍多
    const layerCounts = []
    let remaining = total
    for (let l = 0; l < layers; l++) {
      const portion = Math.floor(total / layers * (0.8 + Math.random() * 0.6))
      layerCounts.push(portion)
      remaining -= portion
    }
    // 分配剩余到低层
    let li = 0
    while (remaining > 0) {
      layerCounts[li % layers] += 1
      remaining--
      li++
    }

  const trunkTopY = this.params.树干高 * this.scale
    // 从顶部向下布局层（顶层最小半径）
    // 分配：底层（最宽）占 55%，中层占 30%，顶层占 15%
    const fractions = [0.55, 0.30, 0.15]
    // 改为使用多个簇 (clusters)，每个簇为球形或椭球形体积分布，从而形成体积化云冠
    for (let l = 0; l < layers; l++) {
      const t = l / (layers - 1)
      const layerY = trunkTopY + (t * this.params.树冠高 * this.scale) - this.params.树冠高 * this.scale * 0.15
      const layerRadius = baseRadius * (1.0 - l * 0.28)
  // 每层的簇数量。增加底层簇以增强底部体积感
  const clusterCount = l === 0 ? 26 : (l === 1 ? 16 : 10)
  const particlesPerCluster = Math.max(256, Math.floor((total * fractions[l]) / clusterCount))
  // 增大簇尺寸随机范围以产生更多大小差异
  const clusterSizeMultiplier = 0.28 + Math.random() * 0.6

      for (let c = 0; c < clusterCount; c++) {
        const clusterGeo = new THREE.BufferGeometry()
        const positions = new Float32Array(particlesPerCluster * 3)
        const colors = new Float32Array(particlesPerCluster * 3)
        const scales = new Float32Array(particlesPerCluster)

        // 簇中心分布在冠层半径范围内（分布成伞形）
        const phi = Math.random() * Math.PI * 2
  const radialOffset = Math.pow(Math.random(), 0.6) * layerRadius * (0.3 + Math.random() * 0.9)
  const cx = Math.cos(phi) * radialOffset
  const cz = Math.sin(phi) * radialOffset
  // 显著增加垂直散布，使簇在垂直方向有更大错落，避免形成单一亮带
  const cy = layerY + (Math.random() - 0.5) * this.params.树冠高 * this.scale * 1.2

        // 每簇可能是近似球体或扁平椭球，随机决定
        const isFlatten = Math.random() < 0.45
        const clusterRadius = layerRadius * clusterSizeMultiplier * (0.6 + Math.random() * 0.9) * this.scale

  for (let i = 0; i < particlesPerCluster; i++) {
          const i3 = i * 3
          // 球体内均匀体积分布：使用立方根随机半径
          const u = Math.random()
          const r = Math.cbrt(u) * clusterRadius * (0.5 + Math.random() * 1.2)
          const theta = Math.acos(1 - Math.random()) // theta [0, PI]
          const psi = Math.random() * Math.PI * 2

          // 若为扁平椭球，则 y 轴缩小
          const localY = isFlatten ? Math.cos(theta) * r * 0.45 : Math.cos(theta) * r
          const localX = Math.sin(theta) * Math.cos(psi) * r
          const localZ = Math.sin(theta) * Math.sin(psi) * r

          positions[i3] = cx + localX + (Math.random() - 0.5) * this.scale * 1.2
          positions[i3 + 1] = cy + localY + (Math.random() - 0.5) * this.scale * 1.2
          positions[i3 + 2] = cz + localZ + (Math.random() - 0.5) * this.scale * 1.2

          // 粒子大小：靠近簇中心稍大以表现密度
          const depthBias = 1.0 - Math.min(1, radialOffset / Math.max(1e-6, layerRadius))
          scales[i] = (0.8 + Math.random() * 2.8) * (1.0 - Math.min(1, r / clusterRadius)) * (this.scale * 120.0) * (0.8 + depthBias * 0.9)

          // 颜色按层级分配，簇内有微随机
          let col
          if (l === 2) col = [0.95, 0.18 + Math.random() * 0.08, 0.36 + Math.random() * 0.08]
          else if (l === 1) col = [1.0, 0.86 + Math.random() * 0.07, 0.92 + Math.random() * 0.06]
          else col = [1.0, 1.0, 1.0]
          colors[i3] = col[0]
          colors[i3 + 1] = col[1]
          colors[i3 + 2] = col[2]
        }

        clusterGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        clusterGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        clusterGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1))

        // 根据簇在层中的半径偏移调整不透明度与粒子 size，使近簇更明显
  // 增强近簇权重，使靠近树顶/前景簇更突出
  const clusterDepthFactor = 0.5 + (1 - Math.min(1, radialOffset / Math.max(1e-6, layerRadius))) * 1.2
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            size: { value: this.params.粒子大小 * 1.6 * this.scale * 120.0 * clusterDepthFactor },
            opacity: { value: Math.min(0.9, (0.62 - l * 0.08) * (0.7 + clusterDepthFactor * 0.6)) },
            color: { value: new THREE.Color(0xffd7ea) },
            glowSize: { value: Math.max(0.8, 1.8 + l * 0.6) }
          },
          vertexShader: particleVertexShader,
          fragmentShader: particleFragmentShader,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          vertexColors: true
        })

        const points = new THREE.Points(clusterGeo, mat)
        points.name = `sakuraCluster_l${l}_c${c}`
        this.scene.add(points)
        this.cloudPoints.push(points)
      }
    }

  // 额外：创建核心高密度深粉粒子簇（位于树冠中心）
  const coreCount = Math.floor(total * 0.4)
    if (coreCount > 0) {
      const coreGeo = new THREE.BufferGeometry()
      const corePos = new Float32Array(coreCount * 3)
      const coreCol = new Float32Array(coreCount * 3)
      const coreScales = new Float32Array(coreCount)
  const coreRadius = Math.max(4 * this.scale, baseRadius * 0.08)
      for (let i = 0; i < coreCount; i++) {
        const i3 = i * 3
        const ang = Math.random() * Math.PI * 2
        const r = Math.pow(Math.random(), 0.25) * coreRadius * (0.2 + Math.random() * 0.8)
  corePos[i3] = Math.cos(ang) * r
  corePos[i3 + 1] = trunkTopY + this.params.树冠高 * this.scale * 0.6 + (Math.random() - 0.5) * 0.4 * this.scale
  corePos[i3 + 2] = Math.sin(ang) * r
  coreScales[i] = (0.5 + Math.random() * 0.6) * this.scale * 100.0
        // 深粉
        coreCol[i3] = 0.95
        coreCol[i3 + 1] = 0.18 + Math.random() * 0.06
        coreCol[i3 + 2] = 0.35 + Math.random() * 0.06
      }
      coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3))
      coreGeo.setAttribute('color', new THREE.BufferAttribute(coreCol, 3))
      coreGeo.setAttribute('scale', new THREE.BufferAttribute(coreScales, 1))
      const coreMat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          // 核心粒子更大以显示密集主体
          size: { value: this.params.粒子大小 * 2.8 * this.scale * 100.0 },
          opacity: { value: 0.7 },
          color: { value: new THREE.Color(0xff4f8f) },
          glowSize: { value: 3.2 }
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
      })
      const corePoints = new THREE.Points(coreGeo, coreMat)
      corePoints.name = 'sakuraCloudCore'
      this.scene.add(corePoints)
      this.cloudPoints.push(corePoints)
    }

    // 创建树冠底部淡灰色阴影（贴图圆盘）
    this.createGroundShadow(baseRadius)
  }

  createGroundShadow(radius) {
  const size = radius * 1.4 * this.scale
    const canvas = document.createElement('canvas')
    const dim = 1024
    canvas.width = dim
    canvas.height = dim
    const ctx = canvas.getContext('2d')
    const cx = dim / 2
    const cy = dim / 2
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dim / 2)
    grad.addColorStop(0, 'rgba(40,40,40,0.45)')
    grad.addColorStop(0.45, 'rgba(40,40,40,0.15)')
    grad.addColorStop(1, 'rgba(40,40,40,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, dim, dim)
    const tex = new THREE.CanvasTexture(canvas)
    tex.encoding = THREE.sRGBEncoding

  const geometry = new THREE.PlaneGeometry(size * 2, size * 2)
    const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false })
    const plane = new THREE.Mesh(geometry, material)
    plane.rotation.x = -Math.PI / 2
    plane.position.y = 0.01
    plane.name = 'sakuraCloudShadow'
    this.scene.add(plane)
  }

  // 花瓣为飘落粒子，CPU 更新位置（轻微旋转与摆动）
  createPetals() {
    const count = this.params.花瓣数量
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const angles = new Float32Array(count)

    const radius = ((this.params.冠层直径 || this.params.云朵半径 * 2) / 2) * this.scale
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // 将初始位置分布在树冠顶部附近
      positions[i3] = (Math.random() - 0.5) * radius * 1.2
      positions[i3 + 1] = this.params.树干高 * this.scale + this.params.树冠高 * this.scale * 0.6 + Math.random() * 0.6 * this.scale
      positions[i3 + 2] = (Math.random() - 0.5) * radius * 1.2
      // 慢速飘落，随机化较小以表现柔和轨迹
  speeds[i] = (0.002 + Math.random() * 0.008) * this.scale * 6.0
      angles[i] = Math.random() * Math.PI * 2
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.petalsSpeeds = speeds
    this.petalsAngles = angles
  this.petalsSpawnRadius = radius

    const material = new THREE.PointsMaterial({
  size: this.params.花瓣大小 * this.scale * 100.0,
      map: this.particleTexture,
      transparent: true,
      opacity: 0.65,
      color: 0xffb6d1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this.petals = new THREE.Points(geometry, material)
    this.petals.name = 'sakuraCloudPetals'
    this.scene.add(this.petals)
  }

  update() {
    this.time += 0.016

    // 云朵簇轻微漂浮、摆动与旋转
    for (let i = 0; i < this.cloudPoints.length; i++) {
      const p = this.cloudPoints[i]
      if (p && p.material && p.material.uniforms) {
        p.material.uniforms.time.value = this.time
        p.rotation.y += (0.0003 + i * 0.00005) + this.params.旋转速度
        p.position.y = Math.sin(this.time * 0.3 + i * 0.8) * 0.02
      }
    }

    // 让树干也有细微旋转，与云朵保持一致
    if (this.trunk) {
      this.trunk.rotation.y = Math.sin(this.time * 0.05) * 0.02
    }

    // 更新花瓣下落（带摆动）
    if (this.petals) {
      const positions = this.petals.geometry.attributes.position.array
      const count = positions.length / 3
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        // 软风：随着高度衰减的水平位移
        const windX = Math.sin(this.time * 0.2 + i) * 0.006
        const windZ = Math.cos(this.time * 0.18 + i * 0.9) * 0.005
        positions[i3 + 1] -= this.petalsSpeeds[i]
        positions[i3] += windX + Math.sin(this.time * 0.5 + this.petalsAngles[i]) * 0.0015
        positions[i3 + 2] += windZ + Math.cos(this.time * 0.45 + this.petalsAngles[i] * 0.7) * 0.0015

        // 从冠层顶部重生
        if (positions[i3 + 1] < 0) {
          const rspawn = this.petalsSpawnRadius * (0.6 + Math.random() * 0.8)
          positions[i3] = (Math.cos(Math.random() * Math.PI * 2) * rspawn)
          positions[i3 + 1] = this.params.树干高 + this.params.树冠高 * 0.6 + 0.2 + Math.random() * 0.8
          positions[i3 + 2] = (Math.sin(Math.random() * Math.PI * 2) * rspawn)
        }
      }
      this.petals.geometry.attributes.position.needsUpdate = true
    }
  }
}
