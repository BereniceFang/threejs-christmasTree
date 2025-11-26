<script setup>
import { onMounted, ref } from 'vue'
import * as THREE from 'three'
import { Scene } from '../three/scene'
import { Renderer } from '../three/renderer'
import { SakuraCloudTree } from '../three/sakuraCloudTree'

const container = ref(null)

onMounted(() => {
  const params = {
    粒子数量: 120000,
    粒子大小: 1.0,
    冠层直径: 12000,
    云朵簇数: 3,
    花瓣数量: 5000,
    花瓣大小: 1.0,
    旋转速度: 0.0004,
    树干高: 5000,
    树干底径: 1500,
    树干顶径: 80,
    树冠高: 3000,
    后期处理: {
      发光强度: 0.8,
      发光半径: 0.6,
      发光阈值: 0.0,
      曝光度: 1.1,
      边缘光晕颜色: 0xffb6d5
    }
  }

  const sceneManager = new Scene(container.value)
  // 设置梦幻背景与白色雾气（浅蓝渐变 + 白雾）
  sceneManager.scene.fog = new THREE.FogExp2(0xffffff, 0.00018)
  const renderer = new Renderer(container.value)

  renderer.setupPostProcessing(sceneManager.scene, sceneManager.camera, params)

  const tree = new SakuraCloudTree(sceneManager.scene, params)

  const animate = () => {
    requestAnimationFrame(animate)
    tree.update()
    sceneManager.update()
    renderer.render(sceneManager.scene, sceneManager.camera)
  }

  animate()

  window.addEventListener('resize', () => {
    sceneManager.handleResize()
    renderer.handleResize()
  })
})
</script>

<template>
  <div>
    <div class="canvas-container" ref="container"></div>
    <div class="soft-top-glow"></div>
  </div>
</template>

<style scoped>
/* 软顶光环，用于顶部柔光 */
.soft-top-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28vh;
  pointer-events: none;
  background: radial-gradient(circle at 50% 0%, rgba(255,240,250,0.65), rgba(255,240,250,0) 60%);
  mix-blend-mode: screen;
}

/* 调整为更梦幻的浅蓝渐变 + 白色雾气覆盖 */
.canvas-container {
  width:100vw;
  height:100vh;
  position:fixed;
  top:0;
  left:0;
  background: linear-gradient(180deg, #e9f7ff 0%, #d8efff 40%, #cfe8ff 100%);
}
.canvas-container::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45), rgba(255,255,255,0.0) 40%);
  mix-blend-mode: screen;
}

</style>
