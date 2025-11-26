import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/**
 * 渲染器类
 * 负责创建和管理Three.js的WebGL渲染器
 */
export class Renderer {
  /**
   * @param {HTMLElement} container - 渲染器的容器元素
   */
  constructor(container) {
    // 创建WebGL渲染器，启用抗锯齿
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // 设置渲染器尺寸为窗口大小
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
  // 降低总体曝光，避免 bloom 过曝遮盖细节
  this.renderer.toneMappingExposure = 0.6
    // 将渲染器的canvas元素添加到容器中
    container.appendChild(this.renderer.domElement)

    // 后期处理相关属性
    this.composer = null
    this.renderPass = null
    this.bloomPass = null
    this.outputPass = null
  }

  /**
   * 设置后期处理效果
   * @param {THREE.Scene} scene - 要渲染的场景
   * @param {THREE.Camera} camera - 用于渲染的相机
   */
  setupPostProcessing(scene, camera, params) {
    // 创建渲染通道
    this.renderPass = new RenderPass(scene, camera)

    // 创建泛光通道
    // 使用更保守的默认值，避免过曝淹没粒子细节
    const bloomStrength = (params && params.后期处理 && typeof params.后期处理.发光强度 === 'number') ? params.后期处理.发光强度 : 0.28
    const bloomRadius = (params && params.后期处理 && typeof params.后期处理.发光半径 === 'number') ? params.后期处理.发光半径 : 0.35
    const bloomThreshold = (params && params.后期处理 && typeof params.后期处理.发光阈值 === 'number') ? params.后期处理.发光阈值 : 0.0
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomStrength, bloomRadius, bloomThreshold)

    // 创建输出通道
    this.outputPass = new OutputPass()

    // 创建效果组合器
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.outputPass)
  }

  /**
   * 处理窗口大小变化
   * 更新渲染器的尺寸
   */
  handleResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight)
    }
  }

  /**
   * 渲染场景
   * @param {THREE.Scene} scene - 要渲染的场景
   * @param {THREE.Camera} camera - 用于渲染的相机
   */
  render(scene, camera) {
    if (this.composer) {
      this.composer.render()
    } else {
      this.renderer.render(scene, camera)
    }
  }
}
