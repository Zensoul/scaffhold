// Verifies whether a given plaintext password matches the hash
// currently stored for vinith — isolates "is the password wrong" from
// "is something else broken in the login flow".

const bcrypt = require('bcryptjs')

const password = process.argv[2]
const storedHash = '$2b$10$XkUsGLtIu.jJZHPEJ8NQ1OQnRXoUa5G/tV65jrZE1ophg0OA/88aW'

if (!password) {
  console.error('Usage: node verify-password.js <password-to-test>')
  process.exit(1)
}

bcrypt.compare(password, storedHash).then((matches) => {
  console.log('Password entered:', password)
  console.log('Matches stored hash:', matches)
})