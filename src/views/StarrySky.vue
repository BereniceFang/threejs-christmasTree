<template>
  <div class="starry-root" ref="container"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import starry from '../lib/starrySky'

const container = ref(null)

onMounted(() => {
  if (container.value) starry.init(container.value)
})

onBeforeUnmount(() => {
  try { starry.dispose() } catch (e) { /* ignore */ }
})
</script>

<style scoped>
.starry-root { position: fixed; inset: 0; background: radial-gradient(ellipse at bottom, #000011 0%, #000 60%); color: #fff; display:flex; align-items:center; justify-content:center; }
</style>
