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

  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]); 

  
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const tempContent = inputValue;
    setInputValue(""); 
    setIsLoading(true);

    
    
    const tempUserMessage: AssistantMessage = {
      id: Date.now(), 
      sender: "student",
      content: tempContent,
      created_at: new Date().toISOString()
    };

    
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      const apiCall = sendMessage(tempContent);

      
      const [_, response] = await Promise.all([minDelay, apiCall]);
      
      
      setMessages((prev) => {
        
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        
        const newMessages = [response.user_message, response.bot_message].filter(Boolean);
        return [...filtered, ...newMessages];
      });

    } catch (error: any) {
      console.error("Greška pri slanju:", error);
      
      
      if (error.message?.includes("400")) {
        setSessionEnded(true);
        setIsSessionActive(false);
        
        
        
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
      
      
      setMessages((prev) => prev.filter(msg => msg.id !== tempUserMessage.id));
      setInputValue(tempContent); 
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
      
      {/* SESSION ENDED - RECOMMENDATIONS */}
      {sessionEnded && (
        <Card className="mb-6 border-green-200 bg-green-50/50">
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
              placeholder={sessionEnded ? "Razgovor je završen" : "Napiši poruku..."}
              className="flex-1"
              autoFocus
              disabled={isLoading || sessionEnded}
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim() || sessionEnded}>
              <Send className="w-4 h-4" />
              <span className="sr-only">Pošalji</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
