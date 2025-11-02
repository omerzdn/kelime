import React, { useState } from "react";

export default function TextModifier() {
  const [inputText, setInputText] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [removeWord, setRemoveWord] = useState("");
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [extractDomain, setExtractDomain] = useState(false);
  const [zendeskMode, setZendeskMode] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const [file1Content, setFile1Content] = useState("");
  const [file2Content, setFile2Content] = useState("");

  // Dosya okuma
  const readFile = (file, setter) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setter(e.target.result);
    reader.readAsText(file, "utf-8");
  };

  // Ana domain çıkarıcı
  const getMainDomain = (url) => {
    try {
      const hostname = new URL(
        url.match(/^https?:\/\//) ? url : "http://" + url
      ).hostname;
      const parts = hostname.split(".");
      if (parts.length <= 2) return hostname;
      return parts.slice(-2).join(".");
    } catch {
      return url;
    }
  };

  // Zendesk kullanıcı adı çıkarıcı
  const extractZendeskUser = (domain) => {
    const match = domain.match(
      /^([\w-]+)\.(?:[\w-]+\.)*zendesk\.com$/i
    );
    return match ? match[1] : null;
  };

  // Ana işlem fonksiyonu
  const modifyText = () => {
    let combinedInput = inputText;

    // Dosya yüklenmişse birleştir
    if (file1Content || file2Content) {
      combinedInput = [file1Content, file2Content, inputText]
        .filter(Boolean)
        .join("\n");
    }

    const lines = combinedInput.split("\n").map((l) => l.trim());
    const seen = new Set();
    const output = [];

    for (let line of lines) {
      if (!line) continue;

      if (removeWord) line = line.replaceAll(removeWord, "");

      if (zendeskMode) {
        const user = extractZendeskUser(line);
        if (user) {
          output.push(user);
          continue;
        }
      }

      if (extractDomain) line = getMainDomain(line);

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

  // Sonucu panoya kopyala
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Kopyalama başarısız: " + err.message);
    }
  };

  // Sonucu indir
  const downloadResult = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "output.txt";
    link.click();
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Metin Düzenleyici + Dosya Birleştirici</h1>

      {/* Dosya yükleme alanları */}
      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p><strong>Liste 1</strong></p>
          <input
            type="file"
            accept=".txt"
            onChange={(e) => readFile(e.target.files[0], setFile1Content)}
          />
        </div>
        <div>
          <p><strong>Liste 2</strong></p>
          <input
            type="file"
            accept=".txt"
            onChange={(e) => readFile(e.target.files[0], setFile2Content)}
          />
        </div>
      </div>

      {/* Textarea */}
      <textarea
        rows={8}
        placeholder="Veya metinleri buraya yapıştırın..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 10 }}
      />

      {/* Ayarlar */}
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

      {/* Checkboxlar */}
      <label style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
        <input
          type="checkbox"
          checked={removeDuplicates}
          onChange={(e) => setRemoveDuplicates(e.target.checked)}
          style={{ marginRight: 5 }}
        />
        Aynı satırları kaldır
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
          checked={zendeskMode}
          onChange={(e) => setZendeskMode(e.target.checked)}
          style={{ marginRight: 5 }}
        />
        Zendesk kullanıcılarını al (örnek: omer.zendesk.com → omer)
      </label>

      {/* İşlem butonları */}
      <button onClick={modifyText} style={{ marginTop: 10, padding: "10px 15px" }}>
        Dönüştür
      </button>

      {result && (
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button onClick={copyToClipboard}>
            {copied ? "✅ Kopyalandı" : "📋 Kopyala"}
          </button>
          <button onClick={downloadResult}>📄 Output.txt indir</button>
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
