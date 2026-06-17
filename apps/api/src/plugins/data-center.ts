import type { DataCenter } from '@quant/data-center';

declare module 'fastify' {
  interface FastifyInstance {
    dataCenter: DataCenter;
  }
}