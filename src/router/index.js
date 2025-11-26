import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ChristmasTree from '../components/ChristmasTree.vue'
import Background from '../views/Background.vue'
import StarrySky from '../views/StarrySky.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  {
    path: '/background',
    name: 'Background',
    component: Background,
    children: [
      { path: 'tree', name: 'BackgroundTree', component: ChristmasTree },
      { path: 'starry', name: 'StarrySky', component: StarrySky }
    ]
  },
  { path: '/tree', name: 'ChristmasTree', component: ChristmasTree },
  { path: '/starry', name: 'StarrySky', component: StarrySky }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
