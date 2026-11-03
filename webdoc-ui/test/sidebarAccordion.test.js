import assert from 'node:assert/strict'
import test from 'node:test'

function nodeKey(item, level) {
  return level === 0 ? item.text : item.link || item.text
}

function linkActive(item, activePath) {
  if (!item.link) return false
  if (item.link === '/bai-viet') {
    return activePath === '/bai-viet' || activePath.startsWith('/bai-viet/')
  }
  return activePath === item.link
}

function containsActive(items, activePath) {
  return items.some((item) => {
    if (linkActive(item, activePath)) return true
    return item.items ? containsActive(item.items, activePath) : false
  })
}

function findItemBranch(items, targetItem, level = 0) {
  for (const item of items) {
    if (
      item === targetItem ||
      (item.link && targetItem.link && item.link === targetItem.link)
    ) {
      return [{ item, level, siblings: items }]
    }
    if (item.items && item.items.length) {
      const sub = findItemBranch(item.items, targetItem, level + 1)
      if (sub) {
        return [{ item, level, siblings: items }, ...sub]
      }
    }
  }
  return null
}

function findPathToActive(items, activePath, level = 0) {
  for (const item of items) {
    if (linkActive(item, activePath)) {
      return [{ item, level, siblings: items }]
    }
    if (item.items && item.items.length) {
      if (containsActive(item.items, activePath)) {
        const sub = findPathToActive(item.items, activePath, level + 1)
        if (sub) {
          return [{ item, level, siblings: items }, ...sub]
        }
        return [{ item, level, siblings: items }]
      }
    }
  }
  return null
}

function closeItemAndDescendants(item, level, next) {
  if (!item.items || !item.items.length) return false
  let changed = false
  const k = nodeKey(item, level)
  if (next[k] !== false) {
    next[k] = false
    changed = true
  }
  item.items.forEach((child) => {
    if (closeItemAndDescendants(child, level + 1, next)) {
      changed = true
    }
  })
  return changed
}

function handleLinkClickSimulator(groups, currentOpenGroups, item, level, requestedOpen, autoCollapsePeers = true) {
  if (!autoCollapsePeers) return currentOpenGroups
  // Only applies to parent items (items with children), NOT leaf articles:
  if (!item.items || !item.items.length) return currentOpenGroups

  const branch = findItemBranch(groups, item)
  if (!branch) return currentOpenGroups

  const willBeOpen = requestedOpen !== undefined ? requestedOpen : true
  const next = { ...currentOpenGroups }

  if (willBeOpen) {
    for (const step of branch) {
      const k = nodeKey(step.item, step.level)
      next[k] = true
    }
    for (const step of branch) {
      for (const sib of step.siblings) {
        if (sib !== step.item && sib.items && sib.items.length) {
          closeItemAndDescendants(sib, step.level, next)
        }
      }
    }
  } else {
    closeItemAndDescendants(item, level, next)
  }
  return next
}

function handleCaretToggleSimulator(currentOpenGroups, key, open) {
  return { ...currentOpenGroups, [key]: open }
}

function updateActiveBranchSimulator(groups, currentOpen, activePath, autoCollapsePeers, isArticleClick = false) {
  const next = { ...currentOpen }

  const open = (key) => {
    next[key] = true
  }
  const walk = (items, level) => {
    items.forEach((item) => {
      if (!item.items) return
      if (linkActive(item, activePath) || containsActive(item.items, activePath)) {
        open(nodeKey(item, level))
      }
      walk(item.items, level + 1)
    })
  }
  walk(groups, 0)

  if (autoCollapsePeers && !isArticleClick) {
    const branch = findPathToActive(groups, activePath)
    if (branch) {
      for (const step of branch) {
        for (const sib of step.siblings) {
          if (sib !== step.item && sib.items && sib.items.length) {
            closeItemAndDescendants(sib, step.level, next)
          }
        }
      }
    }
  }

  return next
}

