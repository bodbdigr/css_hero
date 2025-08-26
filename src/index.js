import Fastify from 'fastify'
import { processCss } from './handlers/processCss.js';

const fastify = Fastify({
  logger: true,
  bodyLimit: 10485760,
})

fastify.post('/', processCss)

try {
  await fastify.listen({ port: 3000 })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}