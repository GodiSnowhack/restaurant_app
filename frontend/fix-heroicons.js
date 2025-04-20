const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Функция для рекурсивного поиска файлов
function findFiles(dir, pattern) {
  let results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, pattern));
    } else if (pattern.test(file)) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Функция для замены импортов в файле
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Замена импортов из outline
  if (content.includes('@heroicons/react/outline')) {
    content = content.replace(
      /from ['"]@heroicons\/react\/outline['"]/g,
      'from \'@heroicons/react/24/outline\''
    );
    modified = true;
  }
  
  // Замена импортов из solid
  if (content.includes('@heroicons/react/solid')) {
    content = content.replace(
      /from ['"]@heroicons\/react\/solid['"]/g,
      'from \'@heroicons/react/24/solid\''
    );
    modified = true;
  }
  
  // Замена устаревших имен иконок
  const iconReplacements = {
    'MenuIcon': 'Bars3Icon as MenuIcon',
    'PhotographIcon': 'PhotoIcon as PhotographIcon',
    'DocumentTextIcon': 'DocumentTextIcon',
    'UploadIcon': 'ArrowUpTrayIcon as UploadIcon',
    'SaveIcon': 'CheckIcon as SaveIcon',
    'RefreshIcon': 'ArrowPathIcon as RefreshIcon',
    'ClipboardCopyIcon': 'ClipboardDocumentIcon as ClipboardCopyIcon',
    'InformationCircleIcon': 'InformationCircleIcon',
    'LogoutIcon': 'ArrowRightOnRectangleIcon as LogoutIcon',
    'CogIcon': 'Cog6ToothIcon as CogIcon',
    'ClipboardIcon': 'ClipboardDocumentListIcon as ClipboardIcon'
  };
  
  for (const [oldName, newName] of Object.entries(iconReplacements)) {
    const regex = new RegExp(`import\\s*{[^}]*${oldName}[^}]*}\\s*from`, 'g');
    if (regex.test(content)) {
      content = content.replace(
        new RegExp(`import\\s*{([^}]*)}`, 'g'),
        (match, imports) => {
          const importList = imports.split(',').map(i => i.trim());
          const newImportList = importList.map(i => {
            if (i === oldName) {
              return newName;
            }
            return i;
          });
          return `import {${newImportList.join(', ')}}`;
        }
      );
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Исправлен файл: ${filePath}`);
  }
}

// Основная функция
function main() {
  const frontendDir = path.join(__dirname);
  const tsxFiles = findFiles(frontendDir, /\.tsx$/);
  
  console.log(`Найдено ${tsxFiles.length} TSX файлов`);
  
  for (const file of tsxFiles) {
    fixImports(file);
  }
  
  console.log('Готово!');
}

main(); 