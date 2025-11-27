<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const goTree = () => router.push({ name: 'ChristmasTree' })
const goBackground = () => router.push({ name: 'Background' })
const goStarry = () => router.push({ name: 'StarrySky' })
const goFirework = () => router.push({ name: 'Firework' })
</script>

<template>
  <div class="home-root">
    <header class="home-header">
      <h1>Minimal Navigation</h1>
      <p class="subtitle">A clean, flat landing page — choose a demo below</p>
    </header>

    <main class="home-main">
      <div class="button-row">
        <button class="primary" @click="goTree">Christmas Tree</button>
        <button class="primary outline" @click="goStarry">Starry Sky</button>
        <button class="primary outline" @click="goFirework">Firework</button>
      </div>
    </main>

    <footer class="home-footer">© 2025</footer>
  </div>
</template>

<style scoped>
.home-root{
  min-height:100vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:24px;
  background: linear-gradient(180deg,#f7f7f8,#ffffff);
  color:#111;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
}
.home-header h1{
  margin:0;
  font-size:28px;
  font-weight:600;
}
.subtitle{color:#666;margin-top:6px}
.home-main{display:flex;align-items:center;justify-content:center}
.button-row{display:flex;gap:20px}
.primary{padding:14px 28px;border-radius:12px;border:none;background:#0f1724;color:#fff;cursor:pointer;font-weight:700;box-shadow:0 6px 18px rgba(16,24,40,0.12);transition:transform .12s ease,box-shadow .12s ease}
.primary:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(16,24,40,0.16)}
.primary.outline{background:transparent;color:#0f1724;border:2px solid #0f1724}
.primary.outline:hover{background:#0f1724;color:#fff}
.home-footer{position:fixed;bottom:18px;color:#999;font-size:13px}
</style>
