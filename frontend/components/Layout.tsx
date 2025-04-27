import React, { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  section?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Ресторан', section }) => {
  const getSectionStyles = () => {
    switch (section) {
      case 'admin':
        return 'container mx-auto px-4 py-6 max-w-7xl';
      case 'waiter':
        return 'container mx-auto px-4 py-6 max-w-5xl';
      case 'customer':
        return 'container mx-auto px-4 py-6';
      default:
        return 'w-full';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 dark:text-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Система управления рестораном" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="flex-grow">
        <div className={section ? getSectionStyles() : 'w-full'}>
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Layout; 