import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Coworkr - Your AI Colleague',
  description: 'AI-powered assistant for tasks, calendar, and knowledge management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
