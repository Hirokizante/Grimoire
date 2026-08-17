/**
 * Zustand store for Status Conditions.
 *
 * Owns the in-memory list of status conditions plus the global status
 * inspection modal. Status conditions are reference records shared across all
 * character sheets: built-in Divergence conditions (tagged 'Default') and
 * user-created custom ones. They are persisted to the IndexedDB `statuses`
 * object store (see db.ts).
 *
 * The global `modal` state lets any status reference (inline in a sheet
 * description, or a card in the compendium) open the same detail/edit modal.
 */

import { create } from 'zustand'
import { generateId } from '@/constants/gameData'
import { createBlankStatus } from '@/constants/statuses'
import {
  deleteStatus as dbDeleteStatus,
  getAllStatuses,
  putStatus,
} from '@/lib/db'
import type { StatusCondition } from '@/types'

/** State for the global status detail/edit modal. */
export interface StatusModalState {
  /** Id of the status being inspected, or null when the modal is closed. */
  statusId: string | null
  /** Whether the modal should open directly in edit mode. */
  startInEdit: boolean
}

export interface StatusStoreState {
  /** All status conditions loaded from IndexedDB. */
  statuses: StatusCondition[]
  /** Whether the initial load from IndexedDB has completed. */
  isLoaded: boolean
  /** Global detail/edit modal state. */
  modal: StatusModalState
}

export interface StatusStoreActions {
  /** Load all status conditions from IndexedDB into the store. */
  loadStatuses: () => Promise<void>
  /**
   * Create a new custom status with the given name, persist it, and open it in
   * edit mode. Returns the new status.
   */
  createStatus: (name: string) => Promise<StatusCondition>
  /** Persist an updated status condition and sync the in-memory list. */
  updateStatus: (updated: StatusCondition) => Promise<void>
  /** Delete a status condition from the DB and store. */
  deleteStatus: (id: string) => Promise<void>
  /**
   * Merge imported status conditions into the compendium. Statuses are matched
   * by name (case-insensitive): existing statuses win (kept as-is), new names
   * are added with fresh ids. Used when importing a character whose export
   * bundle carries attached statuses.
   */
  importStatuses: (incoming: StatusCondition[]) => Promise<void>
  /** Open the global modal on a status id (optionally in edit mode). */
  openStatus: (id: string, startInEdit?: boolean) => void
  /** Close the global modal. */
  closeStatus: () => void
}

export type StatusStore = StatusStoreState & StatusStoreActions

export const useStatusStore = create<StatusStore>()((set, get) => ({
  statuses: [],
  isLoaded: false,
  modal: { statusId: null, startInEdit: false },

  loadStatuses: async () => {
    const statuses = await getAllStatuses()
    set({ statuses, isLoaded: true })
  },

  createStatus: async (name: string) => {
    const status: StatusCondition = {
      ...createBlankStatus(),
      id: generateId(),
      name: name.trim(),
    }
    await putStatus(status)
    set((state) => ({ statuses: [...state.statuses, status] }))
    get().openStatus(status.id, true)
    return status
  },

  updateStatus: async (updated: StatusCondition) => {
    const stamped: StatusCondition = {
      ...updated,
      updatedAt: new Date().toISOString(),
    }
    await putStatus(stamped)
    set((state) => ({
      statuses: state.statuses.map((s) => (s.id === stamped.id ? stamped : s)),
    }))
  },

  deleteStatus: async (id: string) => {
    await dbDeleteStatus(id)
    set((state) => {
      const statuses = state.statuses.filter((s) => s.id !== id)
      const modal =
        state.modal.statusId === id
          ? { statusId: null, startInEdit: false }
          : state.modal
      return { statuses, modal }
    })
  },

  importStatuses: async (incoming: StatusCondition[]) => {
    if (incoming.length === 0) return
    const existingNames = new Set(
      get().statuses.map((s) => s.name.trim().toLowerCase()),
    )
    const toAdd: StatusCondition[] = []
    for (const status of incoming) {
      const key = status.name.trim().toLowerCase()
      if (!key) continue
      // Name conflict: keep the existing status (references resolve by name).
      if (existingNames.has(key)) continue
      existingNames.add(key)
      toAdd.push({ ...status, id: generateId() })
    }
    if (toAdd.length === 0) return
    for (const status of toAdd) {
      await putStatus(status)
    }
    set((state) => ({ statuses: [...state.statuses, ...toAdd] }))
  },

  openStatus: (id: string, startInEdit = false) => {
    set({ modal: { statusId: id, startInEdit } })
  },

  closeStatus: () => {
    set({ modal: { statusId: null, startInEdit: false } })
  },
}))

// Load statuses once at module load, mirroring characterStore's loadCharacters.
void useStatusStore.getState().loadStatuses()
