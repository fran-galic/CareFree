"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startSession, sendMessage, endSession, AssistantMessage } from "@/fetchers/assistant";
import { searchCaretakers, Caretaker } from "@/fetchers/users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, StopCircle, CheckCircle } from "lucide-react"; 
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Inicijalizacija sesije
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await startSession();
        setIsSessionActive(true);

        const introMsg = {
              id: 0,
              sender: "bot",
              content: "Bok! Ja sam tvoj AI asistent. Kako se osjećaš danas? Ovdje sam da te saslušam.",
              created_at: new Date().toISOString()
            };

        if(res.created){

          setMessages([introMsg]);
          return;

        } else if (!res.created){

          const previousMessages = Array.isArray(res.messages) ? res.messages : [];
          const mapped = previousMessages.map((m, idx) => ({
            id: m.id ?? idx + 1,
            sender: m.sender ?? "bot",
            content: m.content ?? "",
            created_at: m.created_at ?? new Date().toISOString(),
          }));

          setMessages([introMsg, ...mapped]);
          return;
        }
      } catch (error) {
        console.error("Greška pri pokretanju sesije:", error);
      }
    };
    initSession();
  }, []);

  // Automatsko skrolanje na dno (uključujući i kad se pojavi indikator pisanja)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]); // Dodali smo isLoading u dependency array

  // 2. Funkcija za slanje poruke (OPTIMISTIC UPDATE)
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const tempContent = inputValue;
    setInputValue(""); // Odmah očisti input
    setIsLoading(true);

    // KORAK A: Odmah prikaži tvoju poruku (Optimistic UI)
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
      //TODO:
      //Ovdje sada treba dodati kod u kojem ovisno o tome je li summary napravljen prikazujes psihologe ili ne
      //Ako je summary napravljen, session se sam automatski zatvori tako da ne treba slati nikakav fetch na backend


      

      // KORAK B: Šaljemo na backend i čekamo delay
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      const apiCall = sendMessage(tempContent);
      // Čekamo da prođu minimalno 2 sekunde I da backend odgovori
      const [_, response] = await Promise.all([minDelay, apiCall]);


      console.log(apiCall);
      console.log(response);
      // KORAK C: Ažuriramo stanje s pravim podacima
      setMessages((prev) => {
        // 1. Uklonimo našu privremenu poruku (filtriramo po ID-u)
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        // 2. Dodamo pravu poruku studenta (iz baze) i odgovor bota
        const newMessages = [response.user_message, response.bot_message].filter(Boolean);
        return [...filtered, ...newMessages];
      });

    } catch (error: any) {
      console.error("Greška pri slanju:", error);
      
      // Provjeri je li 400 - sesija završena
      if (error.message?.includes("400")) {
        setSessionEnded(true);
        setIsSessionActive(false);
        
        // TODO: Ovdje će biti pravi API poziv s kategorijama iz summary-a
        // Za sada dummy kategorije
        const dummyCategories = ["anksioznost", "stres"];
        
        try {
          const response = await searchCaretakers("", dummyCategories, 1);
          setRecommendedCaretakers(response.results.slice(0, 3));
        } catch (err) {
          console.error("Greška pri dohvatu psihologa:", err);
        }
      } else {
        alert("Došlo je do greške. Pokušaj ponovno.");
      }
      
      // Ako pukne, moramo maknuti onu privremenu poruku jer nije prošla
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto py-6">
      
      {/* SESSION ENDED - RECOMMENDATIONS */}
      {sessionEnded && (
        <Card className="m-4 border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" />
              <CardTitle>Razgovor je završen</CardTitle>
            </div>
            <CardDescription className="text-green-600">
              Hvala na povjerenju. Pripremili smo preporuke psihologa koji bi ti mogli pomoći.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendedCaretakers.length > 0 ? (
              <div className="grid gap-4">
                {recommendedCaretakers.map((caretaker) => (
                  <Card key={caretaker.user_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-12 h-12">
                          {caretaker.user_image_url ? (
                            <AvatarImage src={caretaker.user_image_url} />
                          ) : null}
                          <AvatarFallback>
                            {caretaker.first_name[0]}{caretaker.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {caretaker.academic_title} {caretaker.first_name} {caretaker.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{caretaker.specialisation}</p>
                          <div className="flex gap-2 mt-2">
                            {caretaker.help_categories.slice(0, 3).map((cat, idx) => (
                              <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Link href={`/carefree/search/${caretaker.user_id}`}>
                          <Button size="sm">Vidi profil</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Učitavam preporuke...</p>
            )}
            <div className="flex gap-2 pt-4">
              <Button onClick={() => router.push("/carefree/search")} variant="outline" className="flex-1">
                Pretraži sve psihologe
              </Button>
              <Button onClick={() => router.push("/carefree/main")} className="flex-1">
                Povratak na početnu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-teal-600 p-2 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI Asistent</h1>
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