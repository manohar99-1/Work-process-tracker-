import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cascadeStatusUpdates, wouldCreateCycle } from '../lib/dependencyEngine'

export function useWorkItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('work_items')
      .select('*, assignee:profiles!assigned_to(id, name, email, skills), creator:profiles!created_by(id, name)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, refetch: fetch }
}

export function useDependencies() {
  const [deps, setDeps] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('dependencies')
      .select('*')
    setDeps(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { deps, loading, refetch: fetch }
}

export function useMembers() {
  const [members, setMembers] = useState([])

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => setMembers(data || []))
  }, [])

  return members
}

export async function createWorkItem(item) {
  const { data, error } = await supabase.from('work_items').insert(item).select().single()
  return { data, error }
}

export async function updateWorkItem(id, updates) {
  const { data, error } = await supabase.from('work_items').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteWorkItem(id) {
  const { error } = await supabase.from('work_items').delete().eq('id', id)
  return { error }
}

/**
 * Update progress and cascade status changes to downstream items.
 */
export async function updateProgressWithCascade(itemId, newProgress, allItems, allDeps) {
  // 1. Determine new status for the updated item
  let newStatus = newProgress >= 100 ? 'done' : undefined

  const updates = { progress: newProgress }
  if (newStatus) updates.status = newStatus

  // 2. Update the item
  const { error } = await supabase.from('work_items').update(updates).eq('id', itemId)
  if (error) return { error }

  // 3. Build updated items array for cascade calculation
  const updatedItems = allItems.map(i =>
    i.id === itemId ? { ...i, progress: newProgress, status: newStatus || i.status } : i
  )

  // 4. Cascade status updates
  const cascades = cascadeStatusUpdates(itemId, updatedItems, allDeps)

  for (const { id, newStatus: s } of cascades) {
    await supabase.from('work_items').update({ status: s }).eq('id', id)
  }

  return { error: null, cascades }
}

/**
 * Add a dependency with cycle detection.
 */
export async function addDependency(predecessorId, successorId, type, threshold, existingDeps) {
  // Validate threshold
  if (threshold < 1 || threshold > 100) {
    return { error: { message: 'Threshold must be between 1 and 100. A threshold of 0 would immediately unblock successors, making the dependency meaningless.' } }
  }

  // Cycle detection
  if (wouldCreateCycle(predecessorId, successorId, existingDeps)) {
    return { error: { message: 'This dependency would create a circular chain. Circular dependencies are not allowed.' } }
  }

  const { data, error } = await supabase
    .from('dependencies')
    .insert({ predecessor_id: predecessorId, successor_id: successorId, type, threshold })
    .select()
    .single()

  return { data, error }
}

export async function removeDependency(id) {
  const { error } = await supabase.from('dependencies').delete().eq('id', id)
  return { error }
}
