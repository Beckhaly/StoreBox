// TypeScript wrapper pour le service PDF (pdfkit)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfService = require('./pdf-impl.js');
export const genererFacture: (vente: unknown, client: unknown, lignes: unknown[]) => Promise<Buffer> = pdfService.genererFacture;
export const genererDevis: (devis: unknown, client: unknown, lignes: unknown[]) => Promise<Buffer> = pdfService.genererDevis;
export const genererReleveClient: (client: unknown, creances: unknown[], options: unknown) => Promise<Buffer> = pdfService.genererReleveClient;
