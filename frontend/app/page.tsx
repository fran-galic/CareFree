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
              Welcome to{" "}
              <span className={`${colors[colorIndex]} color-shift`}>
                CareFree
              </span>
            </h1>
            <p className="subtitle">
              Your safe space for mental wellness and support
            </p>
          </div>

          <p className="description">
            Connect with professional caretakers, track your journey, and take
            control of your mental health in a supportive, confidential
            environment.
          </p>

          <div className="button-group">
            <Button asChild size="lg" className="cta-button">
              <Link href="/accounts/signup">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="cta-outline">
              <Link href="/accounts/login">Log in</Link>
            </Button>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-hands-brain text-4xl"></i>
              </div>
              <h3 className="card-title">AI Chat & Expert Help</h3>
              <p className="card-text">
                Talk to our AI assistant anytime, or connect with licensed psychologists for professional support
              </p>
            </div>

            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-shield-check text-4xl"></i>
              </div>
              <h3 className="card-title">Stay Anonymous</h3>
              <p className="card-text">
                Your identity remains private. Share freely without revealing who you are
              </p>
            </div>

            <div className="feature-card">
              <div className="card-icon">
                <i className="fi fi-rr-users text-4xl"></i>
              </div>
              <h3 className="card-title">Browse Experts</h3>
              <p className="card-text">
                View psychologist profiles, schedule appointments, and find the right match for you
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}