const mockGroups = [
  {
    text: 'Getting started',
    link: '/getting-started',
    items: [
      {
        text: 'Basics',
        link: '/getting-started/basics',
        items: [
          {
            text: 'Overview',
            link: '/getting-started/basics/overview',
            items: [
              { text: 'Detail 1', link: '/getting-started/basics/overview/1' },
              { text: 'Detail 2', link: '/getting-started/basics/overview/2' },
            ],
          },
          {
            text: 'Navigation',
            link: '/getting-started/basics/navigation',
            items: [
              { text: 'Nav item', link: '/getting-started/basics/navigation/item' },
            ],
          },
        ],
      },
      {
        text: 'Advanced',
        link: '/getting-started/advanced',
        items: [
          { text: 'Config', link: '/getting-started/advanced/config' },
        ],
      },
      { text: 'Quickstart', link: '/getting-started/quickstart' },
    ],
  },
  {
    text: 'Account',
    link: '/account',
    items: [
      { text: 'Sign in', link: '/account/sign-in' },
    ],
  },
  {
    text: 'Content model',
    link: '/content-model',
    items: [
      { text: 'Structure', link: '/content-model/structure' },
    ],
  },
]

test('clicking top-level parent link opens clicked group and closes peer groups', () => {
  let openState = { 'Getting started': true, Account: true }

  // User clicks directly on 'Content model' (level 0 parent)
  openState = handleLinkClickSimulator(mockGroups, openState, mockGroups[2], 0)

  assert.equal(openState['Content model'], true)
  assert.equal(openState['Getting started'], false)
  assert.equal(openState.Account, false)
})

test('clicking level 2 parent link (cấp cha thứ 2) opens it and closes peer level 2 parent links and peer level 1 groups', () => {
  let openState = {
    'Getting started': true,
    '/getting-started/basics': true,
    '/getting-started/advanced': false,
    Account: true,
  }

  // User clicks 'Advanced' (cấp cha thứ 2, sibling of 'Basics' inside 'Getting started')
  const advancedItem = mockGroups[0].items[1]
  openState = handleLinkClickSimulator(mockGroups, openState, advancedItem, 1)

  assert.equal(openState['Getting started'], true)
  assert.equal(openState['/getting-started/advanced'], true)
  assert.equal(openState['/getting-started/basics'], false) // Peer cấp 2 collapsed!
  assert.equal(openState.Account, false) // Peer cấp 1 collapsed!
})

test('clicking level 3 parent link (cấp cha thứ 3) opens it and closes peer level 3 parent links and ancestors peers', () => {
  let openState = {
    'Getting started': true,
    '/getting-started/basics': true,
    '/getting-started/basics/overview': true,
    '/getting-started/basics/navigation': false,
    '/getting-started/advanced': false,
    Account: false,
  }

  // User clicks 'Navigation' (cấp cha thứ 3, sibling of 'Overview' inside 'Basics')
  const navItem = mockGroups[0].items[0].items[1]
  openState = handleLinkClickSimulator(mockGroups, openState, navItem, 2)

  assert.equal(openState['Getting started'], true)
  assert.equal(openState['/getting-started/basics'], true)
  assert.equal(openState['/getting-started/basics/navigation'], true)
  assert.equal(openState['/getting-started/basics/overview'], false) // Peer cấp 3 collapsed!
  assert.equal(openState['/getting-started/advanced'], false) // Peer cấp 2 collapsed!
  assert.equal(openState.Account, false) // Peer cấp 1 collapsed!
})

test('clicking leaf article link does NOT collapse peer groups', () => {
  let openState = {
    'Getting started': true,
    '/getting-started/basics': true,
    '/getting-started/advanced': true,
    Account: true,
  }

  // User clicks 'Quickstart' (leaf article, no children)
  const quickstartItem = mockGroups[0].items[2]
  openState = handleLinkClickSimulator(mockGroups, openState, quickstartItem, 1)

  // Clicking an article does not trigger peer collapse
  assert.equal(openState['Getting started'], true)
  assert.equal(openState['/getting-started/basics'], true)
  assert.equal(openState['/getting-started/advanced'], true)
  assert.equal(openState.Account, true)
})

