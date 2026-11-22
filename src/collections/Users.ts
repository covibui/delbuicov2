import crypto from 'crypto'
import type { CollectionConfig } from 'payload'
import { adminField, adminOnly, isAdminUser, loggedIn } from '../access'
import { getServerUrl, SITE_NAME } from '../lib/serverUrl'

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

const emailShell = (body: string) => `
<div style="font-family: Georgia, 'Times New Roman', serif; background:#FBF8F1; padding:32px; color:#1E1B18;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border:1px solid #DCD5C5; padding:32px;">
    <div style="font-size:11px; letter-spacing:0.3em; text-transform:uppercase; color:#8A3E2C;">${SITE_NAME}</div>
    ${body}
  </div>
</div>`

const passwordEmailHTML = (token: string, name?: string) => {
  const link = `${getServerUrl()}/set-password?token=${encodeURIComponent(token)}`
  return emailShell(`
    <h1 style="font-weight:normal; font-size:28px; margin:16px 0 8px;">${name ? `Hi ${name},` : 'Hello,'}</h1>
    <p style="font-size:17px; line-height:1.5;">Use the button below to set your password for the family cookbook. The link works for 7 days.</p>
    <p style="margin:28px 0;"><a href="${link}" style="background:#1E1B18; color:#FBF8F1; padding:12px 22px; text-decoration:none; font-family:Arial, sans-serif; font-size:13px; letter-spacing:0.12em; text-transform:uppercase;">Set my password</a></p>
    <p style="font-size:13px; color:#7C7466;">If the button doesn't work, paste this into your browser:<br>${link}</p>`)
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Family member', plural: 'Family' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    description:
      'To invite someone: add them with any temporary password, tick “Send invite email”, and save. They get a link to set their own password.',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // stay logged in for 30 days
    forgotPassword: {
      expiration: SEVEN_DAYS, // invite / reset links last a week
      generateEmailSubject: () => `Set your password · ${SITE_NAME}`,
      generateEmailHTML: (args) =>
        passwordEmailHTML(args?.token ?? '', (args?.user as { name?: string } | undefined)?.name),
    },
  },
  access: {
    read: loggedIn,
    create: adminOnly,
    update: ({ req, id }) => {
      if (!req.user) return false
      if (isAdminUser(req.user as any)) return true
      return String(req.user.id) === String(id)
    },
    delete: adminOnly,
    admin: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Admin (can edit everything, invite people)', value: 'admin' },
        { label: 'Family member (adds and edits own recipes)', value: 'member' },
      ],
      access: { update: adminField, create: adminField },
      saveToJWT: true,
    },
    {
      name: 'sendInvite',
      label: 'Send invite email on save',
      type: 'checkbox',
      defaultValue: false,
      access: { update: adminField, create: adminField },
      admin: {
        description: 'Emails them a link to set their own password. Use it again any time to resend.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req, context }) => {
        // The very first account becomes the admin.
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) data.role = 'admin'
        }
        // Invite: create a set-password token as part of this save.
        // (Calling forgotPassword from a hook would lock the same row.)
        if (data.sendInvite) {
          const token = crypto.randomBytes(20).toString('hex')
          data.resetPasswordToken = token
          data.resetPasswordExpiration = new Date(Date.now() + SEVEN_DAYS).toISOString()
          context.inviteToken = token
          data.sendInvite = false
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, context }) => {
        const token = context.inviteToken as string | undefined
        if (!token) return doc
        context.inviteToken = undefined
        try {
          await req.payload.sendEmail({
            to: doc.email,
            subject: `You're invited · ${SITE_NAME}`,
            html: passwordEmailHTML(token, doc.name),
          })
          req.payload.logger.info(`Invite email sent to ${doc.email}`)
        } catch (err) {
          req.payload.logger.error({ err, msg: `Could not send invite to ${doc.email}` })
        }
        return doc
      },
    ],
  },
}
