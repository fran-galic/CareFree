"use client";

import * as React from 'react'
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { searchCaretakerById } from "@/fetchers/users"
import {
    Card,
    CardContent,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ShowCaretakerInfo({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const { data, error, isLoading } = useSWR(id || null, (id) => searchCaretakerById(id))

    const caretaker = data ?? "";
    console.log("API response:", caretaker);

    return (
        <div className="mx-auto mt-9 max-w-2xl p-6 space-y-3">
            {error && (
                <Card className="border-red-400 bg-red-50">
                    <CardContent className="p-4 text-red-700">
                        <CardTitle className="text-lg">Backend error</CardTitle>
                        <p>Unable to fetch caretakers. Please try again later.</p>
                    </CardContent>
                </Card>
            )}

            {caretaker !== "" && id && (
                <>
                    <div className="">
                        <Card>
                            <div className="flex ml-7">
                                <Avatar className="my-1 size-20">
                                    <AvatarImage src={caretaker.user_image_url || "https://github.com/shadcn.png"} />
                                    <AvatarFallback>CN</AvatarFallback>
                                </Avatar>
                                <div className="mx-6 my-5">
                                    <CardTitle className="text-3xl font-semibold">{caretaker.first_name} {caretaker.last_name}</CardTitle>
                                    <CardDescription className="mt-[4px] text-base">{caretaker.academic_title?.trim() || "Caretaker"}</CardDescription>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* PROFESSIONAL INFO - Javne informacije */}
                    <div className="mt-5 space-y-3">
                        {/* Specialization, Experience & Location */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <CardTitle className="text-lg mb-2">Specialization</CardTitle>
                                        <p className="text-muted-foreground">
                                            {caretaker.specialisation || "Not specified"}
                                        </p>
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg mb-2">Working since</CardTitle>
                                        <p className="text-muted-foreground">
                                            {caretaker.working_since || "Not specified"}
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <CardTitle className="text-lg mb-2">Office address</CardTitle>
                                        <p className="text-muted-foreground">
                                            {caretaker.office_address || "Not specified"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Help Categories */}
                        <Card>
                            <CardContent className="pt-6">
                                <CardTitle className="text-lg mb-3">Help categories</CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(caretaker.help_categories) && caretaker.help_categories.length > 0 ? (
                                        caretaker.help_categories.map((cat: string, idx: number) => (
                                            <span 
                                                key={idx}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20"
                                            >
                                                {cat}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-muted-foreground">No categories specified</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* About Me */}
                        <Card>
                            <CardContent className="pt-6">
                                <CardTitle className="text-lg mb-3">About me</CardTitle>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                    {caretaker.about_me || "No description available."}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}