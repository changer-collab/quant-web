import { buildApp } from './app.js';
import { createDataCenter } from '@quant/data-center/storage';
import { InMemoryTaskService } from './plugins/task-service.js';

const dataCenter = await createDataCenter({ dbPath: 'data/quant.db' });
const taskService = new InMemoryTaskService();

const app = await buildApp({ dataCenter, taskService });

await app.listen({ port: 3000, host: '0.0.0.0' });