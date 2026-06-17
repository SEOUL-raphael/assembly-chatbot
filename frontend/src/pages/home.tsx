import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Building2, User, Bot, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const API_URL = import.meta.env.VITE_API_URL || "https://assembly-chatbot-api.neoulneoul.workers.dev";

const SAMPLE_QUESTIONS = [
  "법제사법위원회 소속 의원을 알려주세요",
  "최근 발의된 법안 목록 보여주세요",
  "이번 달 본회의 일정 알려주세요",
  "국회예산정책처 최신 보고서는?",
  "현재 진행 중인 입법예고는?",
  "민법을 법제처에서 검색해주세요",
  "이재명 의원의 의정활동을 알려주세요",
  "국회도서관에서 인공지능 관련 자료 검색",
];

const TOOL_NAME_MAP: Record<string, string> = {
  get_assembly_members: "국회의원 데이터 조회",
  get_bills: "의안(법안) 데이터 조회",
  get_vote_results: "표결 결과 조회",
  get_assembly_schedule: "국회 일정 조회",
  get_petitions: "청원 데이터 조회",
  get_committee_proceedings: "위원회 심사 현황 조회",
  get_legislation_notices: "입법예고 조회",
  get_committee_info: "위원회 현황 조회",
  get_nabo_reports: "국회예산정책처(NABO) 보고서 조회",
  get_lawmaking_notices: "국민참여입법센터 조회",
  search_korean_law: "법제처 법령 검색",
  search_member_activity: "의원 의정활동 조회",
  get_bill_review: "의안 심사 정보 조회",
  search_research_reports: "국회입법조사처 보고서 검색",
  search_library: "국회도서관 자료 검색",
  get_budget_analysis: "국회예산정책처 분석 자료 조회",
};

interface ToolCall {
  name: string;
  arguments: string;
  result?: string;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function sendChat(messages: ChatMessage[]) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 오류 (${res.status}): ${err}`);
  }
  return res.json() as Promise<{ message: ChatMessage; toolCalls?: ToolCall[] }>;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatTurn[]>([{
    id: "welcome",
    role: "assistant",
    content: "안녕하십니까. 대한민국 국회 공공데이터 AI 챗봇입니다.\n\n국회의원, 의안(법안), 회의 일정, 국민동의청원, 입법예고, 위원회 현황, 국회예산정책처 보고서, 법제처 법령 검색 등에 대해 질문해주시면 실제 데이터를 조회하여 답변해 드리겠습니다.",
  }]);
  const [input, setInput] = useState("");
  const [showSamples, setShowSamples] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: sendChat,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMsg: ChatTurn = { id: `user-${Date.now()}`, role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setShowSamples(false);

    const apiMessages: ChatMessage[] = updatedMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    chatMutation.mutate(apiMessages, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: data.message.content, toolCalls: data.toolCalls },
        ]);
      },
      onError: (err) => {
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, role: "assistant", content: `오류가 발생했습니다: ${err instanceof Error ? err.message : "알 수 없는 오류"}` },
        ]);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <header className="bg-primary text-primary-foreground py-3 px-4 shadow-sm z-10 flex items-center">
        <div className="max-w-4xl w-full mx-auto flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-white shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight leading-tight">대한민국 국회 AI 챗봇</h1>
            <p className="text-primary-foreground/75 text-[10px] sm:text-xs mt-0.5 truncate">국회 공공데이터 기반 지능형 질의응답 서비스</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col items-center min-h-0">
        <div className="w-full max-w-4xl flex-1 flex flex-col bg-white shadow-sm border-x border-gray-100 overflow-hidden relative min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-6 overscroll-contain">
            <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-4">
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
              {chatMutation.isPending && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 text-gray-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    <span className="text-sm text-gray-500">국회 데이터를 분석하고 있습니다...</span>
                  </div>
                </div>
              )}
              {chatMutation.isError && (
                <Alert variant="destructive" className="max-w-3xl mx-auto mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류 발생</AlertTitle>
                  <AlertDescription>{(chatMutation.error as Error)?.message || "서버와 통신하는 중 문제가 발생했습니다."}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="p-3 sm:p-5 bg-white border-t border-gray-100 shrink-0">
            <div className="max-w-3xl mx-auto">
              {showSamples && messages.length === 1 && !chatMutation.isPending && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-2 text-center">예시 질문을 눌러보세요</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {SAMPLE_QUESTIONS.map((q, i) => (
                      <Button key={i} variant="outline" size="sm"
                        className="text-xs sm:text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200 h-auto py-1.5 px-2.5 whitespace-normal text-left"
                        onClick={() => handleSend(q)}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="국회와 관련된 질문을 입력하세요. (Shift+Enter로 줄바꿈)"
                  className="min-h-[52px] max-h-[160px] border-0 focus-visible:ring-0 resize-none py-3.5 px-4 pr-14 bg-transparent text-sm" rows={1} />
                <div className="absolute right-2 bottom-2">
                  <Button size="icon" className="h-9 w-9 rounded-xl" disabled={!input.trim() || chatMutation.isPending} onClick={() => handleSend(input)}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-center mt-2 space-y-0.5">
                <p className="text-[11px] text-gray-400">AI가 제공하는 정보는 국회 공공 API를 기반으로 하며, 시점에 따라 실제와 차이가 있을 수 있습니다.</p>
                <p className="text-[11px] text-gray-300">
                  LLM: MiniMax M2.7 &nbsp;·&nbsp; 국회 데이터:{" "}
                  <a href="https://github.com/hollobit/assembly-api-mcp" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-400">assembly-api-mcp</a>
                  {" "}&nbsp;·&nbsp; 법령:{" "}
                  <a href="https://github.com/chrisryugj/korean-law-mcp" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-400">korean-law-mcp</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatTurn }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-2.5 sm:gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-gray-800" : "bg-primary/10"}`}>
        {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />}
      </div>
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} min-w-0 max-w-[88%] sm:max-w-[85%]`}>
        <div className={`rounded-2xl px-4 py-3 shadow-sm text-sm sm:text-[15px] leading-relaxed ${isUser ? "bg-gray-800 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"}`}>
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-2 w-full max-w-full sm:max-w-[420px]">
            {message.toolCalls.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayName = TOOL_NAME_MAP[toolCall.name] || toolCall.name;
  let formattedResult = toolCall.result;
  try { if (toolCall.result) formattedResult = JSON.stringify(JSON.parse(toolCall.result), null, 2); } catch {}
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-100/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
            <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" />
          </div>
          <span className="truncate">{displayName}</span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-gray-100 bg-white/50">
          <div className="mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">요청 파라미터</span>
            <pre className="text-[10px] sm:text-xs bg-gray-100 p-2 rounded-md overflow-x-auto text-gray-700 max-h-[120px]">{toolCall.arguments}</pre>
          </div>
          {formattedResult && (
            <div>
              <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">응답 결과</span>
              <pre className="text-[10px] sm:text-[11px] bg-gray-900 text-gray-100 p-2.5 sm:p-3 rounded-md overflow-x-auto max-h-[200px] sm:max-h-[300px]">{formattedResult}</pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
