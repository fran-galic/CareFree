"use client";

import { Search } from "lucide-react";
import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
    InputGroupButton,
} from "@/components/ui/input-group";

export default function SearchBar({
    initial = "",
    hiddenParams = {},
}: {
    initial: string;
    hiddenParams?: Record<string, string | undefined | null>;
}) {
    return (
        
        <form action="/carefree/search" method="get" className="w-full">
            {Object.entries(hiddenParams).map(([key, value]) =>
                value ? <input key={key} type="hidden" name={key} value={value} /> : null
            )}
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
