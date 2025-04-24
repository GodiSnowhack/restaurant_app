import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';

// Компонент ErrorBoundary для обработки ошибок рендеринга
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Ошибка в AuthDebugger:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Возвращаем резервный UI
      return null;
    }
    return this.props.children;
}
}

// Внутренний компонент отладчика
const AuthDebuggerInner = () => {
  const [expanded, setExpanded] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Безопасное декодирование base64
  const safeAtob = (base64: string) => {
    try {
      // Проверяем, что строка содержит только допустимые символы base64
      if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
        throw new Error('Некорректная base64-строка');
      }
      return atob(base64);
    } catch (error) {
      console.error('Ошибка при декодировании base64:', error);
      throw error;
    }
  };
  
  // Получаем информацию о токене для отладки
  const getTokenInfo = () => {
    if (typeof window === 'undefined') return null;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return { exists: false, message: 'Токен отсутствует' };
    
      // Проверяем структуру токена
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { 
          exists: true, 
          valid: false,
          message: 'Некорректная структура токена (не JWT)',
          token: token.substring(0, 10) + '...' 
        };
      }
      
      // Пытаемся декодировать payload с дополнительной проверкой
      try {
        const base64Url = parts[1];
        if (!base64Url) {
          throw new Error('Отсутствует payload часть токена');
        }
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Добавляем padding если необходимо
        const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        
        // Безопасное декодирование
        const decodedPayload = safeAtob(paddedBase64);
        const payload = JSON.parse(decodedPayload);
        
        // Проверяем срок действия
        const now = Math.floor(Date.now() / 1000);
        const isExpired = payload.exp && payload.exp < now;
        
        return {
          exists: true,
          valid: true,
          expired: isExpired,
          payload: payload,
          exp: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Не указан',
          token: token.substring(0, 15) + '...'
        };
      } catch (decodeError) {
        console.error('Ошибка при декодировании payload:', decodeError);
        return { 
          exists: true, 
          valid: false,
          message: 'Не удалось декодировать payload токена',
          error: String(decodeError)
        };
      }
    } catch (error) {
      console.error('Ошибка при анализе токена:', error);
      return { 
        exists: true, 
        valid: false,
        message: 'Ошибка при декодировании токена',
        error: String(error)
      };
    }
  };

  // Загружаем информацию о токене при монтировании компонента
  useEffect(() => {
    try {
      const info = getTokenInfo();
      setTokenInfo(info);
    } catch (err) {
      console.error('Ошибка при получении информации о токене:', err);
      setError('Не удалось получить информацию о токене');
    }
  }, []);

  // Стиль для отладочного компонента
  const style = {
    debugger: {
      position: 'fixed' as 'fixed',
      bottom: '10px',
      right: '10px',
      zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxWidth: expanded ? '500px' : '150px',
      overflow: 'hidden',
      transition: 'max-width 0.3s ease'
    },
    button: {
      backgroundColor: 'transparent',
      color: '#00ff00',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      textAlign: 'left' as 'left',
      width: '100%'
    },
    info: {
      padding: '8px 0',
      maxHeight: '300px',
      overflow: 'auto'
    },
    field: {
      margin: '4px 0'
    },
    pre: {
      margin: '4px 0',
      whiteSpace: 'pre-wrap' as 'pre-wrap'
    }
  };
  
  // Если произошла ошибка или информация о токене не загружена, показываем минимальный интерфейс
  if (error) {
    return (
      <div style={style.debugger}>
        <button style={style.button} onClick={() => setExpanded(!expanded)}>
          {expanded ? '[ - ] Auth Error' : '[ + ] Auth'}
        </button>
        {expanded && <div style={style.field}>Ошибка: {error}</div>}
      </div>
    );
  }
  
  // Предотвращаем ошибки рендеринга, если tokenInfo равен null
  if (!tokenInfo) {
    return (
      <div style={style.debugger}>
        <button style={style.button} onClick={() => setExpanded(!expanded)}>
          {expanded ? '[ - ] Auth Debug' : '[ + ] Auth'}
        </button>
        {expanded && <div style={style.field}>Загрузка информации...</div>}
      </div>
    );
  }

  return (
    <div style={style.debugger}>
      <button style={style.button} onClick={() => setExpanded(!expanded)}>
        {expanded ? '[ - ] Auth Debug' : '[ + ] Auth'}
      </button>
      
      {expanded && (
        <div style={style.info}>
          <div style={style.field}>
            Авторизация: {tokenInfo.exists ? 'Да' : 'Нет'}
      </div>
      
          {tokenInfo.exists && (
            <>
              <div style={style.field}>
                Токен: {tokenInfo.token}
      </div>
      
              {tokenInfo.valid ? (
                <>
                  <div style={style.field}>
                    Статус: {tokenInfo.expired ? 'Истёк' : 'Действителен'}
                  </div>
                  <div style={style.field}>
                    Истекает: {tokenInfo.exp}
                  </div>
                  <div style={style.field}>
                    Пользователь: {tokenInfo.payload?.sub || 'Н/Д'}
                  </div>
                  <div style={style.pre}>
                    <pre>{JSON.stringify(tokenInfo.payload, null, 2)}</pre>
                  </div>
                </>
              ) : (
                <div style={style.field}>
                  Ошибка: {tokenInfo.message}
                  {tokenInfo.error && <pre>{tokenInfo.error}</pre>}
          </div>
              )}
            </>
        )}
      </div>
      )}
    </div>
  );
};

// Основной компонент AuthDebugger с защитой от ошибок рендеринга
const AuthDebugger = () => {
  return (
    <ErrorBoundary>
      <AuthDebuggerInner />
    </ErrorBoundary>
  );
};

export default AuthDebugger; 