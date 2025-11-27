<template>
  <div class="background-root">
    <header class="bg-header">
      <h2>Background Demos</h2>
      <p class="muted">分类：背景 — 包含场景示例</p>
    </header>

    <main class="bg-list">
      <router-link class="bg-item" to="/tree">圣诞树 (Christmas Tree)</router-link>
      <router-link class="bg-item" to="/starry">星空 (Starry Sky)</router-link>
        <router-link class="bg-item" to="/background/firework">烟花 (Firework)</router-link>
    </main>
  </div>
</template>

<style scoped>
.background-root{padding:40px;display:flex;flex-direction:column;align-items:center;gap:18px}
.bg-header h2{margin:0}
.muted{color:#666}
.bg-list{display:flex;flex-direction:column;gap:12px;margin-top:8px}
.bg-item{padding:12px 18px;border-radius:8px;background:#f2f2f4;color:#111;text-decoration:none}
.bg-item:hover{opacity:.95}
</style>
