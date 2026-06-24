#!/usr/bin/env tsx
import { createDataCenter } from '../services/data-center/src/storage/factory.js';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { dirname } from 'path';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

async function main() {
  const projectRoot = findProjectRoot();
  const dbPath = resolve(projectRoot, 'data', 'quant.db');
  
  console.log('Initializing DataCenter...');
  const dataCenter = await createDataCenter({ dbPath });
  
  console.log('Importing instruments...');
  const instruments = [
    {
      symbol: '600519',
      name: '贵州茅台',
      exchange: 'SSE',
      lotSize: 100,
      priceTick: 0.01,
      industry: '白酒',
      sector: '消费',
      listDate: 785347200000, // 2001-08-27
      status: 'active',
    },
    {
      symbol: '000858',
      name: '五粮液',
      exchange: 'SZSE',
      lotSize: 100,
      priceTick: 0.01,
      industry: '白酒',
      sector: '消费',
      listDate: 857164800000, // 1997-04-29
      status: 'active',
    },
    {
      symbol: '000001',
      name: '平安银行',
      exchange: 'SZSE',
      lotSize: 100,
      priceTick: 0.01,
      industry: '银行',
      sector: '金融',
      listDate: 751680000000, // 1991-04-03
      status: 'active',
    },
    {
      symbol: '600036',
      name: '招商银行',
      exchange: 'SSE',
      lotSize: 100,
      priceTick: 0.01,
      industry: '银行',
      sector: '金融',
      listDate: 1017676800000, // 2002-04-09
      status: 'active',
    },
    {
      symbol: '601318',
      name: '中国平安',
      exchange: 'SSE',
      lotSize: 100,
      priceTick: 0.01,
      industry: '保险',
      sector: '金融',
      listDate: 1173369600000, // 2007-03-01
      status: 'active',
    },
  ];
  
  await dataCenter.repos.instruments.save(instruments);
  console.log(`Imported ${instruments.length} instruments`);
  
  console.log('Importing sample bars...');
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const bars = [];
  
  // 为贵州茅台生成 30 天的示例 K 线数据
  let basePrice = 1800;
  for (let i = 30; i >= 0; i--) {
    const timestamp = now - i * oneDay;
    const open = basePrice + (Math.random() - 0.5) * 50;
    const close = open + (Math.random() - 0.5) * 30;
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    const volume = 10000 + Math.random() * 5000;
    const turnover = volume * close;
    
    bars.push({
      symbol: '600519',
      timeframe: '1d',
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      turnover,
    });
    
    basePrice = close;
  }
  
  await dataCenter.repos.bars.save(bars);
  console.log(`Imported ${bars.length} bars for 600519`);
  
  console.log('Data import completed!');
  await dataCenter.close();
}

main().catch(console.error);
