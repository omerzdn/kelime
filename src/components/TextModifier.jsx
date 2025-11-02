import React, { useState } from "react";

export default function TextModifier() {
  const [inputText, setInputText] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [removeWord, setRemoveWord] = useState("");
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [extractDomain, setExtractDomain] = useState(false);
  const [removeZendesk, setRemoveZendesk] = useState(false);
  const [filterPattern, setFilterPattern] = useState("");
  const [enableNotMatch, setEnableNotMatch] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const modifyText = () => {
    const lines = inputText.split("\n");
    const seen = new Set();
    const output = [];

    const pattern =
      filterPattern && enableNotMatch
        ? new RegExp(filterPattern, "i")
        : filterPattern
        ? new RegExp(filterPattern, "i")
        : null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (removeWord) line = line.replaceAll(removeWord, "");

      // Zendesk temizleyici (omer.zendesk.com, yarrak.ssl.zendesk.com → omer, yarrak)
      if (removeZendesk) {
        const match = line.match(/^([\w\d-]+)(?:\.[\w\d-]+)*\.zendesk\./i);
        if (match) {
          line = match[1];
        }
      }

      // Ana domain çıkarma
      if (extractDomain) {
        line = getMainDomain(line);
      }

      // PowerShell -NotMatch mantığı
      if (pattern) {
        const matched = pattern.test(line);
        if (enableNotMatch ? matched : !matched) continue;
      }

      const modified = `${prefix}${line}${suffix}`;

      if (removeDuplicates) {
        const key = modified.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
      }

      output.push(modified);
    }

    setResult(output.join("\n"));
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Kopyalama başarısız: " + err.message);
    }
  };

  const getMainDomain = (url) => {
    try {
      const normalized = url.match(/^https?:\/\//) ? url : "http://" + url;
      const hostname = new URL(normalized).hostname;
      const parts = hostname.split(".");
      if (parts.length < 2) return hostname;
      return parts.slice(-2).join(".");
    } catch {
      return url;
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Metin Düzenleyici</h1>

      <textarea
        rows={10}
        placeholder="Metinleri buraya yapıştırın..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 10 }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <input
          placeholder="Başına eklenecek..."
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
        <input
          placeholder="Sonuna eklenecek..."
          value={suffix}
          onChange={(e) => setSuffix(e.target.value)}
        />
        <input
          placeholder="Kaldırılacak kelime..."
          value={removeWord}
          onChange={(e) => setRemoveWord(e.target.value)}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
        <input
          type="checkbox"
          checked={removeDuplicates}
          onChange={(e) => setRemoveDuplicates(e.target.checked)}
          style={{ marginRight: 5 }}
        />
        Aynı satırları kaldır (küçük/büyük harf fark etmez)
      </label>

      <label style={{ display: "flex", alignItems: "center", marginTop: 5 }}>
        <input
          type="checkbox"
          checked={extractDomain}
          onChange={(e) => setExtractDomain(e.target.checked)}
          style={{ marginRight: 5 }}
        />
        Sadece ana domaini al (örnek: sub.sub.domain.com → domain.com)
      </label>

      <label style={{ display: "flex", alignItems: "center", marginTop: 5 }}>
        <input
          type="checkbox"
          checked={removeZendesk}
          onChange={(e) => setRemoveZendesk(e.target.checked)}
          style={{ marginRight: 5 }}
        />
        Zendesk temizleyici (örnek: omer.zendesk.com veya omer.ssl.zendesk.com → omer)
      </label>

      <div style={{ marginTop: 10 }}>
        <input
          placeholder="Filtre deseni (örnek: telenor.se)"
          value={filterPattern}
          onChange={(e) => setFilterPattern(e.target.value)}
          style={{ width: "100%", padding: 5 }}
        />
        <label style={{ display: "flex", alignItems: "center", marginTop: 5 }}>
          <input
            type="checkbox"
            checked={enableNotMatch}
            onChange={(e) => setEnableNotMatch(e.target.checked)}
            style={{ marginRight: 5 }}
          />
          Desene *uymayan* satırları göster (-NotMatch)
        </label>
      </div>

      <button onClick={modifyText} style={{ marginTop: 10 }}>
        Dönüştür
      </button>

      {result && (
        <div style={{ marginTop: 10 }}>
          <button onClick={copyToClipboard}>
            {copied ? "Kopyalandı!" : "Sonucu Kopyala"}
          </button>
        </div>
      )}

      <textarea
        rows={10}
        placeholder="Sonuç burada görünecek..."
        value={result}
        readOnly
        style={{ width: "100%", padding: 10, marginTop: 10 }}
      />
    </div>
  );
}
