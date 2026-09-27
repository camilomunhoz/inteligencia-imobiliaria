import { chromium, type Browser } from 'playwright';

export interface ScraperResult {
  success: boolean;
  html?: string;
  error?: string;
  errorCode?: 'CAPTCHA' | 'FORBIDDEN' | 'TIMEOUT' | 'NOT_FOUND' | 'GENERIC';
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

export async function scrapeUrl(url: string): Promise<ScraperResult> {
  let browser: Browser | null = null;

  try {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
      ],
    });

    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const page = await context.newPage();

    // Remover flags que entregam automação
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-expect-error Mock plugins
      window.navigator.chrome = { runtime: {} };
    });

    console.log(`[Scraper] Navegando para ${url}...`);

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
    } catch (navError: unknown) {
      const err = navError as Error;
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        return {
          success: false,
          error: 'Tempo limite esgotado ao tentar carregar o anúncio (Timeout).',
          errorCode: 'TIMEOUT',
        };
      }
      throw navError;
    }

    const status = response?.status() ?? 200;

    if (status === 403) {
      return {
        success: false,
        error: 'Acesso bloqueado pelo portal imobiliário (HTTP 403 Forbidden).',
        errorCode: 'FORBIDDEN',
      };
    }

    if (status === 404) {
      return {
        success: false,
        error: 'Anúncio não encontrado ou removido (HTTP 404 Not Found).',
        errorCode: 'NOT_FOUND',
      };
    }

    // Aguardar pequena renderização de conteúdo client-side
    await page.waitForTimeout(2000);

    const html = await page.content();

    // Verificação de desafios anti-bot / CAPTCHA
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes('cf-browser-verification') ||
      lowerHtml.includes('challenge-platform') ||
      lowerHtml.includes('recaptcha') ||
      lowerHtml.includes('hcaptcha') ||
      lowerHtml.includes('incapsula') ||
      lowerHtml.includes('acesso bloqueado') ||
      lowerHtml.includes('verifique que voce e humano')
    ) {
      return {
        success: false,
        error: 'Bloqueio por CAPTCHA ou proteção anti-bot detectado na página.',
        errorCode: 'CAPTCHA',
      };
    }

    return {
      success: true,
      html,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Scraper] Erro inesperado ao raspar ${url}:`, err.message);
    return {
      success: false,
      error: `Erro ao capturar o anúncio: ${err.message}`,
      errorCode: 'GENERIC',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
