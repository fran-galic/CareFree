"use client";

import { Search } from "lucide-react";
import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
    InputGroupButton,
} from "@/components/ui/input-group";

export default function SearchBar({ initial = "" }: { initial: string }) {
    return (
        
        <form action="/carefree/search" method="get" className="w-full">
            <InputGroup className="h-12">
                <InputGroupAddon align="inline-start">
                    <Search className="opacity-70" />
                </InputGroupAddon>

                <InputGroupInput name="q" defaultValue={initial} placeholder="Pretraži psihologe…" aria-label="Pretraži psihologe"/>

                <InputGroupAddon align="inline-end">
                    <InputGroupButton type="submit">Pretraži</InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
        </form>
    );
}
