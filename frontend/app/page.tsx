"use client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Footer } from "@/components/footer"

type UserRole = "student" | "psiholog" | null

export default function Home() {
  const [colorIndex, setColorIndex] = useState(0)
  const [selectedRole, setSelectedRole] = useState<UserRole>(null)

  const colors = [
    "text-primary",
    //"text-cyan-500",
    "text-amber-500",
    //"text-orange-500",
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % colors.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const studentFeatures = [
    {
      icon: "fi fi-rr-brain",
      title: "Julija - CareFree AI asistent 24/7",
      description:
        "Razgovarajte s Julijom, AI asistentom, u bilo koje doba dana za trenutnu podršku i savjete",
      role: "student" as const,
      badge: "S",
    },
    {
      icon: "fi fi-rr-calendar-check",
      title: "Zakaži termin",
      description:
        "Jednostavno zakažite termin s licenciranim psihologom koji odgovara vašim potrebama",
      role: "student" as const,
      badge: "S",
    },
    {
      icon: "fi fi-rr-shield-check",
      title: "Privatno i sigurno",
      description:
        "Vaš identitet ostaje zaštićen - dijelite slobodno bez brige o privatnosti",
      role: "student" as const,
      badge: "S",
    },
  ]

  const psihologFeatures = [
    {
      icon: "fi fi-rr-document",
      title: "Potvrda profila",
      description:
        "Uploadajte dokumente i specijalizaciju, zatim čekajte na potvrdu profila",
      role: "psiholog" as const,
      badge: "P",
    },
    {
      icon: "fi fi-rr-users-alt",
      title: "Pomozite studentima",
      description:
        "Pregled studenata i sažetaka razgovora koje su vodili s CareFree chatbotom",
      role: "psiholog" as const,
      badge: "P",
    },
    {
      icon: "fi fi-rr-calendar",
      title: "Fleksibilan raspored",
      description:
        "Postavite svoju dostupnost i prihvaćajte termine kada Vam odgovara",
      role: "psiholog" as const,
      badge: "P",
    },
  ]

  const getFilteredFeatures = () => {
    if (selectedRole === "student") return studentFeatures
    if (selectedRole === "psiholog") return psihologFeatures
    return [...studentFeatures, ...psihologFeatures]
  }

  return (
    <div className="hero-section">
      <main className="container-centered">
        <div className="content-wrapper">
          <div className="logo-box animate-float">
            <Image
              src="/images/carefree-logo-assistant-new.png"
              alt="CareFree Logo"
              width={120}
              height={120}
              className="logo-img"
              priority
            />
          </div>

          <div className="title-section">
            <h1 className="main-title">
              Dobrodošli u{" "}
              <span className={`${colors[colorIndex]} color-shift`}>
                CareFree
              </span>
            </h1>
            <p className="subtitle">
              Vaš siguran prostor za mentalno zdravlje i podršku
            </p>
          </div>

          <p className="description">
            Povežite se s profesionalnim psihozima, pratite svoj napredak i
            preuzmite kontrolu nad svojim mentalnim zdravljem u podržavajućem i
            povjerljivom okruženju.
          </p>

          <div className="button-group">
            <Button asChild size="lg" variant="outline" className="cta-neutral">
              <Link href="/accounts/signup">Registriraj se</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="cta-ghost">
              <Link href="/accounts/login">Prijavi se</Link>
            </Button>
          </div>

          {/* Scroll Indicator */}
          <div className="scroll-indicator">
            <div className="scroll-icon">
              <i className="fi fi-rr-angle-small-down"></i>
            </div>
            <p className="scroll-text">Otkrij više</p>
          </div>
        </div>
      </main>

      {/* Role Toggle */}
      <div className="role-toggle-container">
        <div className="role-toggle-heading">
          <h2 className="role-toggle-title">Odaberite svoju ulogu</h2>
          <p className="role-toggle-description">
            Personalizirajte iskustvo prema vašim potrebama
          </p>
        </div>
        <div className="role-toggle-wrapper">
          <button
            onClick={() =>
              setSelectedRole(selectedRole === "student" ? null : "student")
            }
            className={`role-toggle-option ${
              selectedRole === "student" ? "active student" : ""
            }`}
          >
            Student
          </button>
          <button
            onClick={() =>
              setSelectedRole(selectedRole === "psiholog" ? null : "psiholog")
            }
            className={`role-toggle-option ${
              selectedRole === "psiholog" ? "active psiholog" : ""
            }`}
          >
            Psiholog
          </button>
        </div>
      </div>

      {/* Features Section */}
      <section className="features-section">
        <div className="container mx-auto px-4">
          <div className="feature-grid-dynamic">
            {getFilteredFeatures().map((feature, index) => (
              <div
                key={index}
                className={`feature-card-dynamic ${
                  selectedRole === null
                    ? "neutral"
                    : selectedRole === feature.role
                    ? `highlighted ${feature.role}`
                    : "dimmed"
                }`}
              >
                <div className={`role-badge ${feature.role}`}>
                  {feature.badge}
                </div>
                <div className="card-icon">
                  <i className={feature.icon}></i>
                </div>
                <h3 className="card-title">{feature.title}</h3>
                <p className="card-text">{feature.description}</p>
                <Button
                  asChild
                  size="sm"
                  className={`feature-cta ${
                    selectedRole === feature.role ? "filled" : "outline"
                  } ${feature.role}`}
                >
                  <Link href="/accounts/signup">
                    {feature.role === "student" ? "Počni sada" : "Pridruži se"}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
