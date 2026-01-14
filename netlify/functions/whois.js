const whois = require('whois-json');

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

        // Get WHOIS data using whois-json
        const result = await whois(cleanDomain);

        // Format raw data from result
        let rawData = '';
        for (const [key, value] of Object.entries(result)) {
            if (value) {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                if (Array.isArray(value)) {
                    value.forEach(v => {
                        rawData += `${formattedKey}: ${v}\n`;
                    });
                } else {
                    rawData += `${formattedKey}: ${value}\n`;
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                domain: cleanDomain,
                parsed: result,
                raw: rawData || JSON.stringify(result, null, 2),
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
