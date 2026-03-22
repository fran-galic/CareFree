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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersistentAvatar } from "@/components/persistent-avatar-image";
import { Bot, CheckCircle, ChevronLeft, ChevronRight, LifeBuoy, Send, StopCircle, User } from "lucide-react";

const RECOMMENDATION_STORAGE_KEY = "carefree:assistant:recommendation-state";
const RECOMMENDATION_EXPIRED_NOTICE_KEY = "carefree:assistant:recommendation-expired";
const ACTIVE_CHAT_STORAGE_KEY = "carefree:assistant:active-chat-state";
const RECOMMENDATION_TTL_MS = 20 * 60 * 1000;
const RECOMMENDATION_TRANSITION_MS = 40000;
const SUPPORT_CLOSURE_TRANSITION_MS = 15000;

interface PendingRecommendationState {
  session: AssistantSessionData;
  caretakers: Caretaker[];
  summaryText: string;
  summaryId: number | null;
}

interface ActiveChatSnapshot {
  session: AssistantSessionData | null;
  messages: AssistantMessage[];
  uiHint: AssistantUiHint;
  storedAt: number;
}

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

function buildWelcomeMessage(hint: AssistantUiHint): AssistantMessage {
  return {
    id: 0,
    sender: "bot",
    content: hint.welcome_message,
    created_at: new Date().toISOString(),
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [uiHint, setUiHint] = useState<AssistantUiHint>(defaultUiHint);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [buildWelcomeMessage(defaultUiHint())]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<AssistantSessionData | null>(null);
  const [recommendedCaretakers, setRecommendedCaretakers] = useState<Caretaker[]>([]);
  const [recommendationSummary, setRecommendationSummary] = useState("");
  const [, setRecommendationMatchScope] = useState<string | null>(null);
  const [recommendationPage, setRecommendationPage] = useState(0);
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [isRecommendationTransitioning, setIsRecommendationTransitioning] = useState(false);
  const [isSupportClosureTransitioning, setIsSupportClosureTransitioning] = useState(false);
  const [pendingRecommendation, setPendingRecommendation] = useState<PendingRecommendationState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionInitialized = useRef(false);
  const recommendationTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportClosureTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionClosed = session ? !session.is_active : false;
  const hasStudentMessages = messages.some((message) => message.sender === "student");
  const showRecommendations = sessionClosed && recommendedCaretakers.length > 0;
  const showSupportClosure =
    sessionClosed &&
    !isSupportClosureTransitioning &&
    !isRecommendationTransitioning &&
    recommendedCaretakers.length === 0 &&
    session?.closure_reason !== "manual" &&
    session?.closure_reason !== "recommendation";
  const isClosureScreen = showRecommendations || showSupportClosure;
  const showChatCard =
    isRecommendationTransitioning || isSupportClosureTransitioning || (!showRecommendations && !showSupportClosure);

  const caretakersPerPage = 3;
  const totalRecommendationPages = Math.max(1, Math.ceil(recommendedCaretakers.length / caretakersPerPage));
  const visibleCaretakers = recommendedCaretakers.slice(
    recommendationPage * caretakersPerPage,
    recommendationPage * caretakersPerPage + caretakersPerPage
  );

  const persistRecommendationState = (
    nextSession: AssistantSessionData,
    caretakers: Caretaker[],
    summaryText: string,
    nextSummaryId: number | null
  ) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      JSON.stringify({
        session: nextSession,
        recommendedCaretakers: caretakers,
        recommendationSummary: summaryText,
        summaryId: nextSummaryId,
        storedAt: Date.now(),
      })
    );
  };

  const clearRecommendationState = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(RECOMMENDATION_STORAGE_KEY);
  };

  const persistActiveChatState = (
    nextSession: AssistantSessionData | null,
    nextMessages: AssistantMessage[],
    nextUiHint: AssistantUiHint
  ) => {
    if (typeof window === "undefined") return;

    const snapshot: ActiveChatSnapshot = {
      session: nextSession,
      messages: nextMessages,
      uiHint: nextUiHint,
      storedAt: Date.now(),
    };
    window.sessionStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, JSON.stringify(snapshot));
  };

  const clearActiveChatState = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
  };

  const finalizeRecommendationTransition = (payload: PendingRecommendationState | null) => {
    if (!payload) return;
    if (recommendationTransitionTimerRef.current) {
      clearTimeout(recommendationTransitionTimerRef.current);
      recommendationTransitionTimerRef.current = null;
    }
    setRecommendedCaretakers(payload.caretakers);
    setRecommendationSummary(payload.summaryText);
    setSummaryId(payload.summaryId);
    setIsRecommendationTransitioning(false);
    setPendingRecommendation(null);
    persistRecommendationState(payload.session, payload.caretakers, payload.summaryText, payload.summaryId);
  };

  useEffect(() => {
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;

    const initSession = async () => {
      if (typeof window !== "undefined") {
        const activeChatRaw = window.sessionStorage.getItem(ACTIVE_CHAT_STORAGE_KEY);
        if (activeChatRaw) {
          try {
            const parsed = JSON.parse(activeChatRaw) as ActiveChatSnapshot;
            if (parsed.session?.is_active && parsed.messages?.length) {
              setSession(parsed.session);
              setUiHint(parsed.uiHint || defaultUiHint());
              setMessages(parsed.messages);
              setPageError(null);
              setSendError(null);
              return;
            }
            window.sessionStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
          } catch {
            window.sessionStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
          }
        }

        const stored = window.sessionStorage.getItem(RECOMMENDATION_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as {
              session: AssistantSessionData;
              recommendedCaretakers: Caretaker[];
              recommendationSummary: string;
              summaryId: number | null;
              storedAt?: number;
            };
            if (!parsed.storedAt || Date.now() - parsed.storedAt > RECOMMENDATION_TTL_MS) {
              window.sessionStorage.removeItem(RECOMMENDATION_STORAGE_KEY);
              window.sessionStorage.setItem(
                RECOMMENDATION_EXPIRED_NOTICE_KEY,
                "Prethodne preporuke više nisu aktivne pa možeš nastaviti ispočetka."
              );
              throw new Error("Recommendation snapshot expired");
            }
            setSession(parsed.session);
            setRecommendedCaretakers(parsed.recommendedCaretakers || []);
            setRecommendationSummary(parsed.recommendationSummary || "");
            setSummaryId(parsed.summaryId ?? null);
            setUiHint(defaultUiHint());
            setPageError(null);
            setSendError(null);
            setMessages([buildWelcomeMessage(defaultUiHint())]);
            return;
          } catch {
            window.sessionStorage.removeItem(RECOMMENDATION_STORAGE_KEY);
          }
        }

        const expiredNotice = window.sessionStorage.getItem(RECOMMENDATION_EXPIRED_NOTICE_KEY);
        if (expiredNotice) {
          setPageNotice(expiredNotice);
          window.sessionStorage.removeItem(RECOMMENDATION_EXPIRED_NOTICE_KEY);
        }
      }

      const res = await startSession();
      setSession(res.session);
      setUiHint(res.ui_hint);
      setPageError(null);
      setSendError(null);
      setRecommendationSummary("");
      setRecommendationMatchScope(null);
      setRecommendationPage(0);

      if (res.messages.length > 0) {
        setMessages(res.messages);
        return;
      }

      setMessages([buildWelcomeMessage(res.ui_hint)]);
    };

    initSession().catch((error) => {
      console.error("Greška pri pokretanju sesije:", error);
      setPageError((error as Error).message);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, showRecommendations, showSupportClosure]);

  useEffect(() => {
    if (sessionClosed || showRecommendations || showSupportClosure) {
      clearActiveChatState();
      return;
    }

    if (!session || messages.length === 0) {
      return;
    }

    persistActiveChatState(session, messages, uiHint);
  }, [messages, session, sessionClosed, showRecommendations, showSupportClosure, uiHint]);

  useEffect(() => {
    return () => {
      if (recommendationTransitionTimerRef.current) {
        clearTimeout(recommendationTransitionTimerRef.current);
      }
      if (supportClosureTransitionTimerRef.current) {
        clearTimeout(supportClosureTransitionTimerRef.current);
      }
    };
  }, []);

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

      const nextSession = session
        ? {
            ...session,
            is_active: !response.session_closed,
            mode: response.session_mode,
            status: response.session_status,
            danger_flag: response.danger_flag,
            closure_reason: response.session_closed && response.show_recommendations ? "recommendation" : session.closure_reason,
          }
        : null;
      setSession(nextSession);
      setUiHint(response.ui_hint);
      if (response.session_closed && response.show_recommendations && nextSession) {
        setIsRecommendationTransitioning(true);
        setIsSupportClosureTransitioning(false);
        setRecommendedCaretakers([]);
        setRecommendationSummary("");
        setRecommendationMatchScope(response.recommendation_match_scope || null);
        setRecommendationPage(0);
        setSummaryId(response.summary_id);

        if (recommendationTransitionTimerRef.current) {
          clearTimeout(recommendationTransitionTimerRef.current);
        }

        const nextPendingRecommendation = {
          session: nextSession,
          caretakers: response.recommended_caretakers || [],
          summaryText: response.recommendation_summary || "",
          summaryId: response.summary_id,
        };
        setPendingRecommendation(nextPendingRecommendation);

        recommendationTransitionTimerRef.current = setTimeout(() => {
          finalizeRecommendationTransition(nextPendingRecommendation);
        }, RECOMMENDATION_TRANSITION_MS);
      } else if (response.session_closed && !response.show_recommendations) {
        setIsRecommendationTransitioning(false);
        setPendingRecommendation(null);
        setIsSupportClosureTransitioning(true);
        setRecommendedCaretakers([]);
        setRecommendationSummary("");
        clearRecommendationState();

        if (supportClosureTransitionTimerRef.current) {
          clearTimeout(supportClosureTransitionTimerRef.current);
        }

        supportClosureTransitionTimerRef.current = setTimeout(() => {
          setIsSupportClosureTransitioning(false);
        }, SUPPORT_CLOSURE_TRANSITION_MS);
      } else {
        setRecommendedCaretakers(response.recommended_caretakers || []);
        setRecommendationSummary(response.recommendation_summary || "");
        setIsRecommendationTransitioning(false);
        setIsSupportClosureTransitioning(false);
        setPendingRecommendation(null);
      }
      setRecommendationMatchScope(response.recommendation_match_scope || null);
      setRecommendationPage(0);
      setSummaryId(response.summary_id);

      if (!response.show_recommendations) {
        clearRecommendationState();
      }
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
      setIsRecommendationTransitioning(false);
      setIsSupportClosureTransitioning(false);
      setPendingRecommendation(null);
      clearActiveChatState();
      clearRecommendationState();
      router.push("/carefree/main");
    } catch (error) {
      console.error("Greška pri završetku:", error);
      setPageError((error as Error).message);
    }
  };

  const handleContinueConversation = async () => {
    try {
      if (recommendationTransitionTimerRef.current) {
        clearTimeout(recommendationTransitionTimerRef.current);
      }
      setIsLoading(true);
      setPageError(null);
      clearRecommendationState();

      const res = await startSession();
      setSession(res.session);
      setUiHint(res.ui_hint);
      setRecommendedCaretakers([]);
      setRecommendationSummary("");
      setRecommendationPage(0);
      setSummaryId(null);
      setIsRecommendationTransitioning(false);
      setIsSupportClosureTransitioning(false);
      setPendingRecommendation(null);
      clearActiveChatState();
      setMessages([
        {
          id: 0,
          sender: "bot",
          content:
            "Možemo nastaviti tamo gdje smo stali. Ako želiš, napiši mi što ti je još ostalo na umu ili što bi volio/la dalje razjasniti.",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Greška pri nastavku razgovora:", error);
      setPageError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const crisisContacts = uiHint.crisis_contacts;

  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col py-6 ${
        isClosureScreen ? "min-h-0" : "h-[calc(100vh-6rem)]"
      }`}
    >
      {session?.danger_flag && (
        <Alert className="mb-4 w-full border-amber-300 bg-amber-50 text-amber-950">
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
        <Alert className="mb-4 w-full border-rose-300 bg-rose-50 text-rose-900">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {pageNotice && (
        <Alert className="mb-4 w-full border-slate-300 bg-slate-50 text-slate-800">
          <AlertDescription>{pageNotice}</AlertDescription>
        </Alert>
      )}

      {showRecommendations && (
        <Card className="mx-auto mb-4 h-auto w-full max-w-4xl gap-0 overflow-visible rounded-2xl border border-slate-200 bg-white py-0 shadow-sm shadow-black/5">
          <CardHeader className="rounded-t-2xl border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-green-600 p-2 text-white">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Za danas možemo stati ovdje</CardTitle>
                <CardDescription className="mt-1 text-slate-600">
                  Na temelju onoga što si podijelio/la, izdvojila sam nekoliko psihologa koji se bave ovakvim temama.
                </CardDescription>
                <CardDescription className="mt-2 text-slate-600">
                  Ako želiš, možeš mirno pogledati njihove profile i odlučiti odgovara li ti netko od njih.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 bg-white px-5 py-4">
            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sažetak razgovora</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {recommendationSummary}
              </p>
            </div>

            <div className="grid w-full items-stretch gap-3 md:grid-cols-3">
            {visibleCaretakers.map((caretaker) => (
              <div
                key={caretaker.user_id}
                className="flex min-h-[220px] h-full flex-col rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                  <div className="flex items-center gap-3 text-left">
                  <PersistentAvatar
                    cacheKey={`assistant:${caretaker.user_id}`}
                    src={caretaker.user_image_url}
                    alt={`${caretaker.first_name} ${caretaker.last_name}`}
                    className="h-14 w-14 shrink-0"
                    fallback={<>{caretaker.first_name[0]}{caretaker.last_name[0]}</>}
                  />
                    <div className="min-w-0">
                      <h4 className="font-semibold leading-snug text-slate-900">
                        {caretaker.first_name} {caretaker.last_name}
                      </h4>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                    {caretaker.help_categories[0]
                      ? `Radi s temama kao što su ${caretaker.help_categories[0].toLowerCase()}.`
                      : "Psiholog za razgovor i podršku."}
                  </p>
                  <div className="mt-auto pt-3 flex flex-wrap gap-1 overflow-hidden">
                    {(caretaker.assistant_relevant_categories?.length
                      ? caretaker.assistant_relevant_categories
                      : caretaker.help_categories.slice(0, 2)
                    ).map((cat) => (
                      <span
                        key={cat}
                        className="max-w-full truncate rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
                        title={cat}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <Link href={`/carefree/caretaker/${caretaker.user_id}`} className="w-full pt-4">
                    <Button className="w-full">Vidi profil</Button>
                  </Link>
              </div>
            ))}
            </div>

            {recommendedCaretakers.length > caretakersPerPage && (
              <div className="flex w-full items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="disabled:pointer-events-auto disabled:cursor-not-allowed"
                  onClick={() => setRecommendationPage((page) => Math.max(0, page - 1))}
                  disabled={recommendationPage === 0}
                  title={recommendationPage === 0 ? "Nema više preporuka u ovom smjeru" : undefined}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm text-slate-600">
                  {recommendationPage + 1} / {totalRecommendationPages}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="disabled:pointer-events-auto disabled:cursor-not-allowed"
                  onClick={() => setRecommendationPage((page) => Math.min(totalRecommendationPages - 1, page + 1))}
                  disabled={recommendationPage >= totalRecommendationPages - 1}
                  title={recommendationPage >= totalRecommendationPages - 1 ? "Nema više preporuka u ovom smjeru" : undefined}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between gap-3 rounded-b-2xl bg-slate-50 px-4 py-4">
            <Button variant="outline" size="sm" onClick={handleContinueConversation}>
              Nastavi razgovor s Julijom
            </Button>
            <div className="flex items-center gap-2">
              {summaryId && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/carefree/assistant/summary/${summaryId}`)}>
                  Vidi sažetak razgovora
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                router.push("/carefree/search");
              }}>
                Pretraži sve psihologe
              </Button>
              <Button size="sm" onClick={() => {
                router.push("/carefree/main");
              }}>Povratak na početnu</Button>
            </div>
          </div>
        </Card>
      )}

      {showSupportClosure && (
        <Card className="mx-auto mb-4 h-auto w-full max-w-4xl gap-0 overflow-visible rounded-2xl border border-slate-200 bg-white py-0 shadow-sm shadow-black/5">
          <CardHeader className="rounded-t-2xl border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-green-600 p-2 text-white">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Za danas možemo stati ovdje</CardTitle>
                <CardDescription className="mt-1 text-slate-600">
                  Hvala ti što si bio/la ovdje. Razgovor je spremljen, a ako poželiš, uvijek se možeš vratiti i nastaviti drugi put.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="flex items-center justify-center gap-2 rounded-b-2xl bg-slate-50 px-4 py-4">
            {summaryId && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/carefree/assistant/summary/${summaryId}`)}>
                Vidi sažetak razgovora
              </Button>
            )}
            <Button size="sm" onClick={() => {
              router.push("/carefree/main");
            }}>Povratak na početnu</Button>
          </div>
        </Card>
      )}

      {showChatCard && (
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

          {isRecommendationTransitioning && pendingRecommendation && (
            <div className="flex w-full justify-center px-2 pt-2">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center shadow-sm">
                <p className="text-sm text-slate-700">
                  Ako želiš, mogu ti odmah prikazati CareTakere koje sam izdvojila za tebe.
                </p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button size="sm" onClick={() => finalizeRecommendationTransition(pendingRecommendation)}>
                    Prikaži mi CareTakere
                  </Button>
                  <p className="text-xs text-slate-500">
                    Ako ništa ne odabereš, preporuke će se prikazati automatski za 40 sekundi.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-5">
          <div className="flex w-full flex-col gap-0">
            <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={sessionClosed ? "Razgovor je završen" : "Napiši poruku..."}
                className="h-8 flex-1"
                autoFocus
                disabled={isLoading || sessionClosed}
              />
              <Button type="submit" size="sm" disabled={isLoading || !inputValue.trim() || sessionClosed}>
                <Send className="w-4 h-4" />
                <span className="sr-only">Pošalji</span>
              </Button>
            </form>
            {sendError && !sessionClosed && (
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-rose-700">
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
        </div>
      </Card>
      )}
    </div>
  );
}
