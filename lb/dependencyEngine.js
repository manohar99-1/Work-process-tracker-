/**
 * NestUp Dependency Engine
 * 
 * Handles:
 * - Cycle detection using iterative DFS
 * - Partial vs Full dependency evaluation
 * - Cascade unblock when predecessor threshold is met
 * - Overload detection for members
 */

/**
 * Build adjacency list from dependencies array
 * direction: 'forward' = predecessor→successor, 'backward' = successor→predecessor
 */
export function buildGraph(dependencies, direction = 'forward') {
  const graph = {}
  for (const dep of dependencies) {
    const from = direction === 'forward' ? dep.predecessor_id : dep.successor_id
    const to = direction === 'forward' ? dep.successor_id : dep.predecessor_id
    if (!graph[from]) graph[from] = []
    graph[from].push(to)
  }
  return graph
}

/**
 * Detect if adding a new edge (from → to) would create a cycle.
 * Uses iterative DFS starting from `to`, looking for `from`.
 * 
 * If we can reach `from` by following edges from `to`,
 * then adding from→to would create a cycle.
 * 
 * @param {string} from - predecessor_id (new edge start)
 * @param {string} to   - successor_id (new edge end)
 * @param {Array}  existingDeps - current dependencies array
 * @returns {boolean} true if cycle would be created
 */
export function wouldCreateCycle(from, to, existingDeps) {
  // Edge case: self-loop
  if (from === to) return true

  const graph = buildGraph(existingDeps, 'forward')

  // DFS from `to` — if we can reach `from`, adding from→to = cycle
  const visited = new Set()
  const stack = [to]

  while (stack.length > 0) {
    const node = stack.pop()
    if (node === from) return true
    if (visited.has(node)) continue
    visited.add(node)
    const neighbors = graph[node] || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor)
      }
    }
  }

  return false
}

/**
 * Determine the correct status for a work item based on its dependencies.
 * 
 * Rules:
 * - If ANY dependency is not yet met → 'blocked'
 * - If all dependencies met AND item was blocked → 'in-progress'
 * - If item is 'done' → stays 'done'
 * 
 * A dependency is "met" when:
 * - type === 'full'    → predecessor.progress === 100 (or status === 'done')
 * - type === 'partial' → predecessor.progress >= threshold
 * 
 * @param {string} itemId
 * @param {Array}  allItems       - all work items [{id, progress, status}]
 * @param {Array}  allDeps        - all dependencies [{predecessor_id, successor_id, type, threshold}]
 * @returns {'blocked'|'in-progress'|null} null means no change needed
 */
export function computeStatus(itemId, allItems, allDeps) {
  const item = allItems.find(i => i.id === itemId)
  if (!item || item.status === 'done') return null

  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]))

  // Find all dependencies where this item is the SUCCESSOR
  const incomingDeps = allDeps.filter(d => d.successor_id === itemId)

  if (incomingDeps.length === 0) {
    // No dependencies — should be in-progress (if not already done)
    return item.status === 'blocked' ? 'in-progress' : null
  }

  // Check each dependency
  for (const dep of incomingDeps) {
    const predecessor = itemMap[dep.predecessor_id]
    if (!predecessor) continue

    const met = dep.type === 'full'
      ? predecessor.progress >= 100
      : predecessor.progress >= dep.threshold

    if (!met) return 'blocked'
  }

  // All dependencies met
  return item.status === 'blocked' ? 'in-progress' : null
}

/**
 * Cascade: after updating a work item's progress,
 * find all successors that might need status changes.
 * Returns array of {id, newStatus} updates to apply.
 * 
 * @param {string} updatedItemId
 * @param {Array}  allItems
 * @param {Array}  allDeps
 * @returns {Array} [{id, newStatus}]
 */
export function cascadeStatusUpdates(updatedItemId, allItems, allDeps) {
  const updates = []
  const visited = new Set()
  const queue = [updatedItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Find all successors of current item
    const successorDeps = allDeps.filter(d => d.predecessor_id === currentId)

    for (const dep of successorDeps) {
      const successorId = dep.successor_id
      const newStatus = computeStatus(successorId, allItems, allDeps)

      if (newStatus !== null) {
        updates.push({ id: successorId, newStatus })
        // Propagate further downstream
        queue.push(successorId)
      }
    }
  }

  return updates
}

