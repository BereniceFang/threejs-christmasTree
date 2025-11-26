<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div id="app">
    <nav class="top-nav">
      <a @click.prevent="router.push('/')" class="logo">Home</a>
      <div class="links">
        <a @click.prevent="router.push('/background')">Background</a>
      </div>
    </nav>

    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.top-nav{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:transparent}
.logo{font-weight:700;cursor:pointer}
.links a{margin-left:12px;cursor:pointer;color:#333}
.app-main{min-height:calc(100vh - 56px)}
</style>
