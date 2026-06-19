/**
 * Rendu PDF serverless du document SPEC-PDF (PRD §19, branchement LOT 4).
 *
 * Choix : Chromium headless (`@sparticuz/chromium`) piloté par `puppeteer-core`.
 * Il imprime EXACTEMENT le HTML autoporté du template (`attestationDocumentHTML`),
 * celui-là même affiché en spécimen sur le site — d'où une fidélité typographique
 * parfaite (gradients, ombres, polices, var() : zéro réécriture). C'est la raison
 * de ce choix face à @react-pdf, qui aurait imposé un second template à maintenir.
 *
 * Runtime : sur Vercel/Lambda le binaire est fourni par `@sparticuz/chromium`
 * (extrait dans /tmp). En local, `PUPPETEER_EXECUTABLE_PATH` permet de pointer
 * un Chrome déjà installé. Aucune clé ni asset : fonction pure HTML → PDF.
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function htmlVersPdf(html: string): Promise<Buffer> {
  const executablePath =
    process.env['PUPPETEER_EXECUTABLE_PATH'] || (await chromium.executablePath());

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    // `load` attend le chargement des polices/images référencées par les
    // <style> inlinés (tokens + ATTESTATION_CSS) avant l'impression.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
