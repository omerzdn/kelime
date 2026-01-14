import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './NSLookup.css';

const DNS_TABS = [
    { id: 'cloudflare', name: 'Cloudflare' },
    { id: 'google', name: 'Google DNS' },
    { id: 'authoritative', name: 'Authoritative' },
];

const TOOL_TABS = [
    { id: 'dns', name: 'DNS Records' },
    { id: 'whois', name: 'Whois' },
];

const formatTTL = (seconds) => {
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
    return `${seconds}s`;
};

export default function NSLookup() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [domain, setDomain] = useState(searchParams.get('domain') || '');
    const [searchInput, setSearchInput] = useState(searchParams.get('domain') || '');
    const [activeTab, setActiveTab] = useState('cloudflare');
    const [activeTool, setActiveTool] = useState('dns');
    const [loading, setLoading] = useState(false);
    const [dnsResults, setDnsResults] = useState(null);
    const [whoisResults, setWhoisResults] = useState(null);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(!!searchParams.get('domain'));

    const DOH_SERVERS = {
        cloudflare: 'https://cloudflare-dns.com/dns-query',
        google: 'https://dns.google/resolve',
        authoritative: 'https://cloudflare-dns.com/dns-query'
    };

    const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'];

    useEffect(() => {
        if (searchParams.get('domain')) {
            setDomain(searchParams.get('domain'));
            setSearchInput(searchParams.get('domain'));
            setHasSearched(true);
            if (activeTool === 'dns') {
                fetchDNS(searchParams.get('domain'), activeTab);
            } else {
                fetchWhois(searchParams.get('domain'));
            }
        }
    }, []);

    const fetchDNS = async (domainToLookup, server) => {
        setLoading(true);
        setError(null);

        try {
            const results = { a: [], aaaa: [], cname: [], mx: [], txt: [], ns: [], soa: null };
            const dohUrl = DOH_SERVERS[server] || DOH_SERVERS.cloudflare;

            const promises = RECORD_TYPES.map(async (type) => {
                try {
                    const url = `${dohUrl}?name=${encodeURIComponent(domainToLookup)}&type=${type}`;
                    const response = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
                    if (!response.ok) return;
                    const data = await response.json();

                    if (data && data.Answer) {
                        switch (type) {
                            case 'A':
                                results.a = data.Answer.filter(r => r.type === 1).map(r => ({ ip: r.data, ttl: r.TTL || 300 }));
                                break;
                            case 'AAAA':
                                results.aaaa = data.Answer.filter(r => r.type === 28).map(r => ({ ip: r.data, ttl: r.TTL || 300 }));
                                break;
                            case 'CNAME':
                                results.cname = data.Answer.filter(r => r.type === 5).map(r => ({ name: r.data, ttl: r.TTL || 300 }));
                                break;
                            case 'MX':
                                results.mx = data.Answer.filter(r => r.type === 15).map(r => {
                                    const parts = r.data.split(' ');
                                    return { priority: parseInt(parts[0]) || 10, exchange: parts[1] || r.data, ttl: r.TTL || 300 };
                                });
                                break;
                            case 'TXT':
                                results.txt = data.Answer.filter(r => r.type === 16).map(r => ({ value: r.data.replace(/^"|"$/g, ''), ttl: r.TTL || 300 }));
                                break;
                            case 'NS':
                                results.ns = data.Answer.filter(r => r.type === 2).map(r => ({ nameserver: r.data, ttl: r.TTL || 3600 }));
                                break;
                            case 'SOA':
                                const soaRecord = data.Answer?.find(r => r.type === 6);
                                if (soaRecord) {
                                    const parts = soaRecord.data.split(' ');
                                    results.soa = {
                                        nsname: parts[0] || '', hostmaster: parts[1] || '', serial: parseInt(parts[2]) || 0,
                                        refresh: parseInt(parts[3]) || 0, retry: parseInt(parts[4]) || 0,
                                        expire: parseInt(parts[5]) || 0, minttl: parseInt(parts[6]) || soaRecord.TTL || 3600
                                    };
                                }
                                break;
                        }
                    }
                } catch (e) { console.error(`Error fetching ${type} records:`, e); }
            });

            await Promise.all(promises);
            setDnsResults({ domain: domainToLookup, server, records: results, timestamp: new Date().toISOString() });
        } catch (err) {
            setError('DNS lookup failed. Please try again.');
        }
        setLoading(false);
    };

    const fetchWhois = async (domainToLookup) => {
        setLoading(true);
        setError(null);

        try {
            // Try Netlify function first (for real WHOIS data in production)
            let useRdapFallback = false;

            try {
                const response = await fetch(`/.netlify/functions/whois?domain=${encodeURIComponent(domainToLookup)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.raw) {
                        setWhoisResults({
                            domain: domainToLookup,
                            raw: data.raw,
                            parsed: data.parsed || {},
                            timestamp: new Date().toISOString()
                        });
                        setLoading(false);
                        return;
                    }
                }
                useRdapFallback = true;
            } catch (e) {
                useRdapFallback = true;
            }

            // Fallback to RDAP (for local development)
            if (useRdapFallback) {
                const rdapResponse = await fetch(`https://rdap.org/domain/${domainToLookup}`, {
                    headers: { 'Accept': 'application/rdap+json, application/json' }
                });

                if (rdapResponse.ok) {
                    const data = await rdapResponse.json();
                    const parsed = { domainName: data.ldhName || domainToLookup.toUpperCase() };

                    if (data.events) {
                        for (const event of data.events) {
                            if (event.eventAction === 'registration') parsed.creationDate = event.eventDate;
                            else if (event.eventAction === 'expiration') parsed.expiryDate = event.eventDate;
                        }
                    }
                    if (data.status) parsed.domainStatus = data.status;
                    if (data.nameservers) parsed.nameServer = data.nameservers.map(ns => ns.ldhName || ns);
                    if (data.entities) {
                        for (const entity of data.entities) {
                            if (entity.roles?.includes('registrar') && entity.vcardArray) {
                                for (const prop of entity.vcardArray[1] || []) {
                                    if (prop[0] === 'fn') parsed.registrar = prop[3];
                                }
                            }
                        }
                    }

                    setWhoisResults({
                        domain: domainToLookup,
                        raw: JSON.stringify(data, null, 2),
                        parsed: parsed,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    setWhoisResults({
                        domain: domainToLookup,
                        raw: 'WHOIS data not available for this domain.',
                        parsed: { domainName: domainToLookup.toUpperCase() },
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (err) {
            console.error('WHOIS error:', err);
            setWhoisResults({
                domain: domainToLookup,
                raw: 'Failed to fetch WHOIS data.',
                parsed: { domainName: domainToLookup.toUpperCase() },
                timestamp: new Date().toISOString()
            });
        }
        setLoading(false);
    };

    const parseRDAPData = (data, domain) => {
        const result = { raw: JSON.stringify(data, null, 2), parsed: {} };
        result.parsed.domainName = data.ldhName || domain.toUpperCase();
        if (data.events) {
            for (const event of data.events) {
                if (event.eventAction === 'registration') result.parsed.creationDate = event.eventDate;
                else if (event.eventAction === 'expiration') result.parsed.expiryDate = event.eventDate;
                else if (event.eventAction === 'last changed') result.parsed.updatedDate = event.eventDate;
            }
        }
        if (data.status) result.parsed.status = data.status;
        if (data.nameservers) result.parsed.nameServers = data.nameservers.map(ns => ns.ldhName || ns);
        if (data.entities) {
            for (const entity of data.entities) {
                const roles = entity.roles || [];
                if (roles.includes('registrar') && entity.vcardArray) {
                    const vcard = entity.vcardArray[1] || [];
                    for (const prop of vcard) {
                        if (prop[0] === 'fn') result.parsed.registrar = prop[3];
                    }
                }
            }
        }
        return result;
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;
        const cleanDomain = searchInput.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
        setDomain(cleanDomain);
        setSearchParams({ domain: cleanDomain });
        setHasSearched(true);
        if (activeTool === 'dns') fetchDNS(cleanDomain, activeTab);
        else fetchWhois(cleanDomain);
    };

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (domain) fetchDNS(domain, tabId);
    };

    const handleToolChange = (toolId) => {
        setActiveTool(toolId);
        if (domain) {
            if (toolId === 'dns') fetchDNS(domain, activeTab);
            else fetchWhois(domain);
        }
    };

    const renderDNSResults = () => {
        if (!dnsResults) return null;
        const { records } = dnsResults;

        return (
            <div className="dns-results">
                <div className="info-banner">
                    The <strong>{activeTab === 'cloudflare' ? 'Cloudflare' : activeTab === 'google' ? 'Google' : 'Authoritative'}</strong> DNS server responded with these DNS records.
                </div>

                <section className="record-section">
                    <h2>A records</h2>
                    {records.a?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>IPv4 address</th><th>TTL</th></tr></thead>
                            <tbody>{records.a.map((r, i) => <tr key={i}><td>{r.ip}</td><td>{formatTTL(r.ttl)}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="no-records">No A records found.</p>}
                </section>

                <section className="record-section">
                    <h2>AAAA records</h2>
                    {records.aaaa?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>IPv6 address</th><th>TTL</th></tr></thead>
                            <tbody>{records.aaaa.map((r, i) => <tr key={i}><td>{r.ip}</td><td>{formatTTL(r.ttl)}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="no-records">No AAAA records found.</p>}
                </section>

                <section className="record-section">
                    <h2>CNAME record</h2>
                    {records.cname?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>Canonical name</th><th>TTL</th></tr></thead>
                            <tbody>{records.cname.map((r, i) => <tr key={i}><td>{r.name}</td><td>{formatTTL(r.ttl)}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="no-records">No CNAME record found.</p>}
                </section>

                <section className="record-section">
                    <h2>TXT records</h2>
                    {records.txt?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>Value</th><th>TTL</th></tr></thead>
                            <tbody>{records.txt.map((r, i) => <tr key={i}><td className="txt-value">{r.value}</td><td>{formatTTL(r.ttl)}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="no-records">No TXT records found.</p>}
                </section>

                <section className="record-section">
                    <h2>NS records</h2>
                    {records.ns?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>Name server</th><th>TTL</th></tr></thead>
                            <tbody>{records.ns.map((r, i) => <tr key={i}><td className="link">{r.nameserver}</td><td>{formatTTL(r.ttl)}</td></tr>)}</tbody>
                        </table>
                    ) : <p className="no-records">No NS records found.</p>}
                </section>

                <section className="record-section">
                    <h2>MX records</h2>
                    {records.mx?.length > 0 ? (
                        <table className="record-table">
                            <thead><tr><th>Mail server</th><th>Priority</th><th>TTL</th></tr></thead>
                            <tbody>
                                {records.mx.map((r, i) => (
                                    <tr key={i}>
                                        <td className="link">{r.exchange}</td>
                                        <td>{r.priority} {r.priority <= 10 && <span className="badge">Primary</span>}</td>
                                        <td>{formatTTL(r.ttl)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="no-records">No MX records found.</p>}
                </section>

                {records.soa && (
                    <section className="record-section">
                        <h2>SOA record</h2>
                        <table className="record-table">
                            <tbody>
                                <tr><td>Primary NS</td><td className="link">{records.soa.nsname}</td></tr>
                                <tr><td>Email</td><td>{records.soa.hostmaster.replace('.', '@')}</td></tr>
                                <tr><td>Serial</td><td>{records.soa.serial}</td></tr>
                                <tr><td>Refresh</td><td>{formatTTL(records.soa.refresh)}</td></tr>
                                <tr><td>Retry</td><td>{formatTTL(records.soa.retry)}</td></tr>
                                <tr><td>Expire</td><td>{formatTTL(records.soa.expire)}</td></tr>
                                <tr><td>TTL</td><td>{formatTTL(records.soa.minttl)}</td></tr>
                            </tbody>
                        </table>
                    </section>
                )}
            </div>
        );
    };

    const renderWhoisResults = () => {
        if (!whoisResults) return null;
        const { parsed } = whoisResults;

        // Get all keys from parsed object for display
        const displayFields = Object.entries(parsed || {}).filter(([key, value]) =>
            value && key !== 'status' && !Array.isArray(value)
        );

        return (
            <div className="whois-results">
                <div className="info-banner">WHOIS information for <strong>{whoisResults.domain}</strong></div>

                {displayFields.length > 0 && (
                    <section className="record-section">
                        <h2>Domain Information</h2>
                        <table className="record-table">
                            <tbody>
                                {displayFields.map(([key, value], i) => (
                                    <tr key={i}>
                                        <td>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</td>
                                        <td>{typeof value === 'string' ? value : JSON.stringify(value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {parsed?.nameServer && (
                    <section className="record-section">
                        <h2>Name Servers</h2>
                        <table className="record-table">
                            <tbody>
                                {(Array.isArray(parsed.nameServer) ? parsed.nameServer : [parsed.nameServer]).map((ns, i) => (
                                    <tr key={i}><td className="link">{ns}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {parsed?.domainStatus && (
                    <section className="record-section">
                        <h2>Status</h2>
                        <div className="status-list">
                            {(Array.isArray(parsed.domainStatus) ? parsed.domainStatus : [parsed.domainStatus]).map((s, i) => (
                                <span key={i} className="status-badge">{s}</span>
                            ))}
                        </div>
                    </section>
                )}

                <section className="raw-section">
                    <h2>Raw WHOIS Data</h2>
                    <pre className="raw-data">{whoisResults.raw}</pre>
                </section>
            </div>
        );
    };

    return (
        <div className="ns-container">
            {/* Header - only shows after search */}
            {hasSearched && (
                <header className="ns-header">
                    <a href="/ns" className="logo" onClick={(e) => { e.preventDefault(); setHasSearched(false); setDomain(''); setSearchInput(''); setSearchParams({}); }}>NsLookup.io</a>
                    <form className="header-search" onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder="example.com"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <button type="submit">Find DNS records</button>
                    </form>
                </header>
            )}

            <main className="ns-main">
                {/* Hero - shows only before search */}
                {!hasSearched && (
                    <div className="hero">
                        <h1>NsLookup.io</h1>
                        <p>DNS Lookup Tool</p>
                        <form className="hero-search" onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="Enter domain name (e.g. example.com)"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                            <button type="submit">Find DNS records</button>
                        </form>
                    </div>
                )}

                {/* Results */}
                {hasSearched && domain && (
                    <>
                        <h1 className="results-title">
                            {activeTool === 'dns' ? 'DNS records' : 'WHOIS'} for <span>{domain}</span>
                        </h1>

                        <div className="tabs">
                            {TOOL_TABS.map((tab) => (
                                <button key={tab.id} className={activeTool === tab.id ? 'active' : ''} onClick={() => handleToolChange(tab.id)}>
                                    {tab.name}
                                </button>
                            ))}
                        </div>

                        {activeTool === 'dns' && (
                            <div className="dns-tabs">
                                {DNS_TABS.map((tab) => (
                                    <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => handleTabChange(tab.id)}>
                                        {tab.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {loading && <div className="loading"><div className="spinner"></div><p>Loading...</p></div>}
                        {error && <div className="error">{error}</div>}
                        {!loading && !error && activeTool === 'dns' && renderDNSResults()}
                        {!loading && !error && activeTool === 'whois' && renderWhoisResults()}
                    </>
                )}
            </main>
        </div>
    );
}
