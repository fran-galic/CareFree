"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startSession, sendMessage, endSession, AssistantMessage } from "@/fetchers/assistant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, StopCircle } from "lucide-react"; 
import { Separator } from "@/components/ui/separator";

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Inicijalizacija sesije
  useEffect(() => {
    const initSession = async () => {
      try {
        await startSession();
        setIsSessionActive(true);
        setMessages([
          {
            id: 0,
            sender: "bot",
            content: "Bok! Ja sam tvoj AI asistent. Kako se osjećaš danas? Ovdje sam da te saslušam.",
            created_at: new Date().toISOString()
          }
        ]);
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
      // KORAK B: Šaljemo na backend i čekamo delay
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      const apiCall = sendMessage(tempContent);

      // Čekamo da prođu minimalno 2 sekunde I da backend odgovori
      const [_, response] = await Promise.all([minDelay, apiCall]);
      
      // KORAK C: Ažuriramo stanje s pravim podacima
      setMessages((prev) => {
        // 1. Uklonimo našu privremenu poruku (filtriramo po ID-u)
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        // 2. Dodamo pravu poruku studenta (iz baze) i odgovor bota
        return [
          ...filtered, 
          response.user_message, 
          response.bot_message
        ];
      });

    } catch (error) {
      console.error("Greška pri slanju:", error);
      alert("Došlo je do greške. Pokušaj ponovno.");
      
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
    <div className="container mx-auto py-6 max-w-4xl h-[calc(100vh-2rem)] flex flex-col">
      
      {/* HEADER */}
      <CardHeader className="px-0 pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle>AI Podrška</CardTitle>
              <CardDescription>Anoniman i siguran razgovor</CardDescription>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleEndSession} disabled={!isSessionActive}>
            <StopCircle className="w-4 h-4 mr-2" />
            Završi razgovor
          </Button>
        </div>
        <Separator className="mt-4" />
      </CardHeader>

      {/* CHAT AREA */}
      <Card className="flex-1 overflow-hidden flex flex-col shadow-inner bg-slate-50/50 dark:bg-slate-900/20">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${
                msg.sender === "student" ? "justify-end" : "justify-start"
              }`}
            >
              <div className={`flex max-w-[80%] gap-3 ${
                 msg.sender === "student" ? "flex-row-reverse" : "flex-row"
              }`}>
                {/* AVATAR */}
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

                {/* TEXT BUBBLE */}
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.sender === "student"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-white dark:bg-card border rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          
          {/* DINAMIČKA ANIMACIJA DOK BOT PIŠE */}
          {isLoading && (
            <div className="flex w-full justify-start animate-in fade-in duration-300">
               <div className="flex gap-3 flex-row">
                  <Avatar className="w-8 h-8 mt-1">
                    <AvatarFallback className="bg-teal-600 text-white">
                        <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="bg-white dark:bg-card border p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center">
                    <TypingIndicator />
                  </div>
               </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </CardContent>

        {/* INPUT AREA */}
        <CardFooter className="p-4 bg-background border-t">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Napiši poruku..."
              className="flex-1"
              autoFocus
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              <Send className="w-4 h-4" />
              <span className="sr-only">Pošalji</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}