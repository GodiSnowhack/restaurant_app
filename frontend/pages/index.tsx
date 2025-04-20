import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function HomePage() {
  const router = useRouter();
  
  const handleViewMenu = () => {
    router.push('/menu');
  };
  
  return (
    <>
      <Head>
        <title>Ресторан СППР - Добро пожаловать</title>
        <meta name="description" content="Вкусная еда и потрясающая атмосфера в нашем ресторане" />
      </Head>
      
      <Header />
      
      <section className="relative h-[60vh] bg-gray-900">
        <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ 
            backgroundImage: "url('/images/hero-bg.jpg')",
            filter: "brightness(0.7)"
          }}
        ></div>
        
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center z-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Добро пожаловать в <span className="text-primary">Ресторан СППР</span>
          </h1>
          <p className="text-xl text-gray-100 mb-8 max-w-2xl">
            Откройте для себя уникальные вкусы и насладитесь атмосферой нашего ресторана. 
            Мы предлагаем широкий выбор блюд и напитков, которые удовлетворят любой вкус.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleViewMenu}
              className="px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dark transition-colors"
            >
              Просмотреть меню
            </button>

          </div>
        </div>
      </section>
      
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Наши преимущества</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="inline-block p-4 bg-primary-light rounded-full mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Качественные продукты</h3>
              <p className="text-gray-600">
                Мы используем только свежие и качественные продукты для приготовления наших блюд.
              </p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="inline-block p-4 bg-primary-light rounded-full mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Разнообразное меню</h3>
              <p className="text-gray-600">
                Наше меню содержит широкий выбор блюд, которые удовлетворят любой вкус.
              </p>
            </div>
            
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="inline-block p-4 bg-primary-light rounded-full mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Быстрое обслуживание</h3>
              <p className="text-gray-600">
                Мы ценим ваше время и стараемся обслуживать наших гостей как можно быстрее.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Популярные блюда</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative h-48">
                  <div 
                    className="absolute inset-0 bg-cover bg-center" 
                    style={{ backgroundImage: `url('/images/dish-${item}.jpg')` }}
                  ></div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Название блюда {item}</h3>
                  <p className="text-gray-600 mb-4">
                    Краткое описание блюда, ингредиенты и способ приготовления.
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-bold">₸ {250 + (item * 50)}</span>
                    <Link 
                      href={`/menu/dish/${item}`}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                    >
                      Подробнее
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-10">
            <Link 
              href="/menu"
              className="inline-block px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dark transition-colors"
            >
              Смотреть все блюда
            </Link>
          </div>
        </div>
      </section>
      
      <section className="py-16 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Забронировать стол</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Планируете особенный вечер? Забронируйте стол заранее и наслаждайтесь отдыхом без ожидания.
          </p>
          <Link 
            href="/contact"
            className="inline-block px-6 py-3 bg-white text-primary font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            Связаться с нами
          </Link>
        </div>
      </section>
      
      <Footer />
    </>
  );
} 