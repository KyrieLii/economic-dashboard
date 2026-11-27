import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import { collectActivity } from "../server/market-activity";
import { saveObservations } from "../server/store";
import type { Observation } from "../shared/model";

const clients: Client[] = [];
after(() => clients.forEach(c => c.close()));
async function database() {
  const c = createClient({ url: 'file::memory:' }); clients.push(c);
  await c.batch([
    'CREATE TABLE observations(metric_id TEXT,date TEXT,value REAL,volume REAL,source TEXT,fetched_at TEXT,revised_at TEXT,PRIMARY KEY(metric_id,date))',
    'CREATE TABLE revisions(id INTEGER PRIMARY KEY,metric_id TEXT,date TEXT,old_value REAL,new_value REAL,old_volume REAL,new_volume REAL,changed_at TEXT,source TEXT)',
    'CREATE TABLE metric_status(metric_id TEXT PRIMARY KEY,last_attempt TEXT,last_success TEXT,error TEXT)',
  ],'write');return c;
}
const now = new Date('2026-11-27T12:00:00Z');
const today = '2026-11-27', yesterday = '2026-11-26';
const point = (market: string, date: string): Observation => ({date,value:market==='sh'?100:market==='sz'?200:3,volume:market==='sz'?null:10});
async function status(c: Client, id: string) {
  return (await c.execute({sql:'SELECT error FROM metric_status WHERE metric_id=?',args:[id]})).rows[0]?.error;
}

test('transient Shenzhen failure retries and saves complete same-date totals', async () => {
  const c=await database();let attempts=0;
  const result=await collectActivity(c,false,Date.now()+30000,{now,fetchDay:async(m,d)=>{
    if(m==='sz' && d===today && ++attempts===1)throw new TypeError('fetch failed');
    return point(m,d);
  }});
  assert.equal(attempts,2);assert.equal(result.failures,0);
  assert.equal(await status(c,'a-turnover'),null);
  assert.equal((await c.execute("SELECT value FROM observations WHERE metric_id='a-turnover' AND date='2026-11-27'")).rows[0].value,303);
});

test('an older date failure does not stop backfill or mark the latest total as missing', async()=>{
  const c=await database();const visited:string[]=[];
  await collectActivity(c,false,Date.now()+30000,{now,fetchDay:async(m,d)=>{
    if(m==='sz')visited.push(d);
    if(m==='sz'&&d===yesterday)throw new Error('深交所日期或单位变化');
    return point(m,d);
  }});
  assert.ok(visited.includes('2026-11-25'));
  assert.match(String(await status(c,'a-turnover')),/^历史补采未完整.*2026-11-27.*SZSE 2026-11-26/);
  assert.equal(await status(c,'sh-turnover'),null);
  assert.equal((await c.execute("SELECT COUNT(*) AS n FROM observations WHERE metric_id='a-turnover' AND date='2026-11-26'")).rows[0].n,0);
  assert.equal((await c.execute("SELECT value FROM observations WHERE metric_id='a-turnover' AND date='2026-11-25'")).rows[0].value,303);
});

test('latest exchange failure preserves saved data and is not mislabeled as historical backfill',async()=>{
  const c=await database();await saveObservations(c,'a-turnover','official',[{date:today,value:302,volume:null}]);
  await collectActivity(c,false,Date.now()+30000,{now,fetchDay:async(m,d)=>{
    if(m==='sz'&&d===today)throw new Error('invalid response');return point(m,d);
  }});
  assert.match(String(await status(c,'a-turnover')),/^交易所最新统计未完整取得/);
  assert.equal((await c.execute("SELECT value FROM observations WHERE metric_id='a-turnover' AND date='2026-11-27'")).rows[0].value,302);
});

test('incremental collection revisits older gaps evidenced by other exchanges and clears recovered warnings',async()=>{
  const c=await database(), old='2026-10-20';
  await saveObservations(c,'sh-turnover','official',[point('sh',old)]);
  await saveObservations(c,'bj-turnover','official',[point('bj',old)]);
  const visited:string[]=[];
  await collectActivity(c,false,Date.now()+30000,{now,fetchDay:async(m,d)=>{visited.push(`${m}/${d}`);return point(m,d);}});
  assert.ok(visited.includes(`sz/${old}`));assert.ok(visited.includes(`sh/${old}`));
  assert.equal((await c.execute("SELECT value FROM observations WHERE metric_id='a-turnover' AND date='2026-10-20'")).rows[0].value,303);
  assert.equal(await status(c,'a-turnover'),null);
});

test('null or empty exchange days cannot produce partial totals; deadline and source outages stay bounded',async()=>{
  const c=await database();let calls=0;
  await collectActivity(c,false,Date.now()+30000,{now,fetchDay:async(m,d)=>{
    if(m==='sz'){calls++;throw new Error('invalid response');}return point(m,d);
  }});
  assert.equal(calls,3);
  assert.equal((await c.execute("SELECT COUNT(*) AS n FROM observations WHERE metric_id='a-turnover'")).rows[0].n,0);
  await collectActivity(c,false,0,{now,fetchDay:async()=>{assert.fail('request past deadline');}});
  assert.match(String(await status(c,'a-turnover')),/deadline/);
  const c2=await database();
  await collectActivity(c2,false,Date.now()+30000,{now,fetchDay:async(m,d)=>m==='sz'&&d===today?null:point(m,d)});
  assert.match(String(await status(c2,'a-turnover')),/^交易所最新统计未完整取得/);
});
