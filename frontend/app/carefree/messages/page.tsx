"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startSession, sendMessage, endSession, AssistantMessage } from "@/fetchers/assistant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, StopCircle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react"; 
import { Separator } from "@/components/ui/separator";
import Link from "next/link";


interface Caretaker {
  user_id: string;
  first_name: string;
  last_name: string;
  academic_title: string;
  help_categories: string[];
  user_image_url: string | null;
  specialisation: string;
  working_since: string;
}

// Komponenta za animaciju pisanja (Tri točkice)
const TypingIndicator = () => (
  <div className="flex space-x-1 h-3 items-center">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
  </div>
);

export default function ChatPage() {
  const router = useRouter();
  
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [recommendedCaretakers, setRecommendedCaretakers] = useState<Caretaker[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionInitialized = useRef(false); // Flag za spriječavanje duplih poziva
  const hasScrolledToBottom = useRef(false); // Flag za praćenje je li već scrollano na dno

  
  useEffect(() => {
    window.scrollTo(0, 0);
    hasScrolledToBottom.current = false;
  }, []);

  
  const CARETAKERS_PER_PAGE = 3;
  const totalPages = Math.ceil(recommendedCaretakers.length / CARETAKERS_PER_PAGE);
  const startIndex = currentPage * CARETAKERS_PER_PAGE;
  const endIndex = startIndex + CARETAKERS_PER_PAGE;
  const currentCaretakers = recommendedCaretakers.slice(startIndex, endIndex);

  
  useEffect(() => {
    
    if (sessionInitialized.current) return;
    sessionInitialized.current = true;

    const initSession = async () => {
      try {
        const res = await startSession();
        setIsSessionActive(true);

        const introMsg: AssistantMessage = {
              id: 0,
              sender: "bot" as const,
              content: "Bok! Ja sam Julija, tvoj CareFree AI asistent. Kako se osjećaš danas? Ovdje sam da te saslušam.",
              created_at: new Date().toISOString()
            };

        if(res.created){
          
          setMessages([introMsg]);
          return;
        } else {
          
          const previousMessages = Array.isArray(res.messages) ? res.messages : [];
          
          
          if (previousMessages.length > 0) {
            setMessages(previousMessages);
          } else {
            // Sesija postoji ali nema poruka - dodaj intro
            setMessages([introMsg]);
          }
          return;
        }
      } catch (error) {
        console.error("Greška pri pokretanju sesije:", error);
      }
    };
    initSession();
  }, []); 

  // Automatsko skrolanje na dno (uključujući i kad se pojavi indikator pisanja)
  // Ali samo nakon što je sesija inicijalizirana i korisnik je poslao poruku
  useEffect(() => {
    if (!sessionEnded && hasScrolledToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, sessionEnded]);

  
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    
    hasScrolledToBottom.current = true;

    const tempContent = inputValue;
    setInputValue(""); // Odmah očisti input
    setIsLoading(true);

    
    // Kreiramo privremeni objekt poruke s lažnim ID-em
    const tempUserMessage: AssistantMessage = {
      id: Date.now(), // Privremeni ID (timestamp)
      sender: "student",
      content: tempContent,
      created_at: new Date().toISOString()
    };

    // Dodajemo je odmah u listu da se vidi
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      // KORAK B: Šaljemo na backend i čekamo delay
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      const apiCall = sendMessage(tempContent);
      // Čekamo da prođu minimalno 2 sekunde I da backend odgovori
      const [_, response] = await Promise.all([minDelay, apiCall]);

      console.log("Response:", response);
      
      // KORAK C: Ažuriramo stanje s pravim podacima
      setMessages((prev) => {
        
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        
        const newMessages = [response.user_message, response.bot_message].filter(Boolean);
        return [...filtered, ...newMessages];
      });

      
      if (response.recommendation_ready) {
        
        if (response.caretakers && response.caretakers.length > 0) {
          setRecommendedCaretakers(response.caretakers);
          setCurrentPage(0); 
        } else {
          setRecommendedCaretakers([]);
        }
        
        setSessionEnded(true);
        setIsSessionActive(false);
        
        if (response.danger_flag) {
          console.warn("DANGER FLAG: Korisnik je u riziku!");
        }
      }

    } catch (error: any) {
      console.error("Greška pri slanju:", error);
      alert("Došlo je do greške. Pokušaj ponovno.");
      
      
      setMessages((prev) => prev.filter(msg => msg.id !== tempUserMessage.id));
      setInputValue(tempContent); // Vratimo tekst u input
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Želiš li završiti ovaj razgovor? Kreirat će se sažetak za psihologa.")) return;
    try {
      await endSession();
      alert("Razgovor je završen i sažetak je spremljen.");
      router.push("/carefree/main");
    } catch (error) {
      console.error("Greška pri završetku:", error);
    }
  };

  const handleNewConversation = async () => {
    try {
      setSessionEnded(false);
      setRecommendedCaretakers([]);
      setCurrentPage(0);
      setMessages([]);
      setIsLoading(false);
      
      const res = await startSession();
      setIsSessionActive(true);

      const introMsg: AssistantMessage = {
        id: 0,
        sender: "bot" as const,
        content: "Bok! Ja sam Julija, tvoj CareFree AI asistent. Kako se osjećaš danas? Ovdje sam da te saslušam.",
        created_at: new Date().toISOString()
      };

      if(res.created || !res.messages || res.messages.length === 0){
        setMessages([introMsg]);
      } else {
        const previousMessages = Array.isArray(res.messages) ? res.messages : [];
        setMessages(previousMessages.length > 0 ? previousMessages : [introMsg]);
      }
    } catch (error) {
      console.error("Greška pri pokretanju nove sesije:", error);
      alert("Došlo je do greške pri pokretanju novog razgovora.");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto py-6">
      
      {/* SESSION ENDED - RECOMMENDATIONS */}
      {sessionEnded && (
        <Card className="m-4 border-green-200 bg-green-50/50 animate-slideDown max-h-[calc(100vh-8rem)] flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="bg-green-600 text-white p-2 rounded-full">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl mb-1">Razgovor je završen</CardTitle>
                <CardDescription className="text-sm text-green-700">
                  Hvala što si podijelio/la svoje misli sa mnom. Na temelju našeg razgovora, pripremio sam popis psihologa 
                  koji se specijaliziraju za probleme o kojima smo razgovarali i mogu ti pružiti profesionalnu pomoć.
                </CardDescription>
                <CardDescription className="text-sm text-green-600 mt-2 italic">
                  Na profilu svakog psihologa možeš zatražiti termin za razgovor.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-3 flex-shrink-0">
            {recommendedCaretakers.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {currentCaretakers.map((caretaker) => (
                    <Card key={caretaker.user_id} className="hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-3 flex flex-col items-center text-center h-full justify-between">
                        <div className="flex flex-col items-center">
                          <Avatar className="w-12 h-12 mb-2">
                            {caretaker.user_image_url ? (
                              <AvatarImage src={caretaker.user_image_url} />
                            ) : null}
                            <AvatarFallback className="text-sm">
                              {caretaker.first_name[0]}{caretaker.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <h4 className="font-semibold text-sm line-clamp-1">
                            {caretaker.academic_title} {caretaker.first_name} {caretaker.last_name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{caretaker.specialisation}</p>
                          <div className="flex gap-1 flex-wrap justify-center">
                            {caretaker.help_categories.slice(0, 2).map((cat, idx) => (
                              <span key={idx} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full h-fit">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Link href={`/carefree/caretaker/${caretaker.user_id}`} className="w-full mt-auto pt-4">
                          <Button size="sm" className="h-7 text-xs w-full">Vidi profil</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Trenutno nema dostupnih psihologa za ovu kategoriju. Pretraži sve psihologe da pronađeš odgovarajuću pomoć.</p>
            )}
          </CardContent>
          
          {recommendedCaretakers.length > 0 && (
            <CardFooter className="flex-col gap-2 pt-3 flex-shrink-0 border-t bg-background">
              {}
              {totalPages > 1 && (
                <div className="flex items-center justify-between w-full">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Stranica {currentPage + 1} od {totalPages} ({recommendedCaretakers.length} psihologa)
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2 w-full">
              <Button onClick={handleNewConversation} className="flex-1">
                Započni novi razgovor
              </Button>
              <Button onClick={() => router.push("/carefree/search")} variant="outline" className="flex-1">
                Pretraži sve psihologe
              </Button>
              <Button onClick={() => router.push("/carefree/main")} variant="outline" className="flex-1">
                Povratak na početnu
              </Button>
            </div>
            </CardFooter>
          )}
        </Card>
      )}
      
      {}
      {!sessionEnded && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary to-teal-600 p-2 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Julija - CareFree AI asistent</h1>
                <p className="text-xs text-muted-foreground">Siguran razgovor</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEndSession} 
              disabled={!isSessionActive}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Završi
            </Button>
          </div>
        </div>
      )}

      {/* CHAT CONTAINER */}
      <div className="flex-1 m-6 mb-8 border rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-muted/20">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${
                msg.sender === "student" ? "justify-end" : "justify-start"
              }`}
            >
              <div className={`flex max-w-[75%] gap-2.5 ${
                 msg.sender === "student" ? "flex-row-reverse" : "flex-row"
              }`}>
                {/* AVATAR */}
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {msg.sender === "student" ? (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* TEXT BUBBLE */}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm border ${
                    msg.sender === "student"
                      ? "bg-primary text-primary-foreground rounded-tr-sm border-primary"
                      : "bg-background rounded-tl-sm border-border"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {/* DINAMIČKA ANIMACIJA DOK BOT PIŠE */}
          {isLoading && (
            <div className="flex w-full justify-start">
               <div className="flex gap-2.5">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                        <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="bg-background px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-border">
                    <TypingIndicator />
                  </div>
               </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="border-t bg-background px-6 py-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={sessionEnded ? "Razgovor je završen" : "Napiši poruku..."}
            className="flex-1"
            autoFocus
            disabled={isLoading || sessionEnded}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !inputValue.trim() || sessionEnded}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Pošalji</span>
          </Button>
        </form>
      </div>
    </div>
    </div>
  );
}