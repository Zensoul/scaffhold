// One-off script — run once, then delete or ignore.
// Generates a bcrypt hash for a new password so you can paste it
// directly into vinith's passwordHash field in Prisma Studio.

const bcrypt = require('bcryptjs')

const newPassword = process.argv[2]

if (!newPassword) {
  console.error('Usage: node reset-password.js <new-password>')
  process.exit(1)
}

bcrypt.hash(newPassword, 10).then((hash) => {
  console.log('New password:', newPassword)
  console.log('Paste this into passwordHash in Prisma Studio:')
  console.log(hash)
})