import React from 'react';
import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Ресторан' }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Head>
        <title>{title} | Ресторанная система</title>
        <meta name="description" content="Система поддержки принятия решений для управления рестораном" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#e53e3e" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />
      
      <main className="flex-grow bg-gray-50 mobile-padding">
        <div className="container mx-auto">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Layout; 