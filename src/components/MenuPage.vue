<template>
  <div class="menu">
    <h1>选择子页面</h1>
    <ul>
      <li v-for="p in pages" :key="p.id">
        <router-link :to="p.path"><button>{{ p.label }}</button></router-link>
      </li>
    </ul>
  </div>
</template>

<script setup>
const pages = [
  { id: 'christmas', label: 'Christmas Tree', path: '/christmas' },
  { id: 'christmastreewithoutlight', label: 'Christmas Tree (No Light)', path: '/christmastreewithoutlight' },
  { id: 'sakuracloud', label: 'Sakura Cloud Tree', path: '/sakuracloud' },
  { id: 'example', label: '示例子页面', path: '/example' }
]
</script>

<style scoped>
.menu { width: 100%; color: #fff; padding: 24px }
.menu button { padding: 10px 12px; margin: 8px 0; border-radius: 6px; border: none }
</style>
