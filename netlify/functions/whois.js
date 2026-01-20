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

        // Try multiple WHOIS sources
        let rawData = '';
        let parsed = {};

        // Try 1: RDAP directly with more detailed parsing
        try {
            const rdapResponse = await fetch(`https://rdap.verisign.com/com/v1/domain/${cleanDomain}`, {
                headers: { 'Accept': 'application/rdap+json' }
            });

            if (rdapResponse.ok) {
                const data = await rdapResponse.json();

                // Build raw WHOIS text
                rawData = `Domain Name: ${data.ldhName || cleanDomain.toUpperCase()}\n`;
                rawData += `Registry Domain ID: ${data.handle || ''}\n`;

                // Extract all entities
                let registrar = { name: '', iana: '', email: '', phone: '', url: '', whoisServer: '' };
                let registrant = { org: '', name: '', country: '', state: '', city: '', street: '', postal: '', email: '', phone: '' };
                let admin = { org: '', name: '', country: '', state: '', email: '', phone: '' };
                let tech = { org: '', name: '', country: '', state: '', email: '', phone: '' };

                const parseVcard = (vcardArray) => {
                    const result = {};
                    if (!vcardArray || !vcardArray[1]) return result;
                    for (const prop of vcardArray[1]) {
                        if (prop[0] === 'fn') result.name = prop[3];
                        if (prop[0] === 'org') result.org = Array.isArray(prop[3]) ? prop[3][0] : prop[3];
                        if (prop[0] === 'email') result.email = prop[3];
                        if (prop[0] === 'tel') result.phone = prop[3];
                        if (prop[0] === 'adr' && Array.isArray(prop[3])) {
                            result.street = prop[3][2] || '';
                            result.city = prop[3][3] || '';
                            result.state = prop[3][4] || '';
                            result.postal = prop[3][5] || '';
                            result.country = prop[3][6] || '';
                        }
                    }
                    return result;
                };

                const parseEntity = (entity, depth = 0) => {
                    if (!entity || depth > 2) return;
                    const roles = entity.roles || [];
                    const vcard = parseVcard(entity.vcardArray);

                    if (roles.includes('registrar')) {
                        registrar.name = vcard.name || vcard.org || '';
                        registrar.email = vcard.email || '';
                        registrar.phone = vcard.phone || '';
                        if (entity.publicIds) {
                            for (const id of entity.publicIds) {
                                if (id.type === 'IANA Registrar ID') registrar.iana = id.identifier;
                            }
                        }
                        if (entity.links) {
                            for (const link of entity.links) {
                                if (link.rel === 'self') registrar.url = link.href;
                            }
                        }
                    }
                    if (roles.includes('registrant')) {
                        Object.assign(registrant, vcard);
                    }
                    if (roles.includes('administrative')) {
                        Object.assign(admin, vcard);
                    }
                    if (roles.includes('technical')) {
                        Object.assign(tech, vcard);
                    }

                    // Check nested entities
                    if (entity.entities) {
                        for (const nested of entity.entities) {
                            parseEntity(nested, depth + 1);
                        }
                    }
                };

                if (data.entities) {
                    for (const entity of data.entities) {
                        parseEntity(entity);
                    }
                }

                // Dates
                let created = '', updated = '', expires = '';
                if (data.events) {
                    for (const e of data.events) {
                        if (e.eventAction === 'registration') created = e.eventDate;
                        if (e.eventAction === 'expiration') expires = e.eventDate;
                        if (e.eventAction === 'last changed') updated = e.eventDate;
                    }
                }

                rawData += `Registrar WHOIS Server: ${registrar.whoisServer}\n`;
                rawData += `Registrar URL: ${registrar.url}\n`;
                rawData += `Updated Date: ${updated}\n`;
                rawData += `Creation Date: ${created}\n`;
                rawData += `Registry Expiry Date: ${expires}\n`;
                rawData += `Registrar: ${registrar.name}\n`;
                rawData += `Registrar IANA ID: ${registrar.iana}\n`;
                rawData += `Registrar Abuse Contact Email: ${registrar.email}\n`;
                rawData += `Registrar Abuse Contact Phone: ${registrar.phone}\n`;

                // Status
                if (data.status) {
                    for (const s of data.status) {
                        rawData += `Domain Status: ${s}\n`;
                    }
                }

                // Registrant
                rawData += `Registry Registrant ID: \n`;
                rawData += `Registrant Name: ${registrant.name}\n`;
                rawData += `Registrant Organization: ${registrant.org}\n`;
                rawData += `Registrant Street: ${registrant.street}\n`;
                rawData += `Registrant City: ${registrant.city}\n`;
                rawData += `Registrant State/Province: ${registrant.state}\n`;
                rawData += `Registrant Postal Code: ${registrant.postal}\n`;
                rawData += `Registrant Country: ${registrant.country}\n`;
                rawData += `Registrant Phone: ${registrant.phone}\n`;
                rawData += `Registrant Phone Ext: \n`;
                rawData += `Registrant Fax: \n`;
                rawData += `Registrant Fax Ext: \n`;
                rawData += `Registrant Email: ${registrant.email}\n`;

                // Admin
                rawData += `Registry Admin ID: \n`;
                rawData += `Admin Name: ${admin.name}\n`;
                rawData += `Admin Organization: ${admin.org}\n`;
                rawData += `Admin Street: \n`;
                rawData += `Admin City: \n`;
                rawData += `Admin State/Province: ${admin.state}\n`;
                rawData += `Admin Postal Code: \n`;
                rawData += `Admin Country: ${admin.country}\n`;
                rawData += `Admin Phone: ${admin.phone}\n`;
                rawData += `Admin Phone Ext: \n`;
                rawData += `Admin Fax: \n`;
                rawData += `Admin Fax Ext: \n`;
                rawData += `Admin Email: ${admin.email}\n`;

                // Tech
                rawData += `Registry Tech ID: \n`;
                rawData += `Tech Name: ${tech.name}\n`;
                rawData += `Tech Organization: ${tech.org}\n`;
                rawData += `Tech Street: \n`;
                rawData += `Tech City: \n`;
                rawData += `Tech State/Province: ${tech.state}\n`;
                rawData += `Tech Postal Code: \n`;
                rawData += `Tech Country: ${tech.country}\n`;
                rawData += `Tech Phone: ${tech.phone}\n`;
                rawData += `Tech Phone Ext: \n`;
                rawData += `Tech Fax: \n`;
                rawData += `Tech Fax Ext: \n`;
                rawData += `Tech Email: ${tech.email}\n`;

                // Name servers
                if (data.nameservers) {
                    for (const ns of data.nameservers) {
                        rawData += `Name Server: ${ns.ldhName || ''}\n`;
                    }
                }

                rawData += `DNSSEC: ${data.secureDNS?.delegationSigned ? 'signedDelegation' : 'unsigned'}\n`;
                rawData += `Source: RDAP (Verisign)\n`;

                parsed = {
                    domainName: data.ldhName || cleanDomain.toUpperCase(),
                    registrar: registrar.name,
                    creationDate: created,
                    expiryDate: expires,
                    updatedDate: updated,
                    registrantOrganization: registrant.org,
                    registrantCountry: registrant.country,
                    registrantState: registrant.state,
                    nameServer: data.nameservers?.map(ns => ns.ldhName) || [],
                    domainStatus: data.status
                };
            }
        } catch (e) {
            console.error('Verisign RDAP error:', e);
        }

        // If Verisign failed, try generic RDAP
        if (!rawData) {
            try {
                const rdapResponse = await fetch(`https://rdap.org/domain/${cleanDomain}`, {
                    headers: { 'Accept': 'application/rdap+json' }
                });

                if (rdapResponse.ok) {
                    const data = await rdapResponse.json();
                    rawData = JSON.stringify(data, null, 2);
                    parsed = { domainName: cleanDomain.toUpperCase() };
                }
            } catch (e) {
                console.error('RDAP.org error:', e);
            }
        }

        if (!rawData) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'WHOIS data not found' })
            };
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
