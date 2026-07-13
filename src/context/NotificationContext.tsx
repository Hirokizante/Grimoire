/**
 * NotificationContext — a lightweight toast notification system.
 *
 * Notifications slide up from the bottom-left corner, stack vertically,
 * and auto-dismiss after a configurable duration. Replaces all inline
 * "setMessage" state across components.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  message: string
  type: NotificationType
  duration: number
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

let notificationCounter = 0
function nextId(): string {
  return `n${++notificationCounter}`
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, type: NotificationType = 'info', duration = 3000) => {
      const id = nextId()
      setNotifications((prev) => [...prev, { id, message, type, duration }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-container" aria-live="polite" aria-atomic="false">
        {notifications.map((n, i) => (
          <div
            key={n.id}
            className={`notification notification--${n.type}`}
            style={{
              '--notification-index': i,
              '--notification-duration': `${n.duration}ms`,
            } as CSSProperties}
            role={n.type === 'error' ? 'alert' : 'status'}
          >
            {n.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

/**
 * Access the notification context from any descendant of NotificationProvider.
 * Use: `const { notify } = useNotification()`
 *      `notify('Hello!', 'success')`
 */
export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return ctx
}
