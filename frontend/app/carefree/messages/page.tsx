"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AssistantMessage,
  AssistantSessionData,
  AssistantUiHint,
  endSession,
  sendMessage,
  startSession,
} from "@/fetchers/assistant";
import type { Caretaker } from "@/fetchers/users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersistentAvatar } from "@/components/persistent-avatar-image";
import { Bot, CheckCircle, LifeBuoy, Send, StopCircle, User } from "lucide-react";

const TypingIndicator = () => (
  <div className="flex space-x-1 h-3 items-center">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
  </div>
);

function defaultUiHint(): AssistantUiHint {
  return {
    welcome_message:
      "Bok, ja sam Julija, tvoj CareFree AI asistent. Ovdje možeš mirno napisati što ti je trenutno najviše na umu. Možemo samo razgovarati, a ako poželiš, kasnije ti mogu pomoći i pronaći psihologa.",
    can_recommend_psychologists: true,
    crisis_contacts: {
      urgent: "112",
      crisis_center: "01 2376 335",
      plavi_telefon: "01 4833 888",
    },
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<AssistantSessionData | null>(null);
  const [uiHint, setUiHint] = useState<AssistantUiHint>(defaultUiHint);
  const [recommendedCaretakers, setRecommendedCaretakers] = useState<Caretaker[]>([]);
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionInitialized = useRef(false);

  const sessionClosed = session ? !session.is_active : false;
  const hasStudentMessages = messages.some((message) => message.sender === "student");
  const showRecommendations = sessionClosed && recommendedCaretakers.length > 0;
  const showSupportClosure =
    sessionClosed && recommendedCaretakers.length === 0 && session?.closure_reason !== "manual";

  useEffect(() => {
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;

    const initSession = async () => {
      const res = await startSession();
      setSession(res.session);
      setUiHint(res.ui_hint);
      setPageError(null);
      setSendError(null);

      if (res.messages.length > 0) {
        setMessages(res.messages);
        return;
      }

      setMessages([
        {
          id: 0,
          sender: "bot",
          content: res.ui_hint.welcome_message,
          created_at: new Date().toISOString(),
        },
      ]);
    };

    initSession().catch((error) => {
      console.error("Greška pri pokretanju sesije:", error);
      setPageError((error as Error).message);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, showRecommendations, showSupportClosure]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading || sessionClosed) return;

    const tempContent = inputValue;
    setInputValue("");
    setIsLoading(true);
    setSendError(null);

    const tempUserMessage: AssistantMessage = {
      id: Date.now(),
      sender: "student",
      content: tempContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await sendMessage(tempContent);
      setPageError(null);

      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== tempUserMessage.id);
        return [...filtered, response.user_message, response.bot_message];
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              is_active: !response.session_closed,
              mode: response.session_mode,
              status: response.session_status,
              danger_flag: response.danger_flag,
            }
          : null
      );
      setUiHint(response.ui_hint);
      setRecommendedCaretakers(response.recommended_caretakers || []);
      setSummaryId(response.summary_id);
    } catch (error) {
      console.error("Greška pri slanju:", error);
      setPageError((error as Error).message);
      setSendError("Poruka nije poslana. Možeš pokušati ponovno.");
      setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id));
      setInputValue(tempContent);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Želiš li završiti razgovor za sada?")) return;
    try {
      const response = await endSession();
      setPageError(null);
      setSummaryId(response.summary_id);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              is_active: false,
              status: response.session_status,
              closure_reason: "manual",
            }
          : prev
      );
      router.push("/carefree/main");
    } catch (error) {
      console.error("Greška pri završetku:", error);
      setPageError((error as Error).message);
    }
  };

  const crisisContacts = uiHint.crisis_contacts;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto py-6">
      {session?.danger_flag && (
        <Alert className="mx-4 mb-4 border-amber-300 bg-amber-50 text-amber-950">
          <LifeBuoy className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              Ako si sada u neposrednoj opasnosti ili misliš da bi si mogao/la nauditi, odmah potraži pomoć.
            </p>
            <p>
              Hitna pomoć: <strong>{crisisContacts.urgent}</strong> · Centar za krizna stanja i prevenciju suicida:{" "}
              <strong>{crisisContacts.crisis_center}</strong> · Plavi telefon: <strong>{crisisContacts.plavi_telefon}</strong>
            </p>
          </AlertDescription>
        </Alert>
      )}

      {pageError && (
        <Alert className="mx-4 mb-4 border-rose-300 bg-rose-50 text-rose-900">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {showRecommendations && (
        <Card className="mb-4 w-full border-slate-200 bg-slate-50">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-green-600 text-white p-2 rounded-full">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Za danas možemo stati ovdje</CardTitle>
                <CardDescription className="mt-1 text-green-800">
                  Na temelju onoga što si podijelio/la, izdvojila sam nekoliko psihologa koji se bave ovakvim temama.
                </CardDescription>
                <CardDescription className="mt-2 text-slate-600">
                  Ako želiš, možeš mirno pogledati njihove profile i odlučiti odgovara li ti netko od njih.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {recommendedCaretakers.map((caretaker) => (
              <Card key={caretaker.user_id} className="h-full">
                <CardContent className="p-4 flex flex-col items-center text-center h-full">
                  <PersistentAvatar
                    cacheKey={`assistant:${caretaker.user_id}`}
                    src={caretaker.user_image_url}
                    alt={`${caretaker.first_name} ${caretaker.last_name}`}
                    className="w-14 h-14 mb-3"
                    fallback={<>{caretaker.first_name[0]}{caretaker.last_name[0]}</>}
                  />
                  <h4 className="font-semibold">
                    {caretaker.first_name} {caretaker.last_name}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                    {caretaker.about_me || "Psiholog"}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {caretaker.help_categories.slice(0, 3).map((cat) => (
                      <span key={cat} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <Link href={`/carefree/caretaker/${caretaker.user_id}`} className="w-full mt-4">
                    <Button className="w-full">Vidi profil</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </CardContent>
          <CardFooter className="gap-2 flex-wrap">
            {summaryId && (
              <Button variant="outline" onClick={() => router.push(`/carefree/assistant/summary/${summaryId}`)}>
                Vidi sažetak razgovora
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/carefree/search")}>
              Pretraži sve psihologe
            </Button>
            <Button onClick={() => router.push("/carefree/main")}>Povratak na početnu</Button>
          </CardFooter>
        </Card>
      )}

      {showSupportClosure && (
        <Card className="mb-4 w-full border-slate-200 bg-slate-50">
          <CardHeader>
            <CardTitle>Za danas možemo stati ovdje</CardTitle>
            <CardDescription>
              Hvala ti što si bio/la ovdje. Razgovor je spremljen, a ako poželiš, uvijek se možeš vratiti i nastaviti drugi put.
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2 flex-wrap">
            {summaryId && (
              <Button variant="outline" onClick={() => router.push(`/carefree/assistant/summary/${summaryId}`)}>
                Vidi sažetak razgovora
              </Button>
            )}
            <Button onClick={() => router.push("/carefree/main")}>Povratak na početnu</Button>
          </CardFooter>
        </Card>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col gap-0 py-0 shadow-inner bg-white border border-slate-200">
        <CardHeader className="border-b border-slate-200 bg-white px-3.5 pt-4 pb-0">
          <div className="-mb-1 flex items-end justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-white p-2 rounded-full border border-slate-200">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-0">
                <CardTitle className="text-[1.05rem] font-semibold text-slate-900">
                  Julija
                </CardTitle>
                <CardDescription className="text-sm leading-tight text-slate-600">
                  Mjesto za miran i privatan razgovor, uz podršku i nježno usmjeravanje kad ti zatreba.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndSession}
              disabled={!session || sessionClosed || !hasStudentMessages}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Završi razgovor
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto px-3 pt-2.5 pb-2.5 space-y-3.5 bg-white">
          {messages.map((msg) => (
            <div
              key={`${msg.id}-${msg.created_at}`}
              className={`flex w-full ${msg.sender === "student" ? "justify-end" : "justify-start pl-1"}`}
            >
              <div className={`flex max-w-[80%] gap-3 ${msg.sender === "student" ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className="w-8 h-8 mt-1">
                  {msg.sender === "student" ? (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-teal-600 text-white">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>

                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.sender === "student"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-white border border-slate-200 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex w-full justify-start pl-1">
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback className="bg-teal-600 text-white">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center">
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <CardFooter className="bg-white border-t border-slate-200 px-2 pt-2 pb-4">
          <div className="flex w-full items-center pl-1">
            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={sessionClosed ? "Razgovor je završen" : "Napiši poruku..."}
                className="flex-1"
                autoFocus
                disabled={isLoading || sessionClosed}
              />
              <Button type="submit" disabled={isLoading || !inputValue.trim() || sessionClosed}>
                <Send className="w-4 h-4" />
                <span className="sr-only">Pošalji</span>
              </Button>
            </form>
            {sendError && !sessionClosed && (
              <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-rose-700">
                <span>{sendError}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 text-xs text-rose-700 hover:bg-transparent hover:text-rose-800"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputValue.trim()}
                >
                  Pokušaj ponovno
                </Button>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
