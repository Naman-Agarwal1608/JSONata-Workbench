import { computed, onMounted, ref } from 'vue'

import type { WorkspaceFile } from '../types/workspace'
import { countByType, getChildren, normalizeWorkspace } from '../utils/workspace'

export function useWorkspace() {
  const workspace = ref<WorkspaceFile | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function loadWorkspace(url = './jsonata-demo-workspace.json') {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to load workspace (${response.status})`)
      workspace.value = normalizeWorkspace(await response.json())
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      workspace.value = null
    } finally {
      loading.value = false
    }
  }

  const nodes = computed(() => workspace.value?.nodes ?? [])
  const stats = computed(() => countByType(nodes.value))
  const rootNodes = computed(() => getChildren(nodes.value, null))
  const topLevelSections = computed(() =>
    rootNodes.value.flatMap(node => (node.type === 'folder' ? getChildren(nodes.value, node.id) : [node]))
  )

  onMounted(() => {
    void loadWorkspace()
  })

  return {
    workspace,
    nodes,
    stats,
    rootNodes,
    topLevelSections,
    loading,
    error,
    loadWorkspace
  }
}
