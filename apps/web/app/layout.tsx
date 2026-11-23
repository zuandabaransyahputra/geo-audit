import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { AUTHOR_NAME, AUTHOR_URL, SITE_URL } from '@/lib/site';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

const description =
  'Free GEO audit: check if ChatGPT, Claude, Perplexity and Google AI Overviews can find, read and cite your site. Get a score and copy-paste fixes for robots.txt, llms.txt, JSON-LD and SEO basics.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'GEO Audit: is your site ready for AI search?', template: '%s · GEO Audit' },
  description,
  applicationName: 'GEO Audit',
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'GEO Audit', title: 'GEO Audit: is your site ready for AI search?', description, url: '/' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#16171d' },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh flex flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
