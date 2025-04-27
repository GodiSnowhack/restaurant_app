import React, { ReactNode } from 'react';
import Head from 'next/head';
import Header from '../Header';
import Footer from '../Footer';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  hideFooter?: boolean;
  hideHeader?: boolean;
}

/**
 * Компонент для создания шаблона страницы
 * Включает заголовок, хедер и футер
 */
const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  title = 'Ресторан', 
  hideFooter = false,
  hideHeader = false
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 dark:text-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Система управления рестораном" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {!hideHeader && <Header />}

      <main className="flex-grow w-full">
        {children}
      </main>

      {!hideFooter && <Footer />}
    </div>
  );
};

export default PageLayout; 