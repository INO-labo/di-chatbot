import React, { useState, useEffect, useRef } from 'react';

const Chat = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'こんにちは！ご用件をどうぞ。' }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const fetchPubMedInfo = async (query) => {
    try {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl);
      const json = await res.json();
      const idList = json.esearchresult?.idlist;

      if (idList?.length > 0) {
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${idList[0]}`;
        const summaryRes = await fetch(summaryUrl);
        const summaryJson = await summaryRes.json();
        const first = summaryJson.result[idList[0]];
        return `PubMed論文（${first.title}）\n出典: https://pubmed.ncbi.nlm.nih.gov/${idList[0]}`;
      }
      return '';
    } catch (err) {
      console.error("PubMed fetch error:", err);
      return '';
    }
  };

  const fetchDrugBankInfo = async (query) => {
    try {
      const response = await fetch(`https://go.drugbank.com/unearth/q?searcher=drugs&query=${encodeURIComponent(query)}`);
      const html = await response.text();
      const match = html.match(/<a href=\"\/drugs\/(DB\d{5})\">(.*?)<\/a>/);
      if (match) {
        const dbId = match[1];
        const title = match[2];
        return `DrugBank情報（${title}）\n出典: https://go.drugbank.com/drugs/${dbId}`;
      }
      return '';
    } catch (err) {
      console.error("DrugBank fetch error:", err);
      return '';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const [pubmedInfo, drugbankInfo] = await Promise.all([
        fetchPubMedInfo(input),
        fetchDrugBankInfo(input)
      ]);

      const supplemental = [pubmedInfo, drugbankInfo].filter(Boolean).join("\n\n");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `あなたは診療支援AI『DI アシスタント24/7』です。PMDA添付文書を基盤に、正確かつ安全な医療薬剤情報を提供してください。必要に応じて以下の出典情報を活用してください。\n\n${supplemental}`
            },
            ...messages.map(m => ({ role: m.sender === 'bot' ? 'assistant' : 'user', content: m.text })),
            { role: "user", content: input }
          ]
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]?.message?.content) {
        const botMessage = {
          sender: "bot",
          text: data.choices[0].message.content.trim()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error("応答形式が不正です");
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: "bot", text: "すみません、応答に失敗しました。" }]);
      console.error("Fetch error:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-container" style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>DI アシスタント24/7</h2>
      <div className="chat-box" style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '10px', height: '400px', overflowY: 'auto', background: '#f9f9f9' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.sender === 'bot' ? 'left' : 'right', margin: '10px 0' }}>
            <div style={{ display: 'inline-block', background: msg.sender === 'bot' ? '#e0f7fa' : '#c8e6c9', borderRadius: '10px', padding: '10px', maxWidth: '80%', whiteSpace: 'pre-wrap' }}>
              <strong>{msg.sender === 'bot' ? 'DI アシスタント24/7' : 'You'}:</strong> {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input" style={{ display: 'flex', marginTop: '10px', gap: '10px' }}>
        <button onClick={startVoiceRecognition} style={{ padding: '10px', borderRadius: '5px', backgroundColor: '#ff9800', color: '#fff', border: 'none' }}>🎤</button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
          placeholder="質問を入力..."
          style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button
          onClick={handleSend}
          disabled={isSending}
          style={{ padding: '10px 20px', borderRadius: '5px', backgroundColor: '#007bff', color: '#fff', border: 'none' }}
        >
          送信
        </button>
      </div>
    </div>
  );
};

export default Chat;
