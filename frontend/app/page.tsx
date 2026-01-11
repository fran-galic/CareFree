"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Home() {
  const [colorIndex, setColorIndex] = useState(0);
  const colors = [
    "text-primary",
    "text-teal-500",
    "text-cyan-500",
    "text-sky-500",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % colors.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
            <Button asChild size="lg" className="cta-button">
              <Link href="/accounts/signup">Registriraj se</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="cta-outline">
              <Link href="/accounts/login">Prijavi se</Link>
            </Button>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-hands-brain text-4xl"></i>
              </div>
              <h3 className="card-title">AI Chat i stručna pomoć</h3>
              <p className="card-text">
                Razgovarajte s našim AI asistentom bilo kada, ili se povežite s licenciranim psihozima za profesionalnu podršku
              </p>
            </div>

            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-shield-check text-4xl"></i>
              </div>
              <h3 className="card-title">Ostanite anonimni</h3>
              <p className="card-text">
                Vaš identitet ostaje privatan. Dijelite slobodno bez otkrivanja tko ste
              </p>
            </div>

            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-users text-4xl"></i>
              </div>
              <h3 className="card-title">Pregledajte stručnjake</h3>
              <p className="card-text">
                Pregledajte profile psihologa, zakažite termine i pronađite pravog za vas
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}