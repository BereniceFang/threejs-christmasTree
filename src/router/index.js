import { createRouter, createWebHistory } from 'vue-router'
import ChristmasTree from '@/components/ChristmasTree.vue'
import PlaceholderPage from '@/components/PlaceholderPage.vue'
import Christmastreewithoutlight from '@/components/Christmastreewithoutlight.vue'
import SakuraCloudTree from '@/components/SakuraCloudTree.vue'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/components/MenuPage.vue') },
  { path: '/christmas', name: 'Christmas', component: ChristmasTree },
  { path: '/christmastreewithoutlight', name: 'Christmastreewithoutlight', component: Christmastreewithoutlight },
  { path: '/sakuracloud', name: 'SakuraCloud', component: SakuraCloudTree },
  { path: '/example', name: 'Example', component: PlaceholderPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