/**
 * Get all work items that are directly blocking a given item.
 * @param {string} itemId
 * @param {Array}  allItems
 * @param {Array}  allDeps
 * @returns {Array} blocking work items with dependency info
 */
export function getBlockers(itemId, allDeps, allItems) {
  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]))
  const incomingDeps = allDeps.filter(d => d.successor_id === itemId)

  return incomingDeps
    .map(dep => {
      const predecessor = itemMap[dep.predecessor_id]
      if (!predecessor) return null
      const met = dep.type === 'full'
        ? predecessor.progress >= 100
        : predecessor.progress >= dep.threshold
      return { ...predecessor, dep, isBlocking: !met }
    })
    .filter(Boolean)
}

/**
 * Get all items that this item is blocking (directly or transitively).
 * @param {string} itemId
 * @param {Array}  allDeps
 * @param {Array}  allItems
 * @returns {Array} downstream items
 */
export function getDownstream(itemId, allDeps, allItems) {
  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]))
  const graph = buildGraph(allDeps, 'forward')
  const visited = new Set()
  const result = []
  const stack = [itemId]

  while (stack.length > 0) {
    const node = stack.pop()
    if (visited.has(node)) continue
    visited.add(node)
    const neighbors = graph[node] || []
    for (const n of neighbors) {
      if (!visited.has(n) && itemMap[n]) {
        result.push(itemMap[n])
        stack.push(n)
      }
    }
  }

  return result
}

/**
 * Detect overloaded members.
 * A member is overloaded if they have > 3 active (non-done) work items.
 * @param {Array} allItems
 * @returns {Object} { memberId: count }
 */
export function detectOverload(allItems) {
  const counts = {}
  for (const item of allItems) {
    if (item.status !== 'done' && item.assigned_to) {
      counts[item.assigned_to] = (counts[item.assigned_to] || 0) + 1
    }
  }
  return counts
}

/**
 * Find bottleneck items: items that many other items depend on,
 * and are not yet done.
 * @param {Array} allDeps
 * @param {Array} allItems
 * @returns {Array} sorted by blocking count desc
 */
export function findBottlenecks(allDeps, allItems) {
  const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]))
  const blockingCount = {}

  for (const dep of allDeps) {
    blockingCount[dep.predecessor_id] = (blockingCount[dep.predecessor_id] || 0) + 1
  }

  return Object.entries(blockingCount)
    .map(([id, count]) => ({ ...itemMap[id], blockingCount: count }))
    .filter(item => item && item.status !== 'done')
    .sort((a, b) => b.blockingCount - a.blockingCount)
}

/**
 * Estimate completion: naive estimate based on average daily progress.
 * If item has no history, returns null.
 * @param {Object} item - work item with progress, created_at
 * @returns {string|null} estimated date string
 */
export function estimateCompletion(item) {
  if (item.status === 'done') return 'Done'
  if (item.progress === 0) return null

  const createdAt = new Date(item.created_at)
  const now = new Date()
  const daysElapsed = Math.max(1, (now - createdAt) / (1000 * 60 * 60 * 24))
  const dailyRate = item.progress / daysElapsed
  if (dailyRate <= 0) return null

  const remaining = 100 - item.progress
  const daysToGo = remaining / dailyRate
  const estimate = new Date(now.getTime() + daysToGo * 24 * 60 * 60 * 1000)
  return estimate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Answer the demo question: "What breaks if threshold is set to 0?"
 * Threshold of 0 would mean the successor is unblocked immediately
 * without any work done on the predecessor — effectively nullifying the dependency.
 * We enforce threshold >= 1 at DB level, but this explains it.
 */
export const THRESHOLD_ZERO_EXPLANATION =
  'A threshold of 0 means the successor never waits for the predecessor. ' +
  'The dependency becomes meaningless — any item with progress ≥ 0 (always true) ' +
  'would instantly unblock its successors. We reject this at creation time.'
