import Fastify from 'fastify';
const app = Fastify({ logger: true });
app.get('/api/health', async () => ({ status: 'ok' }));
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '127.0.0.1' });
