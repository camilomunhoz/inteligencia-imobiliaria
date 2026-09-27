import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

export interface CleanedContent {
  title: string;
  markdown: string;
  images: string[];
}

export function cleanHtml(html: string, url: string): CleanedContent {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // 1. Extrair todas as imagens relevantes antes da limpeza
  const imageElements = Array.from(doc.querySelectorAll('img'));
  const images = Array.from(
    new Set(
      imageElements
        .map((img) => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '')
        .filter((src) => {
          if (!src || src.startsWith('data:') || src.includes('.svg') || src.includes('icon')) {
            return false;
          }
          // Priorizar imagens que pareçam de imóveis/fotos
          return src.startsWith('http://') || src.startsWith('https://');
        })
    )
  ).slice(0, 15); // limitar às 15 primeiras imagens

  // 2. Remover elementos ruidosos (scripts, styles, rodapés, anúncios, banners)
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'header',
    'footer',
    'nav',
    'aside',
    '.ad',
    '.advertisement',
    '.cookie-banner',
    '.modal',
    '[role="dialog"]',
    '[role="banner"]',
  ];

  for (const selector of selectorsToRemove) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // 3. Usar Mozilla Readability para isolar o corpo principal
  const reader = new Readability(doc, { charThreshold: 50 });
  const article = reader.parse();

  const title = article?.title || doc.title || 'Imóvel sem título';
  const contentHtml = article?.content || doc.body.innerHTML || '';

  // 4. Converter para Markdown limpo com Turndown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
  });

  // Remover links longos e manter apenas o texto
  turndown.addRule('stripLinks', {
    filter: 'a',
    replacement: (content) => content,
  });

  const markdown = turndown.turndown(contentHtml);

  // Limitar tamanho para caber confortavelmente na janela de contexto do LLM (aprox. 8000 caracteres)
  const truncatedMarkdown = markdown.length > 8000 ? markdown.slice(0, 8000) + '\n\n[...conteúdo truncado...]' : markdown;

  return {
    title,
    markdown: truncatedMarkdown,
    images,
  };
}
