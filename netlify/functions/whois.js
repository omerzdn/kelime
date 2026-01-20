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

        // Use WHOIS API (free tier available)
        // Option 1: who-dat.as93.net (free, no API key needed)
        const response = await fetch(`https://who-dat.as93.net/${cleanDomain}`);

        if (!response.ok) {
            throw new Error('WHOIS lookup failed');
        }

        const data = await response.json();

        // Build raw text from response
        let rawData = '';

        if (data.domain) {
            rawData += `Domain Name: ${data.domain.name || cleanDomain}\n`;
            rawData += `Registry Domain ID: ${data.domain.id || ''}\n`;
        }

        rawData += `Registrar WHOIS Server: ${data.registrar?.whois_server || ''}\n`;
        rawData += `Registrar URL: ${data.registrar?.url || ''}\n`;
        rawData += `Updated Date: ${data.domain?.updated_date || ''}\n`;
        rawData += `Creation Date: ${data.domain?.created_date || ''}\n`;
        rawData += `Registry Expiry Date: ${data.domain?.expiration_date || ''}\n`;
        rawData += `Registrar: ${data.registrar?.name || ''}\n`;
        rawData += `Registrar IANA ID: ${data.registrar?.iana_id || ''}\n`;
        rawData += `Registrar Abuse Contact Email: ${data.registrar?.abuse_contact_email || ''}\n`;
        rawData += `Registrar Abuse Contact Phone: ${data.registrar?.abuse_contact_phone || ''}\n`;

        if (data.domain?.status) {
            const statuses = Array.isArray(data.domain.status) ? data.domain.status : [data.domain.status];
            for (const s of statuses) {
                rawData += `Domain Status: ${s}\n`;
            }
        }

        // Registrant info
        rawData += `Registry Registrant ID: ${data.registrant?.id || ''}\n`;
        rawData += `Registrant Name: ${data.registrant?.name || ''}\n`;
        rawData += `Registrant Organization: ${data.registrant?.organization || ''}\n`;
        rawData += `Registrant Street: ${data.registrant?.street || ''}\n`;
        rawData += `Registrant City: ${data.registrant?.city || ''}\n`;
        rawData += `Registrant State/Province: ${data.registrant?.province || ''}\n`;
        rawData += `Registrant Postal Code: ${data.registrant?.postal_code || ''}\n`;
        rawData += `Registrant Country: ${data.registrant?.country || ''}\n`;
        rawData += `Registrant Phone: ${data.registrant?.phone || ''}\n`;
        rawData += `Registrant Phone Ext: \n`;
        rawData += `Registrant Fax: ${data.registrant?.fax || ''}\n`;
        rawData += `Registrant Fax Ext: \n`;
        rawData += `Registrant Email: ${data.registrant?.email || ''}\n`;

        // Admin info
        rawData += `Registry Admin ID: ${data.admin?.id || ''}\n`;
        rawData += `Admin Name: ${data.admin?.name || ''}\n`;
        rawData += `Admin Organization: ${data.admin?.organization || ''}\n`;
        rawData += `Admin Street: ${data.admin?.street || ''}\n`;
        rawData += `Admin City: ${data.admin?.city || ''}\n`;
        rawData += `Admin State/Province: ${data.admin?.province || ''}\n`;
        rawData += `Admin Postal Code: ${data.admin?.postal_code || ''}\n`;
        rawData += `Admin Country: ${data.admin?.country || ''}\n`;
        rawData += `Admin Phone: ${data.admin?.phone || ''}\n`;
        rawData += `Admin Phone Ext: \n`;
        rawData += `Admin Fax: ${data.admin?.fax || ''}\n`;
        rawData += `Admin Fax Ext: \n`;
        rawData += `Admin Email: ${data.admin?.email || ''}\n`;

        // Tech info
        rawData += `Registry Tech ID: ${data.tech?.id || ''}\n`;
        rawData += `Tech Name: ${data.tech?.name || ''}\n`;
        rawData += `Tech Organization: ${data.tech?.organization || ''}\n`;
        rawData += `Tech Street: ${data.tech?.street || ''}\n`;
        rawData += `Tech City: ${data.tech?.city || ''}\n`;
        rawData += `Tech State/Province: ${data.tech?.province || ''}\n`;
        rawData += `Tech Postal Code: ${data.tech?.postal_code || ''}\n`;
        rawData += `Tech Country: ${data.tech?.country || ''}\n`;
        rawData += `Tech Phone: ${data.tech?.phone || ''}\n`;
        rawData += `Tech Phone Ext: \n`;
        rawData += `Tech Fax: ${data.tech?.fax || ''}\n`;
        rawData += `Tech Fax Ext: \n`;
        rawData += `Tech Email: ${data.tech?.email || ''}\n`;

        // Name servers
        if (data.name_servers) {
            for (const ns of data.name_servers) {
                rawData += `Name Server: ${ns}\n`;
            }
        }

        rawData += `DNSSEC: ${data.dnssec || 'unsigned'}\n`;

        // Build parsed object
        const parsed = {
            domainName: data.domain?.name || cleanDomain,
            registrar: data.registrar?.name,
            creationDate: data.domain?.created_date,
            expiryDate: data.domain?.expiration_date,
            updatedDate: data.domain?.updated_date,
            registrantOrganization: data.registrant?.organization,
            registrantCountry: data.registrant?.country,
            nameServer: data.name_servers,
            domainStatus: data.domain?.status
        };

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
