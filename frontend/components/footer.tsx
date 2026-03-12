import { Heart } from "lucide-react";
import Image from "next/image";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-card/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Lijeva strana - Logo i naziv */}
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="CareFree logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-[oklch(0.783_0.1136_182.2)] to-[oklch(0.68_0.20_45)] bg-clip-text text-transparent">
              CareFree
            </span>
            <span className="text-sm text-muted-foreground">
              | Mentalno zdravlje studenata
            </span>
          </div>

          {/* Sredina - Linkovi */}
          <div className="flex gap-6 text-sm">
            <button className="text-muted-foreground hover:text-primary transition-colors cursor-default">
              O nama
            </button>
            <button className="text-muted-foreground hover:text-primary transition-colors cursor-default">
              Kontakt
            </button>
            <button className="text-muted-foreground hover:text-primary transition-colors cursor-default">
              Privatnost
            </button>
            <button className="text-muted-foreground hover:text-primary transition-colors cursor-default">
              Uvjeti korištenja
            </button>
          </div>

          {/* Desna strana - Copyright */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>© {currentYear} CareFree</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Napravljeno s <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
