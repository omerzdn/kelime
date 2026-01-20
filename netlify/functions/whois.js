const whois = require('whois');

exports.handler = async (event) => {
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

        if (!domain) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Domain is required' })
            };
        }

        // Clean domain
        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase();

        // Get raw WHOIS data
        const rawData = await new Promise((resolve, reject) => {
            whois.lookup(cleanDomain, { follow: 3, timeout: 15000 }, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        // Parse some basic fields from raw data
        const parsed = {};
        const lines = rawData.split('\n');

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();

                if (value && !parsed[key]) {
                    // Convert key to camelCase
                    const camelKey = key.toLowerCase()
                        .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
                        .replace(/\s/g, '')
                        .replace(/^(.)/, c => c.toLowerCase());
                    parsed[camelKey] = value;
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                domain: cleanDomain,
                parsed: parsed,
                raw: rawData,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('WHOIS error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
