import type { Access, FieldAccess } from 'payload'

type MaybeUser = { id: number | string; role?: string | null } | null | undefined

export const isAdminUser = (user: MaybeUser) => user?.role === 'admin'

export const anyone: Access = () => true
export const loggedIn: Access = ({ req }) => Boolean(req.user)
export const adminOnly: Access = ({ req }) => isAdminUser(req.user as MaybeUser)
export const adminField: FieldAccess = ({ req }) => isAdminUser(req.user as MaybeUser)

/** Admin can touch everything; members only rows where `field` is themselves. */
export const adminOrOwner =
  (field: string): Access =>
  ({ req }) => {
    const user = req.user as MaybeUser
    if (!user) return false
    if (isAdminUser(user)) return true
    return { [field]: { equals: user.id } }
  }
