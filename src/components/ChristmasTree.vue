<script setup>
import { onMounted, ref } from 'vue'
import { Scene } from '../three/scene'
import { Renderer } from '../three/renderer'
import { ChristmasTree } from '../three/christmasTree'
import { Controls } from '../three/controls'
// 用于存储Three.js渲染容器的引用
const container = ref(null)

onMounted(() => {
  // 定义场景参数配置对象
  const params = {
    粒子数量: 5000,      // 控制圣诞树粒子的数量
    粒子大小: 0.05,      // 控制单个粒子的大小
    闪耀大小: 0.7,       // 控制粒子的闪耀效果大小
  树高: 12,           // 控制圣诞树的高度（放大）
  树宽: 4,            // 控制圣诞树的宽度（放大）
    旋转速度: 0.002,     // 控制圣诞树的旋转速度
    透明度: 0.8,        // 控制粒子的透明度
    星星大小: 0.2,       // 控制顶部星星的大小
    星星颜色: '#ffff00', // 控制顶部星星的颜色
    后期处理: {
      发光强度: 0.5,     // 控制泛光效果的强度
      发光半径: 0.4,     // 控制泛光效果的扩散范围
      发光阈值: 0,       // 控制泛光效果的阈值
      曝光度: 1.0        // 控制整体场景的曝光程度
    }
  }

  // 创建场景管理器实例
  const sceneManager = new Scene(container.value)
  // 创建渲染器实例
  const renderer = new Renderer(container.value)

  // 设置后期处理效果
  renderer.setupPostProcessing(sceneManager.scene, sceneManager.camera, params)

  // 创建圣诞树实例
  const christmasTree = new ChristmasTree(sceneManager.scene, params)

  // 调整相机位置与控制器目标，使树在视口中占据更大比例
  // 将相机拉近以匹配树的尺寸范围（树高通常在 few units），让画面更饱满
  try {
  // compute camera distance so that the tree occupies ~80% of viewport height
  const treeHeight = params.树高 || 12
  const fov = sceneManager.camera.fov * (Math.PI / 180)
  // visible world height at distance d is: 2 * d * tan(fov/2)
  // we want treeHeight = 0.8 * visibleHeight => d = treeHeight / (2 * tan(fov/2) * 0.8)
  const desiredVisibleRatio = 0.8
  const distance = treeHeight / (2 * Math.tan(fov / 2) * desiredVisibleRatio)
  // place camera on z axis and slightly above center to frame tree nicely
  sceneManager.camera.position.set(0, treeHeight * 1.2, distance)
  sceneManager.camera.lookAt(0, treeHeight * 0.45, 0)
  sceneManager.controls.target.set(0, treeHeight * 0.45, 0)
    // 触发一次 resize 以确保渲染器/后期处理使用新的尺寸
    sceneManager.handleResize()
    renderer.handleResize()
  } catch (e) {
    // ignore if controls or camera not ready
  }

  // 创建控制面板，并设置各种参数变化时的回调函数
  // new Controls(params, renderer, sceneManager, {
  //   onTreeUpdate: () => christmasTree.createTree(),        // 树参数变化时重新创建树
  //   onStarUpdate: () => christmasTree.loadStar(),         // 星星参数变化时重新加载星星
  //   onParticleSize: () => (christmasTree.points.material.size = params.粒子大小),  // 更新粒子大小
  //   onOpacityChange: () => (christmasTree.points.material.opacity = params.透明度)  // 更新透明度
  // })

  // 定义动画循环函数
  const animate = () => {
    requestAnimationFrame(animate)  // 请求下一帧动画
    christmasTree.update()         // 更新圣诞树状态
    sceneManager.update()          // 更新场景状态
    renderer.render(sceneManager.scene, sceneManager.camera)  // 渲染场景
  }

  // 启动动画循环
  animate()

  // 监听窗口大小变化，更新渲染尺寸
  window.addEventListener('resize', () => {
    sceneManager.handleResize()
    renderer.handleResize()
  })
})
</script>

<template>
  <div>
    <div class="left-message">🍀Merry Christmas🍀</div>
    <div
      class="canvas-container"
      ref="container"
    ></div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');

.left-message {
  position: fixed;
  left: 40px;
  top: 15%;
  transform: translateY(-20%);
  color: #ffeef6;
  font-family: 'Great Vibes', cursive;
  font-size: 44px;
  letter-spacing: 1px;
  text-shadow: 0 0 8px rgba(255, 182, 193, 0.6), 0 0 16px rgba(255, 105, 180, 0.18);
  -webkit-font-smoothing: antialiased;
  z-index: 10;
  pointer-events: none; /* 不阻挡鼠标 */
}

.left-message.small {
  font-size: 30px;
}

.canvas-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #000;
}

@media (max-width: 600px) {
  .left-message { font-size: 36px; left: 16px; }
}
</style>
