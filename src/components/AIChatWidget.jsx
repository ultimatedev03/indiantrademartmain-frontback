import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Globe2, Sparkles, Loader2, X, Bot, WifiOff, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_CHAT_API_URL || '/api/chat';
const DEFAULT_PROVIDER = 'openai';
const brandPrimary = '#f57c43'; // accent
const brandDeep = '#0d3b66';    // deep blue

const uiCopy = {
  en: {
    title: 'Khushi from ITM',
    subtitle: 'Your Indian Trade Mart assistant',
    placeholder: 'Type your question...',
    send: 'Send',
    language: 'Language',
    quick: 'Quick asks',
    typing: 'Thinking...',
    error: 'Something went wrong. Please try again.',
  },
  hi: {
    title: 'खुशी फ्रॉम ITM',
    subtitle: 'आपकी Indian Trade Mart सहायक',
    placeholder: 'अपना सवाल लिखें...',
    send: 'भेजें',
    language: 'भाषा',
    quick: 'त्वरित प्रश्न',
    typing: 'सोच रहा हूँ...',
    error: 'कुछ गड़बड़ हुई। कृपया फिर से प्रयास करें।',
  },
};

const quickPrompts = [
  { en: 'Find workers', hi: 'मज़दूर ढूंढें' },
  { en: 'Find jobs', hi: 'नौकरी खोजें' },
  { en: 'Register', hi: 'रजिस्टर करें' },
  { en: 'Contact support', hi: 'सपोर्ट से संपर्क करें' },
];

const bubbleBase =
  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[80%]';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [language, setLanguage] = useState('en');
  const [provider] = useState(DEFAULT_PROVIDER);
  const [messages, setMessages] = useState([
    { id: 'greet', role: 'assistant', text: 'Hi! I can answer in English or Hindi. How can I help?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const copy = uiCopy[language] || uiCopy.en;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    setError('');
    const userMsg = { id: Date.now(), role: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(({ role, text }) => ({
        role: role === 'assistant' ? 'assistant' : 'user',
        text,
      }));
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, provider, language }),
      });
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      const botText = data.text || copy.error;
      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, role: 'assistant', text: botText }]);
    } catch (e) {
      console.error(e);
      setError('Connection issue. Please check server/API keys and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (prompt) => {
    setInput(prompt);
    sendMessage(prompt);
  };

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
    setIsCollapsed(false);
  };

  const widgetButton = (
    <button
      type="button"
      onClick={handleOpen}
      className="fixed bottom-5 right-5 z-[9999] pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-[#fbbf8f] via-[#f57c43] to-[#f57c43] text-white px-3.5 py-2.5 rounded-full shadow-lg hover:translate-y-[-1px] hover:shadow-xl transition-all backdrop-blur"
      aria-label="Open AI chat"
    >
      <MessageCircle className="h-4.5 w-4.5" />
      <span className="text-[13px] font-semibold">Chat with Khushi</span>
      <Sparkles className="h-4 w-4 text-amber-200" />
    </button>
  );

  const header = (
    <div className="flex items-start justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-[#fff1e6] flex items-center justify-center border border-[#ffd7b3] shadow-sm">
          <span className="text-base" role="img" aria-label="assistant">🤖</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
            {copy.title}
            <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </p>
          <p className="text-[11px] text-gray-500">{copy.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed((v) => !v)} className="h-8 w-8">
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const controls = (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex flex-col gap-1">
        <span className="text-gray-500 flex items-center gap-1"><Globe2 className="h-3 w-3" /> {copy.language}</span>
        <div className="flex gap-1">
          {['en', 'hi'].map((lng) => (
            <Button
              key={lng}
              variant={language === lng ? 'default' : 'outline'}
              size="sm"
              className="h-8 flex-1"
              onClick={() => setLanguage(lng)}
            >
              {lng.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const quick = (
        <div className="space-y-2">
      <p className="text-xs text-gray-500">{copy.quick}</p>
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleQuick(p[language] || p.en)}
            className="text-[11px] px-3 py-1.5 rounded-full border bg-white transition"
            style={{
              borderColor: brandPrimary,
              color: brandPrimary,
            }}
          >
            {p[language] || p.en}
          </button>
        ))}
      </div>
    </div>
  );

  const chatBody = (
    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
      {messages.map((m) => (
        <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
          <div
            className={cn(
              bubbleBase,
              m.role === 'user'
                ? 'bg-[#0d3b66] text-white rounded-tr-none'
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
            )}
          >
            {m.text}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {copy.typing}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <WifiOff className="h-3 w-3" /> {error}
        </p>
      )}
      <div ref={bottomRef} />
    </div>
  );

  const inputBar = (
    <div className="flex items-center gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
        placeholder={copy.placeholder}
        className="flex-1 bg-gray-50 border-gray-200 focus-visible:ring-[#003D82]"
      />
      <Button
        onClick={() => sendMessage(input)}
        disabled={loading}
        className="bg-[#00A699] hover:bg-[#008c81] text-white"
      >
        <Send className="h-4 w-4 mr-1" />
        {copy.send}
      </Button>
    </div>
  );

  const panel = (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-[9999] pointer-events-auto w-full max-w-[360px] bg-white/95 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-100 flex flex-col',
        isCollapsed ? 'h-[200px]' : 'h-[540px]'
      )}
    >
      <div className="px-3.5 py-3 border-b border-gray-100 bg-gradient-to-r from-[#fff7ed] via-white to-[#eef2ff]">
        {header}
        <div className="mt-3">{controls}</div>
      </div>
      {!isCollapsed && (
        <>
          <div className="flex-1 px-3.5 py-3">{chatBody}</div>
          <div className="px-3.5 py-2.5 border-t border-gray-100 bg-gray-50">{inputBar}</div>
          <div className="px-3.5 py-2.5 border-t border-gray-100 bg-white">{quick}</div>
          <div className="px-3.5 py-2 border-t border-gray-100 text-center text-[10.5px] text-gray-500">
            Powered by <span className="font-semibold text-[#0d3b66]">Indian Trade Mart</span>
          </div>
        </>
      )}
      {isCollapsed && (
        <div className="px-4 py-3 text-xs text-gray-600 flex items-center justify-between">
          <span>Khushi is ready.</span>
          <Button size="sm" variant="secondary" onClick={() => setIsCollapsed(false)}>Expand</Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {!isOpen && widgetButton}
      {isOpen && panel}
    </>
  );
};

export default AIChatWidget;
