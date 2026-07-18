import dns from 'node:dns/promises';
import net from 'node:net';
import { createNodePinnedTransport } from './nodePinnedFetch.js';

const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function blockedIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,2,168].includes(b)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0);
}

function blockedIPv6(address) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') || normalized.startsWith('2001:db8:')) return true;
  const dotted=normalized.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];if(dotted&&blockedIPv4(dotted))return true;
  const expand=value=>{let source=value;if(dotted){const octets=dotted.split('.').map(Number);source=source.slice(0,-dotted.length)+`${((octets[0]<<8)|octets[1]).toString(16)}:${((octets[2]<<8)|octets[3]).toString(16)}`;}const sides=source.split('::'),left=sides[0]?sides[0].split(':'):[],right=sides[1]?sides[1].split(':'):[],fill=new Array(Math.max(0,8-left.length-right.length)).fill('0');return[...left,...fill,...right].map(part=>parseInt(part||'0',16));};
  const parts=expand(normalized),embedded=(high,low)=>`${high>>8}.${high&255}.${low>>8}.${low&255}`;
  if(parts.length===8&&parts.slice(0,6).every(part=>part===0)&&blockedIPv4(embedded(parts[6],parts[7])))return true;
  if(parts[0]===0x2002&&blockedIPv4(embedded(parts[1],parts[2])))return true;
  if(parts[0]===0x64&&parts[1]===0xff9b&&blockedIPv4(embedded(parts[6],parts[7])))return true;
  return false;
}

export function isPrivateAddress(address) {
  const family = net.isIP(address);
  return family === 4 ? blockedIPv4(address) : family === 6 ? blockedIPv6(address) : true;
}

export async function validatePublicHttpsUrl(rawUrl, { lookup = dns.lookup } = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Game URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Game URL must be credential-free HTTPS');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Game URL host is not public');
  const literalFamily = net.isIP(hostname);
  const records = literalFamily ? [{ address: hostname, family: literalFamily }] : await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isPrivateAddress(record.address))) throw new Error('Game URL resolves to a blocked network');
  return { url, addresses: records.map(record => record.address) };
}

export async function monitorPublicUrl(rawUrl, { transport, testFetchImpl, allowTestTransport = false, lookup = dns.lookup, maxRedirects = 3, timeoutMs = 8000 } = {}) {
  const selected=transport||(!testFetchImpl?createNodePinnedTransport():allowTestTransport?{kind:'test-only',fetch:(url,options)=>testFetchImpl(url,options)}:null);
  if(!selected?.fetch)throw new Error('A pinned production transport is required');
  let current = rawUrl;
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const { url, addresses } = await validatePublicHttpsUrl(current, { lookup });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await selected.fetch(url, { addresses,method:'GET',redirect:'manual',signal:controller.signal,headers:{accept:'text/html,application/xhtml+xml',range:'bytes=0-65535','user-agent':'GzowosGamesMonitor/1.0'} });
    } finally { clearTimeout(timer); }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect is missing a location');
      current = new URL(location, url).href;
      continue;
    }
    const contentType = response.headers.get('content-type') || '';
    return {ok:response.ok,status:response.status,url:url.href,contentType,addresses,transport:selected.kind,checkedAt:new Date().toISOString()};
  }
  throw new Error('Game URL redirected too many times');
}