test('clicking caret toggle does NOT close peer groups', () => {
  let openState = { 'Getting started': true, Account: false }

  // User clicks caret on 'Account'
  openState = handleCaretToggleSimulator(openState, 'Account', true)

  assert.equal(openState.Account, true)
  assert.equal(openState['Getting started'], true) // Did NOT close peer!
})

test('when docsAccordion option is false (default), clicking parent link does NOT collapse peer groups', () => {
  let openState = { 'Getting started': true, Account: true }

  // User clicks 'Content model' link with autoCollapsePeers = false
  openState = handleLinkClickSimulator(mockGroups, openState, mockGroups[2], 0, undefined, false)

  assert.equal(openState['Getting started'], true)
  assert.equal(openState.Account, true)
})

test('Next page crossing from one child section to another section collapses peer parent sections at level 1, level 2, etc.', () => {
  let openState = {
    'Getting started': true,
    '/getting-started/basics': true,
    '/getting-started/basics/overview': true,
    '/getting-started/basics/navigation': false,
    '/getting-started/advanced': false,
    Account: false,
  }

  // 1. Next page lands on '/getting-started/basics/navigation/item' (inside Navigation section)
  openState = updateActiveBranchSimulator(mockGroups, openState, '/getting-started/basics/navigation/item', true)
  assert.equal(openState['/getting-started/basics/navigation'], true)
  assert.equal(openState['/getting-started/basics/overview'], false) // Cấp 3 peer collapsed!
  assert.equal(openState['/getting-started/basics'], true)

  // 2. Next page lands on '/getting-started/advanced/config' (inside Advanced section)
  openState = updateActiveBranchSimulator(mockGroups, openState, '/getting-started/advanced/config', true)
  assert.equal(openState['/getting-started/advanced'], true)
  assert.equal(openState['/getting-started/basics'], false) // Cấp 2 peer collapsed!
  assert.equal(openState['Getting started'], true)

  // 3. Next page lands on '/account/sign-in' (inside Account section)
  openState = updateActiveBranchSimulator(mockGroups, openState, '/account/sign-in', true)
  assert.equal(openState.Account, true)
  assert.equal(openState['Getting started'], false) // Cấp 1 peer collapsed!
})

test('Prev page crossing from one section back to previous section collapses peer parent sections', () => {
  let openState = {
    'Getting started': false,
    '/getting-started/basics': false,
    '/getting-started/advanced': true,
    Account: true,
  }

  // Prev page lands on '/getting-started/basics/navigation/item'
  openState = updateActiveBranchSimulator(mockGroups, openState, '/getting-started/basics/navigation/item', true)

  assert.equal(openState['Getting started'], true)
  assert.equal(openState.Account, false) // Cấp 1 collapsed!
  assert.equal(openState['/getting-started/basics'], true)
  assert.equal(openState['/getting-started/advanced'], false) // Cấp 2 collapsed!
  assert.equal(openState['/getting-started/basics/navigation'], true)
})

test('Article click in sidebar (isArticleClick = true) does NOT collapse peer groups', () => {
  let openState = {
    'Getting started': true,
    '/getting-started/basics': true,
    '/getting-started/advanced': true,
    Account: true,
  }

  // Clicking an article in sidebar navigates to it, but peer groups remain open
  openState = updateActiveBranchSimulator(mockGroups, openState, '/getting-started/basics/overview/1', true, true)

  assert.equal(openState['Getting started'], true)
  assert.equal(openState['/getting-started/basics'], true)
  assert.equal(openState['/getting-started/advanced'], true) // Still open!
  assert.equal(openState.Account, true) // Still open!
})
