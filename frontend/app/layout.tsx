"use client"

import "./globals.css";
import { SessionProvider } from "next-auth/react"
import { Inter } from "next/font/google"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-thin-rounded/css/uicons-thin-rounded.css" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
