// Usage: node -r dotenv/config scripts/test-moderation.js "some text to check"
// The -r dotenv/config flag loads .env before this script runs, since
// plain `node` does not auto-load .env files the way Next.js does.

const OpenAI = require('openai')
const openai = new OpenAI()

const text = process.argv[2]

if (!text) {
  console.error('Usage: node -r dotenv/config scripts/test-moderation.js "text to check"')
  process.exit(1)
}

async function main() {
  console.log('API key present:', !!process.env.OPENAI_API_KEY)
  console.log('Testing text:', text)
  const start = Date.now()

  const response = await openai.moderations.create({ input: text })

  console.log('Took', Date.now() - start, 'ms')
  console.log(JSON.stringify(response.results[0], null, 2))
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})