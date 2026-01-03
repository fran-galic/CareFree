"use client";

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function MainPage() {
  return (
    <div className="min-h-screen min-w-[1200px] mx-auto">
      {/* HEADER */}
      <div className="h-[5rem] p-[1em] flex justify-between bg-card shadow-sm shadow-primary" id="header">
        
        {/* LOGO */}
        <div className="flex items-center gap-1"> 
          <div className="w-[3rem] h-auto">
            <img src="/images/carefree-logo-assistant-new.png" alt="Carefree Logo"/>
          </div>
          <div>
            <CardTitle className="p-1 text-3xl font-bold text-primary">CareFree</CardTitle>
          </div>
        </div>

        {/* --- NAVIGACIJA (OVDJE SU PROMJENE) --- */}
        <div className="p-[0.4em] flex rounded-full px-4 py-2 bg-background">
          <CardContent className="flex p-0 items-center">
            
            <Link 
                className="mx-5 my-1 font-semibold hover:underline text-foreground" 
                href="/carefree/main"
            >
                Home
            </Link>
            
            {/* Link na Chat (zasad placeholder ili ako imas rutu messages) */}
            <Link 
                className="mx-5 my-1 font-semibold hover:underline text-foreground" 
                href="/carefree/messages"
            >
                Messages
            </Link>
            
            {/* Link na KALENDAR */}
            <Link 
                className="mx-5 my-1 font-semibold hover:underline text-foreground" 
                href="/carefree/calendar"
            >
                Calendar
            </Link>

            {/* Link na DNEVNIK (NOVO) */}
            <Link 
                className="mx-5 my-1 font-semibold hover:underline text-foreground" 
                href="/carefree/journal"
            >
                Journal
            </Link>

            {/* Link na PRETRAGU */}
            <Link 
                className="mx-5 my-1 font-semibold hover:underline text-foreground" 
                href="/search"
            >
                Search
            </Link>

          </CardContent>
        </div>

        {/* PROFILE AVATAR */}
        <div className="p-[0.5em] rounded-full flex bg-background items-center gap-2 px-4">
          <Avatar className="size-8">
            <AvatarImage src={"https://github.com/shadcn.png"} />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <div className="my-1">
            <Link className="font-semibold cursor-pointer hover:underline" href="/carefree/myprofile">
                My Profile
            </Link>
          </div>
        </div>
      </div>

      {/* CONTENT BODY */}
      <div className="flex gap-6 h-[calc(100vh-5rem)]">
        <div className="m-[0.8rem] flex flex-col gap-3 w-[23rem]">
          <Card className="mb-[0.8rem] h-[10rem] py-[1.5rem] px-[1rem]">
            <CardTitle>My Caretaker</CardTitle>
          </Card>
          <Card className="h-[63vh] py-[1.5rem] px-[1rem] flex-1">
            <CardTitle>Latest Conversations</CardTitle>
          </Card>
        </div>
        <div className="mr-[0.8rem] mt-3 flex flex-col flex-1 gap-3">
          <div className="mb-[0.8rem] flex-1 rounded-md overflow-y-auto">
             {/* Ovdje će ići glavni sadržaj dashboarda */}
          </div>
          <InputGroup className="h-[3.2rem] mb-[0.8rem] shadow-sm shadow-primary bg-card">
            <InputGroupInput placeholder="Type a message to AI assistant..."></InputGroupInput>
          </InputGroup>
        </div>
      </div>
    </div>
  )
}