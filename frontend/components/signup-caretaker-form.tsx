"use client"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { BACKEND_URL } from "@/lib/config"


interface ISignupCaretakerFormProps {
    userId: string
}

export default function SignupCaretakerForm({ userId } : ISignupCaretakerFormProps) {
    const START_YEAR = 1950
    const END_YEAR = 2025

    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        // setError(null)

        try {
            const formData = new FormData(e.currentTarget)
            const payload = Object.fromEntries(formData.entries())

            console.log("payload: ", payload)

            const endpoint = `${BACKEND_URL}/auth/register/caretaker/`

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user_id: userId, ...payload }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(
                    errorData.detail || errorData.error || "Registration failed"
                )
            }

            await response.json();

            // onSignupComplete(payload.role as string, data.id)
            console.log("success")
            router.push("/accounts/login");
        } catch (err) {
            // setError(err instanceof Error ? err.message : "An error occurred")
            console.error("Signup error:", err)
        } finally {
            setIsLoading(false)

        }
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>Psiholog</CardTitle>
                <CardDescription>
                    Dovršite svoj profil psihologa.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit}>
                    <FieldGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel htmlFor="academic-title">Akademska titula</FieldLabel>
                                <Input name="academic_title" id="academic-title" type="text" placeholder="Psy.D." required />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="working-since">Radi od godine</FieldLabel>
                                <Select name="working_since" required>
                                    <SelectTrigger id="working-since">
                                        <SelectValue placeholder="Odaberite godinu" />
                                    </SelectTrigger>
                                    <SelectContent className="h-42">
                                        {Array.from(
                                            { length: END_YEAR - START_YEAR + 1 },
                                            (_, i) => END_YEAR - i
                                        ).map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel htmlFor="specialisation">Područje rada</FieldLabel>
                            <Input
                                name="specialisation"
                                id="specialisation"
                                type="text"
                                placeholder="Kognitivna terapija"
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="tel-num">Broj telefona</FieldLabel>
                            <Input
                                name="tel_num"
                                id="tel-num"
                                type="tel"
                                placeholder="091 111 1111"
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="office-address">Adresa rada</FieldLabel>
                            <Input
                                name="office_address"
                                id="office-address"
                                type="tel"
                                required
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="office-address">Nekoliko riječi o vama</FieldLabel>
                            <Textarea
                                name="about_me"
                                id="office-address"
                                placeholder="Napišite kratko kako pristupate radu i u čemu najčešće pomažete..."
                                rows={4}
                                className="h-32 overflow-y-auto overflow-x-hidden resize-none"
                            />
                        </Field>
                        <FieldGroup>
                            <Field>
                                <Button type="submit" disabled={isLoading}>{isLoading ? "Spremamo..." : "Dovrši postavljanje računa"}</Button>
                            </Field>
                        </FieldGroup>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    )
}
