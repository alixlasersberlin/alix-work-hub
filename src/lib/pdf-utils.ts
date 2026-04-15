import jsPDF from 'jspdf';
import { interRegular, interBold } from './pdf-fonts';

/**
 * Creates a jsPDF instance with embedded Inter font for proper German umlaut support.
 */
export function createPDF(options?: ConstructorParameters<typeof jsPDF>[0]): jsPDF {
  const doc = new jsPDF(options);

  // Add Inter font (supports ä, ö, ü, ß, Ä, Ö, Ü)
  doc.addFileToVFS('Inter-Regular.ttf', interRegular);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', interBold);
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');

  // Set as default font
  doc.setFont('Inter', 'normal');

  return doc;
}
