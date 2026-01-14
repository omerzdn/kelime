// DNS Lookup using Cloudflare and Google DoH (DNS over HTTPS) APIs
// This approach works better on Netlify Functions as it doesn't require raw socket access

const DOH_SERVERS = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/resolve',
  authoritative: 'https://cloudflare-dns.com/dns-query' // Fallback to Cloudflare for authoritative
};

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'];

async function queryDNS(domain, type, server) {
  const url = server === 'google'
    ? `${DOH_SERVERS[server]}?name=${domain}&type=${type}`
    : `${DOH_SERVERS[server]}?name=${domain}&type=${type}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error querying ${type} records:`, error);
    return null;
  }
}

function formatTTL(seconds) {
  return seconds || 300;
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const domain = params.domain;
    const server = params.server || 'cloudflare';

    if (!domain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Domain is required' })
      };
    }

    // Clean domain
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');

    const results = {
      a: [],
      aaaa: [],
      cname: [],
      mx: [],
      txt: [],
      ns: [],
      soa: null
    };

    // Query all record types in parallel
    const promises = RECORD_TYPES.map(async (type) => {
      const data = await queryDNS(cleanDomain, type, server);

      if (data && data.Answer) {
        switch (type) {
          case 'A':
            results.a = data.Answer
              .filter(r => r.type === 1)
              .map(r => ({ ip: r.data, ttl: r.TTL || 300 }));
            break;
          case 'AAAA':
            results.aaaa = data.Answer
              .filter(r => r.type === 28)
              .map(r => ({ ip: r.data, ttl: r.TTL || 300 }));
            break;
          case 'CNAME':
            results.cname = data.Answer
              .filter(r => r.type === 5)
              .map(r => ({ name: r.data, ttl: r.TTL || 300 }));
            break;
          case 'MX':
            results.mx = data.Answer
              .filter(r => r.type === 15)
              .map(r => {
                const parts = r.data.split(' ');
                return {
                  priority: parseInt(parts[0]) || 10,
                  exchange: parts[1] || r.data,
                  ttl: r.TTL || 300
                };
              });
            break;
          case 'TXT':
            results.txt = data.Answer
              .filter(r => r.type === 16)
              .map(r => ({
                value: r.data.replace(/^"|"$/g, ''),
                ttl: r.TTL || 300
              }));
            break;
          case 'NS':
            results.ns = data.Answer
              .filter(r => r.type === 2)
              .map(r => ({ nameserver: r.data, ttl: r.TTL || 3600 }));
            break;
          case 'SOA':
            const soaRecord = data.Answer?.find(r => r.type === 6);
            if (soaRecord) {
              const parts = soaRecord.data.split(' ');
              results.soa = {
                nsname: parts[0] || '',
                hostmaster: parts[1] || '',
                serial: parseInt(parts[2]) || 0,
                refresh: parseInt(parts[3]) || 0,
                retry: parseInt(parts[4]) || 0,
                expire: parseInt(parts[5]) || 0,
                minttl: parseInt(parts[6]) || soaRecord.TTL || 3600
              };
            }
            break;
        }
      }
    });

    await Promise.all(promises);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        domain: cleanDomain,
        server: server,
        records: results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
