<script setup>
import { onMounted, ref } from 'vue'
import { Scene } from '../three/scene'
import { Renderer } from '../three/renderer'
import { Christmastreewithoutlight } from '../three/christmastreewithoutlight'

const container = ref(null)

onMounted(() => {
  const params = {
    粒子数量: 3000,
    粒子大小: 0.04,
    树高: 4,
    树宽: 2,
    旋转速度: 0.001,
    后期处理: {
      发光强度: 0.4,
      发光半径: 0.3,
      发光阈值: 0,
      曝光度: 1.0
    }
  }

  const sceneManager = new Scene(container.value)
  const renderer = new Renderer(container.value)

  renderer.setupPostProcessing(sceneManager.scene, sceneManager.camera, params)

  const tree = new Christmastreewithoutlight(sceneManager.scene, params)

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
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(180deg, #0b0b10, #0b0620);
}
</style>
